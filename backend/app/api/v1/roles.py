from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserId, DbSession, get_token_payload
from app.core.exceptions import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.core.security import TokenPayload
from app.models.role import Role, RolePermission, RoleStatus
from app.models.user import UserRole
from app.schemas.common import PaginatedResponse
from app.schemas.role import RoleCreate, RoleDuplicate, RoleRead, RoleUpdate, RoleWithPermissions

router = APIRouter()


@router.get("", response_model=PaginatedResponse[RoleRead])
async def list_roles(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: RoleStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=100),
):
    """List all roles for a tenant."""
    query = select(Role).where(
        Role.tenant_id == tenant_id,
        Role.deleted_at.is_(None),
    )

    if status_filter:
        query = query.where(Role.status == status_filter)

    if search:
        query = query.where(Role.name.ilike(f"%{search}%"))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination
    query = query.order_by(Role.is_system.desc(), Role.name)
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    roles = result.scalars().all()

    # Get counts for each role
    items = []
    for role in roles:
        perm_count = await db.scalar(
            select(func.count()).where(RolePermission.role_id == role.id)
        )
        users_count = await db.scalar(
            select(func.count()).where(UserRole.role_id == role.id)
        )

        item = RoleRead.model_validate(role)
        item.permissions_count = perm_count
        item.users_count = users_count
        items.append(item)

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
async def create_role(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    data: RoleCreate,
):
    """Create a new role for a tenant."""
    # Check for duplicate name
    existing = await db.scalar(
        select(Role).where(
            Role.tenant_id == tenant_id,
            Role.name == data.name,
            Role.deleted_at.is_(None),
        )
    )
    if existing:
        raise ConflictError(detail=f"Role '{data.name}' already exists")

    # Create role
    role = Role(
        tenant_id=tenant_id,
        name=data.name,
        description=data.description,
        metadata_=data.metadata_,
        status=RoleStatus.ACTIVE,
        is_system=False,
        created_by=UUID(token.user_id) if token.user_id else None,
    )
    db.add(role)
    await db.flush()
    await db.refresh(role)

    result = RoleRead.model_validate(role)
    result.permissions_count = 0
    result.users_count = 0

    return result


@router.get("/{role_id}", response_model=RoleWithPermissions)
async def get_role(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    role_id: UUID,
):
    """Get role by ID with all permissions."""
    role = await db.get(Role, role_id)

    if not role or role.deleted_at or role.tenant_id != tenant_id:
        raise NotFoundError(detail=f"Role {role_id} not found")

    # Get permissions
    perm_query = select(RolePermission).where(RolePermission.role_id == role_id)
    perm_result = await db.execute(perm_query)
    permissions = perm_result.scalars().all()

    # Get counts
    users_count = await db.scalar(
        select(func.count()).where(UserRole.role_id == role_id)
    )

    result = RoleWithPermissions.model_validate(role)
    result.permissions_count = len(permissions)
    result.users_count = users_count
    result.permissions = permissions

    return result


@router.patch("/{role_id}", response_model=RoleRead)
async def update_role(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    role_id: UUID,
    data: RoleUpdate,
):
    """Update a role."""
    role = await db.get(Role, role_id)

    if not role or role.deleted_at or role.tenant_id != tenant_id:
        raise NotFoundError(detail=f"Role {role_id} not found")

    # Cannot modify system roles
    if role.is_system:
        raise ForbiddenError(detail="Cannot modify system roles")

    # Check for duplicate name
    if data.name and data.name != role.name:
        existing = await db.scalar(
            select(Role).where(
                Role.tenant_id == tenant_id,
                Role.name == data.name,
                Role.deleted_at.is_(None),
                Role.id != role_id,
            )
        )
        if existing:
            raise ConflictError(detail=f"Role '{data.name}' already exists")

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(role, field, value)

    await db.flush()
    await db.refresh(role)

    return RoleRead.model_validate(role)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    role_id: UUID,
):
    """Soft delete a role."""
    role = await db.get(Role, role_id)

    if not role or role.deleted_at or role.tenant_id != tenant_id:
        raise NotFoundError(detail=f"Role {role_id} not found")

    # Cannot delete system roles
    if role.is_system:
        raise ForbiddenError(detail="Cannot delete system roles")

    # Check if role has users
    users_count = await db.scalar(
        select(func.count()).where(UserRole.role_id == role_id)
    )
    if users_count and users_count > 0:
        raise BadRequestError(
            detail=f"Cannot delete role with {users_count} assigned users"
        )

    # Soft delete
    role.deleted_at = datetime.now(timezone.utc)
    role.status = RoleStatus.DELETED

    await db.flush()


@router.post("/{role_id}/duplicate", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
async def duplicate_role(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    role_id: UUID,
    data: RoleDuplicate,
):
    """Duplicate a role with its permissions."""
    source_role = await db.get(Role, role_id)

    if not source_role or source_role.deleted_at or source_role.tenant_id != tenant_id:
        raise NotFoundError(detail=f"Role {role_id} not found")

    # Check for duplicate name
    existing = await db.scalar(
        select(Role).where(
            Role.tenant_id == tenant_id,
            Role.name == data.new_name,
            Role.deleted_at.is_(None),
        )
    )
    if existing:
        raise ConflictError(detail=f"Role '{data.new_name}' already exists")

    # Create new role
    new_role = Role(
        tenant_id=tenant_id,
        name=data.new_name,
        description=data.description or source_role.description,
        metadata_=source_role.metadata_.copy(),
        status=RoleStatus.ACTIVE,
        is_system=False,
        created_by=UUID(token.user_id) if token.user_id else None,
    )
    db.add(new_role)
    await db.flush()

    # Copy permissions if requested
    perm_count = 0
    if data.include_permissions:
        perm_query = select(RolePermission).where(RolePermission.role_id == role_id)
        perm_result = await db.execute(perm_query)
        source_permissions = perm_result.scalars().all()

        for perm in source_permissions:
            new_perm = RolePermission(
                tenant_id=tenant_id,
                role_id=new_role.id,
                application_id=perm.application_id,
                permission_key=perm.permission_key,
                granted_by=UUID(token.user_id) if token.user_id else None,
            )
            db.add(new_perm)
            perm_count += 1

        await db.flush()

    await db.refresh(new_role)

    result = RoleRead.model_validate(new_role)
    result.permissions_count = perm_count
    result.users_count = 0

    return result
