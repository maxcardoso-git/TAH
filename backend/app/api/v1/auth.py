from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentTenantId, CurrentUserId, DbSession, get_token_payload
from app.config import settings
from app.core.exceptions import BadRequestError, NotFoundError, UnauthorizedError
from app.core.security import (
    decode_token,
    TokenPayload,
    create_access_token,
    create_app_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
)
from app.models.role import Role, RolePermission
from app.models.user import User, UserRole, UserTenant, UserTenantStatus
from app.models.application import Application, TenantApplication, TenantAppOrgMapping, AppStatus
from app.models.app_catalog import AppCatalog
from app.models.tenant import Tenant
from app.schemas.application import AppLauncherItem, AppLauncherResponse
from app.schemas.auth import (
    CheckEmailRequest,
    CheckEmailResponse,
    SetPasswordRequest,
    RefreshTokenRequest,
    AcceptInviteRequest,
    AccessContext,
    AppTokenRequest,
    AppTokenResponse,
    LoginRequest,
    TokenRequest,
    TokenResponse,
    UserInfo,
)

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(db: DbSession, data: LoginRequest):
    """
    Login with email and password.
    Returns a JWT token for the user.
    """
    # Find user by email
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedError(detail="Email ou senha inválidos")

    # Check if user has password set
    if not user.password_hash:
        raise UnauthorizedError(detail="Usuário não configurou senha. Verifique seu convite.")

    # Verify password
    if not verify_password(data.password, user.password_hash):
        raise UnauthorizedError(detail="Email ou senha inválidos")

    # Check user status
    if user.status != "active":
        raise UnauthorizedError(detail="Usuário inativo. Entre em contato com o administrador.")

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


