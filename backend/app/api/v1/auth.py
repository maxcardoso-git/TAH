from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentTenantId, CurrentUserId, DbSession, get_token_payload
from app.config import settings
from app.core.exceptions import NotFoundError
from app.core.security import TokenPayload, create_access_token, create_refresh_token
from app.models.role import Role, RolePermission
from app.models.user import User, UserRole, UserTenant
from app.schemas.auth import AccessContext, LoginRequest, TokenRequest, TokenResponse, UserInfo

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(db: DbSession, data: LoginRequest):
    """
    Login by email (development mode - no password required).
    Returns a JWT token for the user.
    WARNING: Only use in development/testing environments!
    """
    # Find user by email
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user:
        raise NotFoundError(detail=f"Usuário com email {data.email} não encontrado")

    # Get user's roles and permissions for the tenant (if provided)
    roles: list[str] = ["admin"]  # Default admin for dev
    permissions: list[str] = ["*"]

    if data.tenant_id:
        # Check if user is member of tenant
        membership = await db.scalar(
            select(UserTenant).where(
                UserTenant.user_id == user.id,
                UserTenant.tenant_id == data.tenant_id,
            )
        )
        if not membership:
            raise NotFoundError(detail=f"Usuário não é membro do tenant {data.tenant_id}")

        # Get user's roles in this tenant
        roles_query = (
            select(Role.name)
            .join(UserRole)
            .where(
                UserRole.tenant_id == data.tenant_id,
                UserRole.user_id == user.id,
                Role.deleted_at.is_(None),
            )
        )
        roles_result = await db.execute(roles_query)
        roles = list(roles_result.scalars().all()) or ["user"]

        # Get permissions from roles
        role_ids_query = select(UserRole.role_id).where(
            UserRole.tenant_id == data.tenant_id,
            UserRole.user_id == user.id,
        )
        role_ids_result = await db.execute(role_ids_query)
        role_ids = list(role_ids_result.scalars().all())

        if role_ids:
            perms_query = select(RolePermission.permission_key).where(
                RolePermission.role_id.in_(role_ids)
            )
            perms_result = await db.execute(perms_query)
            permissions = list(set(perms_result.scalars().all()))

    # Create tokens
    access_token = create_access_token(
        subject=str(user.id),
        tenant_id=str(data.tenant_id) if data.tenant_id else None,
        roles=roles,
        permissions=permissions,
    )

    refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/dev-token", response_model=TokenResponse)
async def create_dev_token(db: DbSession):
    """
    Generate a development token without authentication.
    Creates a demo user if it doesn't exist.
    WARNING: Only use in development/testing environments!
    """
    # Check if demo user exists
    demo_email = "demo@example.com"
    result = await db.execute(select(User).where(User.email == demo_email))
    user = result.scalar_one_or_none()

    if not user:
        # Create demo user
        user = User(
            email=demo_email,
            display_name="Demo User",
            status="active",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Create token with admin role
    access_token = create_access_token(
        subject=str(user.id),
        tenant_id=None,
        roles=["admin"],
        permissions=["*"],
    )

    refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/token", response_model=TokenResponse)
async def create_token(
    db: DbSession,
    data: TokenRequest,
):
    """
    Generate access token (for development/testing).
    In production, tokens would be issued by your OIDC provider.
    """
    # Create tokens
    access_token = create_access_token(
        subject=data.user_id,
        tenant_id=data.tenant_id,
        roles=data.roles,
        permissions=data.permissions,
    )

    refresh_token = create_refresh_token(subject=data.user_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/context", response_model=AccessContext)
async def get_access_context(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: Annotated[UUID, Depends(CurrentTenantId)],
):
    """
    Get runtime access context for the current user.
    This is the main endpoint consumed by applications to check permissions.

    Returns:
        - tenant_id: Current tenant context
        - user_id: Current user ID
        - roles: List of role names
        - permissions: List of permission keys
        - applications: List of enabled application IDs
    """
    user_id = UUID(token.user_id)

    # Get user's roles in this tenant
    roles_query = (
        select(Role.name)
        .join(UserRole)
        .where(
            UserRole.tenant_id == tenant_id,
            UserRole.user_id == user_id,
            Role.deleted_at.is_(None),
        )
    )
    roles_result = await db.execute(roles_query)
    role_names = list(roles_result.scalars().all())

    # Get role IDs for permission lookup
    role_ids_query = select(UserRole.role_id).where(
        UserRole.tenant_id == tenant_id,
        UserRole.user_id == user_id,
    )
    role_ids_result = await db.execute(role_ids_query)
    role_ids = list(role_ids_result.scalars().all())

    # Get all permissions from all roles
    permissions: list[str] = []
    applications: set[str] = set()

    if role_ids:
        perms_query = select(
            RolePermission.permission_key,
            RolePermission.application_id,
        ).where(RolePermission.role_id.in_(role_ids))

        perms_result = await db.execute(perms_query)
        for row in perms_result.all():
            permissions.append(row[0])
            applications.add(row[1])

    return AccessContext(
        tenant_id=str(tenant_id),
        user_id=str(user_id),
        roles=role_names,
        permissions=list(set(permissions)),
        applications=sorted(applications),
    )


@router.get("/me", response_model=UserInfo)
async def get_current_user(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
):
    """Get current user information from token."""
    user_id = UUID(token.user_id)

    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError(detail="User not found")

    return UserInfo(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        tenant_id=UUID(token.tenant_id) if token.tenant_id else None,
        roles=token.roles,
    )
