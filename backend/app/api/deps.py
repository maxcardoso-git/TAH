from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import TokenPayload, decode_token
from app.database import get_db

# Security scheme
security = HTTPBearer(auto_error=False)


async def get_token_payload(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> TokenPayload:
    """
    Dependency to extract and validate JWT token from Authorization header.
    """
    if not credentials:
        raise UnauthorizedError(detail="Missing authorization header")

    token = credentials.credentials
    payload = decode_token(token)
    return TokenPayload(payload)


async def get_current_user_id(
    token: Annotated[TokenPayload, Depends(get_token_payload)],
) -> UUID:
    """Get current user ID from token."""
    try:
        return UUID(token.user_id)
    except ValueError:
        raise UnauthorizedError(detail="Invalid user ID in token")


async def get_current_tenant_id(
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    x_tenant_id: Annotated[str | None, Header()] = None,
) -> UUID:
    """
    Get current tenant ID from token or header.
    Header takes precedence if user has access to multiple tenants.
    """
    tenant_id_str = x_tenant_id or token.tenant_id

    if not tenant_id_str:
        raise ForbiddenError(detail="No tenant context provided")

    try:
        return UUID(tenant_id_str)
    except ValueError:
        raise ForbiddenError(detail="Invalid tenant ID")


async def get_optional_tenant_id(
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    x_tenant_id: Annotated[str | None, Header()] = None,
) -> UUID | None:
    """Get optional tenant ID (for platform-level operations)."""
    tenant_id_str = x_tenant_id or token.tenant_id

    if not tenant_id_str:
        return None

    try:
        return UUID(tenant_id_str)
    except ValueError:
        return None


class PermissionChecker:
    """Dependency class to check for required permissions."""

    def __init__(self, required_permissions: list[str], require_all: bool = True):
        self.required_permissions = required_permissions
        self.require_all = require_all

    async def __call__(
        self,
        token: Annotated[TokenPayload, Depends(get_token_payload)],
    ) -> TokenPayload:
        if self.require_all:
            if not token.has_all_permissions(self.required_permissions):
                raise ForbiddenError(
                    detail=f"Missing required permissions: {self.required_permissions}"
                )
        else:
            if not token.has_any_permission(self.required_permissions):
                raise ForbiddenError(
                    detail=f"Missing any of required permissions: {self.required_permissions}"
                )
        return token


class RoleChecker:
    """Dependency class to check for required roles."""

    def __init__(self, required_roles: list[str], require_all: bool = False):
        self.required_roles = required_roles
        self.require_all = require_all

    async def __call__(
        self,
        token: Annotated[TokenPayload, Depends(get_token_payload)],
    ) -> TokenPayload:
        has_roles = [token.has_role(role) for role in self.required_roles]

        if self.require_all and not all(has_roles):
            raise ForbiddenError(detail=f"Missing required roles: {self.required_roles}")
        elif not any(has_roles):
            raise ForbiddenError(detail=f"Missing any of required roles: {self.required_roles}")

        return token


def require_permissions(*permissions: str, require_all: bool = True):
    """Decorator-style permission checker."""
    return Depends(PermissionChecker(list(permissions), require_all))


def require_roles(*roles: str, require_all: bool = False):
    """Decorator-style role checker."""
    return Depends(RoleChecker(list(roles), require_all))


# Common dependency annotations
DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentToken = Annotated[TokenPayload, Depends(get_token_payload)]
CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
CurrentTenantId = Annotated[UUID, Depends(get_current_tenant_id)]
OptionalTenantId = Annotated[UUID | None, Depends(get_optional_tenant_id)]