@router.post("/accept-invite", response_model=TokenResponse)
async def accept_invite(db: DbSession, data: AcceptInviteRequest):
    """
    Accept an invite and set user password.
    Returns a JWT token after successful password setup.
    """
    # Find the invite by token
    result = await db.execute(
        select(UserTenant).where(UserTenant.invite_token == data.token)
    )
    user_tenant = result.scalar_one_or_none()

    if not user_tenant:
        raise NotFoundError(detail="Convite não encontrado ou inválido")

    # Check if invite is expired
    if user_tenant.invite_expires_at and user_tenant.invite_expires_at < datetime.utcnow():
        raise BadRequestError(detail="Convite expirado. Solicite um novo convite ao administrador.")

    # Check if already accepted
    if user_tenant.status != UserTenantStatus.INVITED:
        raise BadRequestError(detail="Convite já foi utilizado")

    # Get the user
    user = await db.get(User, user_tenant.user_id)
    if not user:
        raise NotFoundError(detail="Usuário não encontrado")

    # Set password and activate user
    user.password_hash = get_password_hash(data.password)
    user.status = "active"

    # Update tenant membership
    user_tenant.status = UserTenantStatus.ACTIVE
    user_tenant.joined_at = datetime.utcnow()
    user_tenant.invite_token = None  # Invalidate token

    await db.commit()
    await db.refresh(user)

    # Create tokens
    access_token = create_access_token(
        subject=str(user.id),
        tenant_id=str(user_tenant.tenant_id),
        roles=["user"],  # Default role for new users
        permissions=[],
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
    Creates a demo user if it doesn't exist (password: demo123).
    WARNING: Only use in development/testing environments!
    """
    # Check if demo user exists
    demo_email = "demo@example.com"
    demo_password = "demo123"
    result = await db.execute(select(User).where(User.email == demo_email))
    user = result.scalar_one_or_none()

    if not user:
        # Create demo user with password
        user = User(
            email=demo_email,
            display_name="Demo User",
            status="active",
            password_hash=get_password_hash(demo_password),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif not user.password_hash:
        # Set password if user exists but has no password
        user.password_hash = get_password_hash(demo_password)
        await db.commit()

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






@router.get("/apps", response_model=AppLauncherResponse)
async def get_available_apps(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID | None = None,
):
    """
    Get available applications for the current user's tenant.
    Used by the App Launcher to display available apps.
    
    Args:
        tenant_id: Optional tenant ID (query param). Uses token.tenant_id if not provided.
    """
    # Get tenant_id from query param or token
    effective_tenant_id = tenant_id or (UUID(token.tenant_id) if token.tenant_id else None)
    
    if not effective_tenant_id:
        raise BadRequestError(detail="No tenant context. Please provide tenant_id or select a tenant first.")
    
    tenant_id = effective_tenant_id
    user_id = UUID(token.user_id)
    
    # Get tenant info
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise NotFoundError(detail="Tenant not found")
    
    # Verify user is member of tenant
    membership = await db.scalar(
        select(UserTenant).where(
            UserTenant.user_id == user_id,
            UserTenant.tenant_id == tenant_id,
        )
    )
    if not membership:
        raise NotFoundError(detail="User is not a member of this tenant")
    
    # Get enabled applications for this tenant
    query = (
        select(Application, AppCatalog.category)
        .join(TenantApplication, TenantApplication.application_id == Application.id).outerjoin(AppCatalog, AppCatalog.id == Application.app_catalog_id)
        .where(
            TenantApplication.tenant_id == tenant_id,
            TenantApplication.status == AppStatus.ACTIVE,
            Application.status == AppStatus.ACTIVE,
        )
        .order_by(Application.name)
    )
    
    result = await db.execute(query)
    applications = result.all()
    
    # Convert to launcher items
    app_items = [
        AppLauncherItem(
            id=app.id,
            name=app.name,
            description=app.description,
            icon=app.icon,
            base_url=app.base_url,
            launch_url=app.launch_url,
            callback_url=app.callback_url,
            logo_url=app.logo_url,
            status=app.status,
            category=category,
        )
        for app, category in applications
    ]
    
    return AppLauncherResponse(
        tenant_id=str(tenant_id),
        tenant_name=tenant.name,
        applications=app_items,
    )


@router.post("/app-token", response_model=AppTokenResponse)
async def create_application_token(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    data: AppTokenRequest,
):
    """
    Generate an RS256 signed token for accessing external applications.
    
    This endpoint is called when a user wants to access an external application
    (like OrchestratorAI). The token includes:
    - User identity (id, email, name)
    - Tenant/Org context
    - Roles and permissions for the target application
    
    External applications validate this token using TAH's JWKS endpoint.
    """
    user_id = UUID(token.user_id)
    
    # Get user info
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError(detail="User not found")
    
    # Get tenant_id from request or token
    tenant_id = data.tenant_id or (UUID(token.tenant_id) if token.tenant_id else None)
    
    if not tenant_id:
        raise BadRequestError(detail="tenant_id is required")
    
    # Verify user is member of tenant
    membership = await db.scalar(
        select(UserTenant).where(
            UserTenant.user_id == user_id,
            UserTenant.tenant_id == tenant_id,
        )
    )
    if not membership:
        raise NotFoundError(detail=f"User is not a member of tenant {tenant_id}")
    
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
    roles = list(roles_result.scalars().all()) or ["user"]
    
    # Get permissions for the target application
    role_ids_query = select(UserRole.role_id).where(
        UserRole.tenant_id == tenant_id,
        UserRole.user_id == user_id,
    )
    role_ids_result = await db.execute(role_ids_query)
    role_ids = list(role_ids_result.scalars().all())
    
    permissions: list[str] = []
    if role_ids:
        # Filter permissions for the target application
        perms_query = select(RolePermission.permission_key).where(
            RolePermission.role_id.in_(role_ids),
            RolePermission.application_id == data.application_id,
        )
        perms_result = await db.execute(perms_query)
        permissions = list(set(perms_result.scalars().all()))
    # Look up org_id mapping for this tenant + application
    org_mapping = await db.scalar(
        select(TenantAppOrgMapping).where(
            TenantAppOrgMapping.tenant_id == tenant_id,
            TenantAppOrgMapping.application_id == data.application_id,
        )
    )
    # Use mapped org_id if exists, otherwise fallback to tenant_id
    org_id = org_mapping.remote_org_id if org_mapping else str(tenant_id)

    
    # Create RS256 token for the application
    app_access_token = create_app_token(
        subject=str(user.id),
        email=user.email,
        name=user.display_name,
        tenant_id=str(tenant_id),
        org_id=org_id,  # From mapping or tenant_id fallback
        roles=roles,
        permissions=permissions,
        audience=data.application_id,  # The target app is the audience
    )
    
    return AppTokenResponse(
        access_token=app_access_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        application_id=data.application_id,
        permissions=permissions,
    )


@router.get("/userinfo", response_model=UserInfo)
async def get_userinfo(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
):
    """
    OpenID Connect UserInfo endpoint.
    Returns user information based on the access token.
    """
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


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(db: DbSession, data: RefreshTokenRequest):
    """
    Refresh access token using a valid refresh token.
    Returns a new access token and optionally a new refresh token.
    """
    
    try:
        # Decode and validate refresh token
        payload = decode_token(data.refresh_token)
    except Exception:
        raise UnauthorizedError(detail="Token inválido ou expirado")
    
    # Verify it's a refresh token
    if payload.get("type") != "refresh":
        raise UnauthorizedError(detail="Token inválido. Use um refresh token.")
    
    # Get user from database
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError(detail="Token inválido")
    
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    
    if not user:
        raise UnauthorizedError(detail="Usuário não encontrado")
    
    # Check user status
    if user.status != "active":
        raise UnauthorizedError(detail="Usuário inativo")
    
    # Get user's first tenant membership for default context
    tenant_query = select(UserTenant).where(
        UserTenant.user_id == user.id,
        UserTenant.status == UserTenantStatus.ACTIVE,
    ).limit(1)
    tenant_result = await db.execute(tenant_query)
    user_tenant = tenant_result.scalar_one_or_none()
    
    tenant_id = user_tenant.tenant_id if user_tenant else None
    
    # Get roles and permissions if tenant context exists
    roles: list[str] = ["user"]
    permissions: list[str] = []
    
    if tenant_id:
        # Get user's roles in this tenant
        roles_query = (
            select(Role.name)
            .join(UserRole)
            .where(
                UserRole.tenant_id == tenant_id,
                UserRole.user_id == user.id,
                Role.deleted_at.is_(None),
            )
        )
        roles_result = await db.execute(roles_query)
        roles = list(roles_result.scalars().all()) or ["user"]
        
        # Get permissions from roles
        role_ids_query = select(UserRole.role_id).where(
            UserRole.tenant_id == tenant_id,
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
    
    # Create new tokens
    access_token = create_access_token(
        subject=str(user.id),
        tenant_id=str(tenant_id) if tenant_id else None,
        roles=roles,
        permissions=permissions,
    )
    
    # Issue new refresh token (token rotation for security)
    new_refresh_token = create_refresh_token(subject=str(user.id))
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )




@router.post("/check-email", response_model=CheckEmailResponse)
async def check_email(db: DbSession, data: CheckEmailRequest):
    """
    Check if email exists and has password set.
    Used for two-step login flow.
    """
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user:
        return CheckEmailResponse(
            exists=False,
            has_password=False,
            status=None,
        )
    
    return CheckEmailResponse(
        exists=True,
        has_password=bool(user.password_hash),
        status=user.status,
    )


@router.post("/set-password", response_model=TokenResponse)
async def set_first_password(db: DbSession, data: SetPasswordRequest):
    """
    Set password for a user who doesn't have one yet (first login).
    Returns tokens for automatic login after setting password.
    """
    # Find user by email
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user:
        raise NotFoundError(detail="Usuário não encontrado")
    
    # Check if user already has password
    if user.password_hash:
        raise BadRequestError(detail="Usuário já possui senha cadastrada. Use o login normal.")
    
    # Set password and activate user
    user.password_hash = get_password_hash(data.password)
    user.status = "active"
    
    await db.commit()
    await db.refresh(user)
    
    # Get user's first tenant membership for context
    tenant_query = select(UserTenant).where(
        UserTenant.user_id == user.id,
    ).limit(1)
    tenant_result = await db.execute(tenant_query)
    user_tenant = tenant_result.scalar_one_or_none()
    
    tenant_id = user_tenant.tenant_id if user_tenant else None
    
    # Update tenant membership status if exists
    if user_tenant and user_tenant.status == UserTenantStatus.INVITED:
        user_tenant.status = UserTenantStatus.ACTIVE
        user_tenant.joined_at = datetime.utcnow()
        await db.commit()
    
    # Get roles
    roles: list[str] = ["user"]
    permissions: list[str] = []
    
    if tenant_id:
        roles_query = (
            select(Role.name)
            .join(UserRole)
            .where(
                UserRole.tenant_id == tenant_id,
                UserRole.user_id == user.id,
                Role.deleted_at.is_(None),
            )
        )
        roles_result = await db.execute(roles_query)
        roles = list(roles_result.scalars().all()) or ["user"]
    
    # Create tokens
    access_token = create_access_token(
        subject=str(user.id),
        tenant_id=str(tenant_id) if tenant_id else None,
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
