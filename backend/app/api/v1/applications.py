from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentTenantId, DbSession, get_token_payload
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import TokenPayload
from app.models.application import AppStatus, Application, TenantApplication
from app.models.external_permission import ExternalPermission, PermissionSyncRun
from app.schemas.application import (
    ApplicationCreate,
    ApplicationRead,
    ApplicationUpdate,
    PermissionSyncRequest,
    PermissionSyncResponse,
    TenantApplicationCreate,
    TenantApplicationRead,
    TenantApplicationUpdate,
)
from app.schemas.common import PaginatedResponse
from app.schemas.permission import ExternalPermissionRead

router = APIRouter()


# ==================== Application Registry ====================


@router.get("", response_model=PaginatedResponse[ApplicationRead])
async def list_applications(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: AppStatus | None = Query(default=None, alias="status"),
):
    """List all registered applications."""
    query = select(Application)

    if status_filter:
        query = query.where(Application.status == status_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination
    query = query.order_by(Application.name)
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    applications = result.scalars().all()

    # Get permission counts
    items = []
    for app in applications:
        perm_count = await db.scalar(
            select(func.count()).where(ExternalPermission.application_id == app.id)
        )
        last_sync = await db.scalar(
            select(PermissionSyncRun.finished_at)
            .where(PermissionSyncRun.application_id == app.id)
            .order_by(PermissionSyncRun.started_at.desc())
            .limit(1)
        )

        item = ApplicationRead.model_validate(app)
        item.permissions_count = perm_count
        item.last_sync_at = last_sync
        items.append(item)

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
async def register_application(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    data: ApplicationCreate,
):
    """Register a new application."""
    # Check for existing
    existing = await db.get(Application, data.id)
    if existing:
        raise ConflictError(detail=f"Application '{data.id}' already exists")

    # Create application
    application = Application(
        id=data.id,
        name=data.name,
        description=data.description,
        base_url=data.base_url,
        healthcheck_url=data.healthcheck_url,
        auth_mode=data.auth_mode,
        metadata_=data.metadata_,
        status=AppStatus.ACTIVE,
    )
    db.add(application)
    await db.flush()
    await db.refresh(application)

    return ApplicationRead.model_validate(application)


@router.get("/{application_id}", response_model=ApplicationRead)
async def get_application(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
):
    """Get application by ID."""
    application = await db.get(Application, application_id)

    if not application:
        raise NotFoundError(detail=f"Application '{application_id}' not found")

    # Get stats
    perm_count = await db.scalar(
        select(func.count()).where(ExternalPermission.application_id == application_id)
    )
    last_sync = await db.scalar(
        select(PermissionSyncRun.finished_at)
        .where(PermissionSyncRun.application_id == application_id)
        .order_by(PermissionSyncRun.started_at.desc())
        .limit(1)
    )

    result = ApplicationRead.model_validate(application)
    result.permissions_count = perm_count
    result.last_sync_at = last_sync

    return result


@router.patch("/{application_id}", response_model=ApplicationRead)
async def update_application(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
    data: ApplicationUpdate,
):
    """Update an application."""
    application = await db.get(Application, application_id)

    if not application:
        raise NotFoundError(detail=f"Application '{application_id}' not found")

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(application, field, value)

    await db.flush()
    await db.refresh(application)

    return ApplicationRead.model_validate(application)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
):
    """Delete an application."""
    application = await db.get(Application, application_id)

    if not application:
        raise NotFoundError(detail=f"Application '{application_id}' not found")

    await db.delete(application)
    await db.flush()


# ==================== Application Permissions ====================


@router.get("/{application_id}/permissions", response_model=list[ExternalPermissionRead])
async def list_application_permissions(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
    module: str | None = Query(default=None),
):
    """List all discovered permissions for an application."""
    application = await db.get(Application, application_id)
    if not application:
        raise NotFoundError(detail=f"Application '{application_id}' not found")

    query = select(ExternalPermission).where(
        ExternalPermission.application_id == application_id
    )

    if module:
        query = query.where(ExternalPermission.module_key == module)

    query = query.order_by(ExternalPermission.module_key, ExternalPermission.permission_key)

    result = await db.execute(query)
    permissions = result.scalars().all()

    return [ExternalPermissionRead.model_validate(p) for p in permissions]


