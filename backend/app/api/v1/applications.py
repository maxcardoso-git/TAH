from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api.deps import CurrentTenantId, DbSession, get_token_payload
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import TokenPayload
from app.models.app_catalog import AppCatalog
from app.models.application import AppStatus, Application, TenantApplication
from app.models.external_permission import ExternalPermission, PermissionSyncRun
from app.models.app_feature import AppFeature
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
from app.schemas.app_feature import BulkSyncRequest, BulkSyncResponse
from app.schemas.permission import ExternalPermissionRead

router = APIRouter()


def application_to_read(app: Application, perm_count: int = 0, features_count: int = 0, last_sync: datetime | None = None) -> ApplicationRead:
    """Convert Application model to ApplicationRead schema with catalog fallback."""
    return ApplicationRead(
        id=app.id,
        tenant_id=app.tenant_id,
        app_catalog_id=app.app_catalog_id,
        name=app.display_name,
        description=app.display_description,
        logo_url=app.display_logo_url,
        base_url=app.base_url,
        features_manifest_url=app.features_manifest_url,
        healthcheck_url=app.healthcheck_url,
        icon=app.icon,
        callback_url=app.callback_url,
        launch_url=app.launch_url,
        auth_mode=app.auth_mode,
        status=app.status,
        current_version=app.current_version,
        created_at=app.created_at,
        updated_at=app.updated_at,
        permissions_count=perm_count,
        features_count=features_count,
        last_sync_at=last_sync,
    )


# ==================== Application Registry ====================


@router.get("", response_model=PaginatedResponse[ApplicationRead])
async def list_applications(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: AppStatus | None = Query(default=None, alias="status"),
    tenant_id: UUID | None = Query(default=None),
):
    """List all registered applications."""
    query = select(Application).options(joinedload(Application.catalog))

    if status_filter:
        query = query.where(Application.status == status_filter)
    
    if tenant_id:
        query = query.where(Application.tenant_id == tenant_id)

    # Count total
    count_query = select(func.count()).select_from(
        select(Application.id).where(
            (Application.status == status_filter) if status_filter else True,
            (Application.tenant_id == tenant_id) if tenant_id else True,
        ).subquery()
    )
    total = await db.scalar(count_query) or 0

    # Apply pagination
    query = query.order_by(Application.name)
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    applications = result.scalars().unique().all()

    # Get permission counts and build response
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
        features_count = await db.scalar(
            select(func.count()).where(AppFeature.application_id == app.id)
        )
        
        items.append(application_to_read(app, perm_count or 0, features_count or 0, last_sync))

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
async def register_application(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    data: ApplicationCreate,
):
    """Register a new application for a tenant."""
    # Get tenant_id from data or token
    tenant_id = data.tenant_id
    if not tenant_id and token.tenant_id:
        from uuid import UUID
        tenant_id = UUID(token.tenant_id)
    
    if not tenant_id:
        raise NotFoundError(detail="tenant_id is required")
    
    # Check for existing
    existing = await db.get(Application, data.id)
    if existing:
        raise ConflictError(detail=f"Application '{data.id}' already exists")

    # Get catalog entry
    catalog = await db.get(AppCatalog, data.app_catalog_id)
    if not catalog:
        raise NotFoundError(detail=f"App catalog entry '{data.app_catalog_id}' not found")

    # Create application with catalog reference
    # Use provided values or fall back to catalog values
    application = Application(
        id=data.id,
        tenant_id=tenant_id,  # Associate with tenant
        app_catalog_id=data.app_catalog_id,
        name=data.name or catalog.name,
        description=data.description if data.description is not None else catalog.description,
        logo_url=data.logo_url if data.logo_url is not None else catalog.logo_url,
        base_url=data.base_url,
        features_manifest_url=data.features_manifest_url,
        healthcheck_url=data.healthcheck_url,
        icon=data.icon,
        callback_url=data.callback_url,
        launch_url=data.launch_url,
        auth_mode=data.auth_mode,
        metadata_=data.metadata_,
        status=AppStatus.ACTIVE,
    )
    db.add(application)
    await db.flush()
    
    # Also create TenantApplication to enable the app for this tenant
    tenant_app = TenantApplication(
        tenant_id=tenant_id,
        application_id=data.id,
        status=AppStatus.ACTIVE,
        enabled_at=datetime.now(timezone.utc),
    )
    db.add(tenant_app)
    await db.commit()
    
    # Load catalog relationship
    await db.refresh(application)
    result = await db.execute(
        select(Application)
        .options(joinedload(Application.catalog))
        .where(Application.id == application.id)
    )
    application = result.scalar_one()

    return application_to_read(application)


