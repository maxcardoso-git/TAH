from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserId, DbSession, get_token_payload
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import TokenPayload
from app.models.role import Role
from app.models.tenant import Tenant, TenantStatus
from app.models.user import UserTenant
from app.schemas.common import PaginatedResponse
from app.schemas.tenant import TenantCreate, TenantRead, TenantUpdate

router = APIRouter()


@router.get("", response_model=PaginatedResponse[TenantRead])
async def list_tenants(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: TenantStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=100),
):
    """List all tenants with pagination and filtering."""
    # Build query
    query = select(Tenant).where(Tenant.deleted_at.is_(None))

    if status_filter:
        query = query.where(Tenant.status == status_filter)

    if search:
        query = query.where(
            Tenant.name.ilike(f"%{search}%") | Tenant.slug.ilike(f"%{search}%")
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination
    query = query.order_by(Tenant.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    tenants = result.scalars().all()

    # Convert to response
    items = [TenantRead.model_validate(t) for t in tenants]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=TenantRead, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    data: TenantCreate,
):
    """Create a new tenant."""
    # Check for slug conflict
    if data.slug:
        existing = await db.scalar(
            select(Tenant).where(Tenant.slug == data.slug)
        )
        if existing:
            raise ConflictError(detail=f"Tenant with slug '{data.slug}' already exists")

    # Create tenant
    tenant = Tenant(
        name=data.name,
        slug=data.slug,
        metadata_=data.metadata_,
        status=TenantStatus.ACTIVE,
    )
    db.add(tenant)
    await db.flush()
    await db.refresh(tenant)

    return TenantRead.model_validate(tenant)


@router.get("/{tenant_id}", response_model=TenantRead)
async def get_tenant(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
):
    """Get tenant by ID."""
    tenant = await db.get(Tenant, tenant_id)

    if not tenant or tenant.deleted_at:
        raise NotFoundError(detail=f"Tenant {tenant_id} not found")

    # Get counts
    users_count = await db.scalar(
        select(func.count()).where(UserTenant.tenant_id == tenant_id)
    )
    roles_count = await db.scalar(
        select(func.count()).where(Role.tenant_id == tenant_id, Role.deleted_at.is_(None))
    )

    result = TenantRead.model_validate(tenant)
    result.users_count = users_count
    result.roles_count = roles_count

    return result


@router.patch("/{tenant_id}", response_model=TenantRead)
async def update_tenant(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    data: TenantUpdate,
):
    """Update an existing tenant."""
    tenant = await db.get(Tenant, tenant_id)

    if not tenant or tenant.deleted_at:
        raise NotFoundError(detail=f"Tenant {tenant_id} not found")

    # Check for slug conflict
    if data.slug and data.slug != tenant.slug:
        existing = await db.scalar(
            select(Tenant).where(Tenant.slug == data.slug, Tenant.id != tenant_id)
        )
        if existing:
            raise ConflictError(detail=f"Tenant with slug '{data.slug}' already exists")

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)

    await db.flush()
    await db.refresh(tenant)

    return TenantRead.model_validate(tenant)


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
):
    """Soft delete a tenant."""
    tenant = await db.get(Tenant, tenant_id)

    if not tenant or tenant.deleted_at:
        raise NotFoundError(detail=f"Tenant {tenant_id} not found")

    # Soft delete
    from datetime import datetime, timezone

    tenant.deleted_at = datetime.now(timezone.utc)
    tenant.status = TenantStatus.DELETED

    await db.flush()
