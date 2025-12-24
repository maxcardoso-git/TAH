from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUserId, DbSession, get_token_payload
from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.core.security import TokenPayload
from app.models.role import Role, RolePermission
from app.models.user import User, UserRole, UserTenant, UserTenantStatus
from app.schemas.common import PaginatedResponse
from app.schemas.permission import EffectivePermissions
from app.schemas.role import RoleSummary
from app.schemas.user import UserInvite, UserRoleAssign, UserRoleRead, UserTenantRead, UserWithRoles

router = APIRouter()


@router.get("", response_model=PaginatedResponse[UserWithRoles])
async def list_tenant_users(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: UserTenantStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=100),
):
    """List all users in a tenant."""
    # Build query for user_tenants
    query = (
        select(UserTenant)
        .options(selectinload(UserTenant.user))
        .where(UserTenant.tenant_id == tenant_id)
    )

    if status_filter:
        query = query.where(UserTenant.status == status_filter)

    if search:
        # Join with users and filter
        query = query.join(User).where(
            User.email.ilike(f"%{search}%") | User.display_name.ilike(f"%{search}%")
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination
    query = query.order_by(UserTenant.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    user_tenants = result.scalars().all()

    # Build response with roles
    items = []
    for ut in user_tenants:
        # Get user's roles in this tenant
        roles_query = (
            select(Role)
            .join(UserRole)
            .where(
                UserRole.tenant_id == tenant_id,
                UserRole.user_id == ut.user_id,
                Role.deleted_at.is_(None),
            )
        )
        roles_result = await db.execute(roles_query)
        roles = roles_result.scalars().all()

        user_data = UserWithRoles.model_validate(ut.user)
        user_data.tenant_status = ut.status
        user_data.roles = [RoleSummary.model_validate(r) for r in roles]
        items.append(user_data)

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/invite", response_model=UserWithRoles, status_code=status.HTTP_201_CREATED)
async def invite_user_to_tenant(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    data: UserInvite,
):
    """Invite a user to the tenant by email."""
    # Check if user already exists
    existing_user = await db.scalar(
        select(User).where(User.email == data.email)
    )

    if existing_user:
        # Check if already member of tenant
        existing_membership = await db.scalar(
            select(UserTenant).where(
                UserTenant.tenant_id == tenant_id,
                UserTenant.user_id == existing_user.id,
            )
        )
        if existing_membership:
            raise ConflictError(detail=f"User {data.email} is already a member of this tenant")
        user = existing_user
    else:
        # Create new user
        user = User(
            email=data.email,
            display_name=data.display_name,
            status="active",
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    # Create tenant membership
    inviter_id = UUID(token.user_id) if token.user_id else None
    user_tenant = UserTenant(
        tenant_id=tenant_id,
        user_id=user.id,
        status=UserTenantStatus.INVITED,
        invited_by=inviter_id,
    )
    db.add(user_tenant)
    await db.flush()

    # Return user with roles (empty for new invite)
    user_data = UserWithRoles.model_validate(user)
    user_data.tenant_status = UserTenantStatus.INVITED
    user_data.roles = []
    return user_data


@router.get("/{user_id}/roles", response_model=list[UserRoleRead])
async def list_user_roles(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    user_id: UUID,
):
    """List all roles assigned to a user in a tenant."""
    # Verify user is member of tenant
    user_tenant = await db.scalar(
        select(UserTenant).where(
            UserTenant.tenant_id == tenant_id,
            UserTenant.user_id == user_id,
        )
    )
    if not user_tenant:
        raise NotFoundError(detail=f"User {user_id} not found in tenant")

    # Get user roles
    query = (
        select(UserRole)
        .options(selectinload(UserRole.role))
        .where(
            UserRole.tenant_id == tenant_id,
            UserRole.user_id == user_id,
        )
    )

    result = await db.execute(query)
    user_roles = result.scalars().all()

    return [
        UserRoleRead(
            id=ur.id,
            tenant_id=ur.tenant_id,
            user_id=ur.user_id,
            role_id=ur.role_id,
            assigned_by=ur.assigned_by,
            assigned_at=ur.assigned_at,
            role=RoleSummary.model_validate(ur.role) if ur.role else None,
        )
        for ur in user_roles
    ]


@router.post("/{user_id}/roles", response_model=list[UserRoleRead], status_code=status.HTTP_201_CREATED)
async def assign_roles_to_user(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    user_id: UUID,
    data: UserRoleAssign,
):
    """Assign roles to a user in a tenant."""
    # Verify user is member of tenant
    user_tenant = await db.scalar(
        select(UserTenant).where(
            UserTenant.tenant_id == tenant_id,
            UserTenant.user_id == user_id,
        )
    )
    if not user_tenant:
        raise NotFoundError(detail=f"User {user_id} not found in tenant")

    # Verify all roles exist and belong to tenant
    roles_query = select(Role).where(
        Role.id.in_(data.role_ids),
        Role.tenant_id == tenant_id,
        Role.deleted_at.is_(None),
    )
    roles_result = await db.execute(roles_query)
    found_roles = {r.id: r for r in roles_result.scalars().all()}

    missing_roles = set(data.role_ids) - set(found_roles.keys())
    if missing_roles:
        raise BadRequestError(detail=f"Roles not found: {missing_roles}")

    # Assign roles (skip duplicates)
    assigner_id = UUID(token.user_id) if token.user_id else None

    for role_id in data.role_ids:
        existing = await db.scalar(
            select(UserRole).where(
                UserRole.tenant_id == tenant_id,
                UserRole.user_id == user_id,
                UserRole.role_id == role_id,
            )
        )
        if not existing:
            user_role = UserRole(
                tenant_id=tenant_id,
                user_id=user_id,
                role_id=role_id,
                assigned_by=assigner_id,
            )
            db.add(user_role)

    await db.flush()

    # Return updated roles list
    return await list_user_roles(db, token, tenant_id, user_id)


@router.delete("/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unassign_role_from_user(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    user_id: UUID,
    role_id: UUID,
):
    """Remove a role from a user in a tenant."""
    result = await db.execute(
        delete(UserRole).where(
            UserRole.tenant_id == tenant_id,
            UserRole.user_id == user_id,
            UserRole.role_id == role_id,
        )
    )

    if result.rowcount == 0:
        raise NotFoundError(detail="Role assignment not found")

    await db.flush()


@router.get("/{user_id}/effective-permissions", response_model=EffectivePermissions)
async def get_user_effective_permissions(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    user_id: UUID,
):
    """
    Get user's effective permissions computed from all assigned roles.
    This is the union of all permissions from all roles.
    """
    # Verify user is member of tenant
    user_tenant = await db.scalar(
        select(UserTenant).where(
            UserTenant.tenant_id == tenant_id,
            UserTenant.user_id == user_id,
        )
    )
    if not user_tenant:
        raise NotFoundError(detail=f"User {user_id} not found in tenant")

    # Get all role IDs for user
    user_roles_query = select(UserRole.role_id).where(
        UserRole.tenant_id == tenant_id,
        UserRole.user_id == user_id,
    )
    user_roles_result = await db.execute(user_roles_query)
    role_ids = list(user_roles_result.scalars().all())

    # Get role names
    roles_query = select(Role.name).where(Role.id.in_(role_ids))
    roles_result = await db.execute(roles_query)
    role_names = list(roles_result.scalars().all())

    # Get all permissions from all roles
    perms_query = select(
        RolePermission.permission_key,
        RolePermission.application_id,
    ).where(RolePermission.role_id.in_(role_ids))

    perms_result = await db.execute(perms_query)
    perms_rows = perms_result.all()

    # Aggregate unique permissions and applications
    permissions = list(set(row[0] for row in perms_rows))
    applications = list(set(row[1] for row in perms_rows))

    return EffectivePermissions(
        tenant_id=tenant_id,
        user_id=user_id,
        permissions=sorted(permissions),
        applications=sorted(applications),
        roles=role_names,
    )