@router.get("/{application_id}", response_model=ApplicationRead)
async def get_application(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
):
    """Get application by ID."""
    result = await db.execute(
        select(Application)
        .options(joinedload(Application.catalog))
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()

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
    features_count = await db.scalar(
        select(func.count()).where(AppFeature.application_id == application_id)
    )

    return application_to_read(application, perm_count or 0, features_count or 0, last_sync)


@router.patch("/{application_id}", response_model=ApplicationRead)
async def update_application(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
    data: ApplicationUpdate,
):
    """Update an application."""
    result = await db.execute(
        select(Application)
        .options(joinedload(Application.catalog))
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()

    if not application:
        raise NotFoundError(detail=f"Application '{application_id}' not found")

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(application, field, value)

    await db.flush()
    
    # Reload with catalog
    result = await db.execute(
        select(Application)
        .options(joinedload(Application.catalog))
        .where(Application.id == application_id)
    )
    application = result.scalar_one()

    return application_to_read(application)


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


@router.post("/bulk-sync-features", response_model=BulkSyncResponse)
async def bulk_sync_all_features(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    request: BulkSyncRequest,
):
    """
    Sync features from multiple applications at once.
    If application_ids is empty, syncs all active applications.
    """
    import httpx
    import re
    from app.schemas.app_feature import (
        AppFeaturesManifest,
        AppSyncResult,
        FeatureSyncSummary,
    )
    from app.models.app_feature import AppFeature, FeatureLifecycle
    from datetime import datetime, timezone
    
    def _camel_to_snake(name: str) -> str:
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()
    
    def _convert_keys_to_snake_case(data):
        if isinstance(data, dict):
            return {_camel_to_snake(k): _convert_keys_to_snake_case(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [_convert_keys_to_snake_case(item) for item in data]
        return data
    
    # Get applications to sync
    if request.application_ids:
        query = select(Application).where(Application.id.in_(request.application_ids))
    else:
        query = select(Application).where(Application.status == AppStatus.ACTIVE)
    
    result = await db.execute(query)
    applications = result.scalars().all()
    
    results: list[AppSyncResult] = []
    successful = 0
    failed = 0
    skipped = 0
    
    for app in applications:
        try:
            if not app.features_manifest_url and not app.base_url:
                results.append(AppSyncResult(
                    application_id=app.id,
                    application_name=app.name,
                    status="skipped",
                    error_message="No manifest URL or base URL configured"
                ))
                skipped += 1
                continue
            
            if app.features_manifest_url:
                manifest_url = app.features_manifest_url
            else:
                base = app.base_url.rstrip("/")
                manifest_url = f"{base}/api/v1/app-features/manifest"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(manifest_url)
                response.raise_for_status()
                manifest_data = response.json()
            
            if isinstance(manifest_data, dict) and "data" in manifest_data:
                manifest_data = manifest_data["data"]
            
            manifest_data = _convert_keys_to_snake_case(manifest_data)
            manifest = AppFeaturesManifest(**manifest_data)
            
            # Process features
            module_names = {m.id: m.name for m in manifest.modules}
            existing_result = await db.execute(
                select(AppFeature).where(AppFeature.application_id == app.id)
            )
            existing_features = {f.id: f for f in existing_result.scalars().all()}
            seen_ids = set()
            
            summary = FeatureSyncSummary()
            
            for mf in manifest.features:
                seen_ids.add(mf.id)
                
                if mf.id in existing_features:
                    feature = existing_features[mf.id]
                    feature.name = mf.name
                    feature.description = mf.description
                    feature.module = mf.module
                    feature.module_name = module_names.get(mf.module)
                    feature.last_seen_version = manifest.version
                    feature.last_seen_at = datetime.now(timezone.utc)
                    feature.lifecycle = FeatureLifecycle.ACTIVE.value
                    feature.is_active = True
                    summary.updated += 1
                else:
                    feature = AppFeature(
                        id=mf.id,
                        application_id=app.id,
                        name=mf.name,
                        description=mf.description,
                        module=mf.module,
                        module_name=module_names.get(mf.module),
                        path=mf.path,
                        is_active=True,
                        lifecycle=FeatureLifecycle.ACTIVE.value,
                        first_seen_version=manifest.version,
                        last_seen_version=manifest.version,
                    )
                    db.add(feature)
                    summary.added += 1
            
            for feature_id, feature in existing_features.items():
                if feature_id not in seen_ids:
                    if feature.lifecycle == FeatureLifecycle.ACTIVE.value:
                        feature.lifecycle = FeatureLifecycle.DEPRECATED.value
                        summary.deprecated += 1
            
            app.current_version = manifest.version
            
            results.append(AppSyncResult(
                application_id=app.id,
                application_name=app.name,
                status="success",
                app_version=manifest.version,
                summary=summary
            ))
            successful += 1
            
        except httpx.HTTPError as e:
            results.append(AppSyncResult(
                application_id=app.id,
                application_name=app.name,
                status="error",
                error_message=f"HTTP error: {str(e)}"
            ))
            failed += 1
        except Exception as e:
            results.append(AppSyncResult(
                application_id=app.id,
                application_name=app.name,
                status="error",
                error_message=str(e)
            ))
            failed += 1
    
    await db.flush()
    
    return BulkSyncResponse(
        total_apps=len(applications),
        successful=successful,
        failed=failed,
        skipped=skipped,
        results=results
    )