@router.post("/{application_id}/sync-permissions", response_model=PermissionSyncResponse)
async def sync_permissions(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
    request: PermissionSyncRequest | None = None,
):
    """
    Trigger permission discovery sync for an application.
    This calls the application's /api/meta/access endpoint.
    """
    application = await db.get(Application, application_id)
    if not application:
        raise NotFoundError(detail=f"Application '{application_id}' not found")

    # TODO: Implement actual sync logic
    # For now, return a mock response
    sync_run = PermissionSyncRun(
        application_id=application_id,
        run_type="pull",
        status="success",
        summary={"added": 0, "updated": 0, "deprecated": 0},
        started_at=datetime.now(timezone.utc),
        finished_at=datetime.now(timezone.utc),
    )
    db.add(sync_run)
    await db.flush()

    return PermissionSyncResponse(
        status="success",
        app_version=application.current_version,
        summary=sync_run.summary,
    )


# ==================== Tenant Applications ====================


@router.get(
    "/tenants/{tenant_id}",
    response_model=list[TenantApplicationRead],
    tags=["Tenant Applications"],
)
async def list_tenant_applications(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
):
    """List applications enabled for a tenant."""
    query = (
        select(TenantApplication)
        .where(TenantApplication.tenant_id == tenant_id)
        .order_by(TenantApplication.created_at)
    )

    result = await db.execute(query)
    tenant_apps = result.scalars().all()

    return [TenantApplicationRead.model_validate(ta) for ta in tenant_apps]


@router.post(
    "/tenants/{tenant_id}",
    response_model=TenantApplicationRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Tenant Applications"],
)
async def enable_application_for_tenant(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    data: TenantApplicationCreate,
):
    """Enable an application for a tenant."""
    # Verify application exists
    application = await db.get(Application, data.application_id)
    if not application:
        raise NotFoundError(detail=f"Application '{data.application_id}' not found")

    # Check if already enabled
    existing = await db.scalar(
        select(TenantApplication).where(
            TenantApplication.tenant_id == tenant_id,
            TenantApplication.application_id == data.application_id,
        )
    )
    if existing:
        raise ConflictError(
            detail=f"Application '{data.application_id}' already enabled for tenant"
        )

    # Create tenant application
    tenant_app = TenantApplication(
        tenant_id=tenant_id,
        application_id=data.application_id,
        config=data.config,
        status=AppStatus.ACTIVE,
        enabled_at=datetime.now(timezone.utc),
    )
    db.add(tenant_app)
    await db.flush()
    await db.refresh(tenant_app)

    return TenantApplicationRead.model_validate(tenant_app)


@router.patch(
    "/tenants/{tenant_id}/{application_id}",
    response_model=TenantApplicationRead,
    tags=["Tenant Applications"],
)
async def update_tenant_application(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    application_id: str,
    data: TenantApplicationUpdate,
):
    """Update tenant application settings."""
    tenant_app = await db.scalar(
        select(TenantApplication).where(
            TenantApplication.tenant_id == tenant_id,
            TenantApplication.application_id == application_id,
        )
    )

    if not tenant_app:
        raise NotFoundError(
            detail=f"Application '{application_id}' not enabled for tenant"
        )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant_app, field, value)

    # Track enable/disable
    if data.status == AppStatus.ACTIVE and tenant_app.disabled_at:
        tenant_app.enabled_at = datetime.now(timezone.utc)
        tenant_app.disabled_at = None
    elif data.status == AppStatus.INACTIVE and not tenant_app.disabled_at:
        tenant_app.disabled_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(tenant_app)

    return TenantApplicationRead.model_validate(tenant_app)


@router.delete(
    "/tenants/{tenant_id}/{application_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Tenant Applications"],
)
async def disable_application_for_tenant(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    application_id: str,
):
    """Disable/remove an application for a tenant."""
    tenant_app = await db.scalar(
        select(TenantApplication).where(
            TenantApplication.tenant_id == tenant_id,
            TenantApplication.application_id == application_id,
        )
    )

    if not tenant_app:
        raise NotFoundError(
            detail=f"Application '{application_id}' not enabled for tenant"
        )

    await db.delete(tenant_app)
    await db.flush()
