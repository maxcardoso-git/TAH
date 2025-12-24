from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema


class LoginRequest(BaseSchema):
    """Request for login with email and password."""

    email: str = Field(..., description="Email do usuário")
    password: str = Field(..., description="Senha do usuário")
    tenant_id: UUID | None = Field(None, description="Tenant para contexto (opcional)")


class AcceptInviteRequest(BaseSchema):
    """Request to accept an invite and set password."""

    token: str = Field(..., description="Token do convite")
    password: str = Field(..., min_length=6, description="Nova senha (min 6 caracteres)")


class TokenRequest(BaseSchema):
    """Request for token generation (for testing/development)."""

    user_id: UUID
    tenant_id: UUID | None = None
    roles: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)


class TokenResponse(BaseSchema):
    """Token response."""

    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseSchema):
    """Request to refresh access token."""

    refresh_token: str


class AccessContext(BaseSchema):
    """
    Runtime access context - returned to applications for authorization.
    This is the response from GET /api/v1/auth/context
    """

    tenant_id: str
    user_id: str
    roles: list[str]
    permissions: list[str]
    applications: list[str]


class UserInfo(BaseSchema):
    """Current user information."""

    user_id: UUID
    email: str | None = None
    display_name: str | None = None
    tenant_id: UUID | None = None
    roles: list[str] = []
