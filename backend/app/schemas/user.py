from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from app.models.user import UserTenantStatus
from app.schemas.common import BaseSchema
from app.schemas.role import RoleSummary


class UserBase(BaseSchema):
    """Base user schema."""

    email: EmailStr | None = None
    display_name: str | None = None
    metadata_: dict = Field(default_factory=dict, alias="metadata")

    @field_validator("metadata_", mode="before")
    @classmethod
    def ensure_dict(cls, v: Any) -> dict:
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        return dict(v) if hasattr(v, "__iter__") else {}


class UserCreate(UserBase):
    """Schema for creating a user."""

    external_subject: str | None = None


class UserUpdate(BaseSchema):
    """Schema for updating a user."""

    display_name: str | None = None
    status: str | None = None
    metadata_: dict | None = Field(None, alias="metadata")


class UserRead(UserBase):
    """Schema for reading user data."""

    id: UUID
    status: str
    external_subject: str | None = None
    created_at: datetime
    updated_at: datetime


class UserTenantBase(BaseSchema):
    """Base schema for user-tenant membership."""

    status: UserTenantStatus = UserTenantStatus.ACTIVE


class UserTenantCreate(UserTenantBase):
    """Schema for adding user to tenant."""

    user_id: UUID


class UserInvite(BaseSchema):
    """Schema for inviting a user to a tenant."""

    email: EmailStr = Field(..., description="Email do usuario a convidar")
    display_name: str | None = Field(None, description="Nome de exibicao")


class UserTenantRead(UserTenantBase):
    """Schema for reading user-tenant membership."""

    id: UUID
    user_id: UUID
    tenant_id: UUID
    invited_by: UUID | None = None
    joined_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Nested user info
    user: UserRead | None = None


class UserRoleBase(BaseSchema):
    """Base schema for user-role assignment."""

    role_id: UUID


class UserRoleAssign(BaseSchema):
    """Schema for assigning roles to a user."""

    role_ids: list[UUID] = Field(..., min_length=1)


class UserRoleRead(UserRoleBase):
    """Schema for reading user-role assignment."""

    id: UUID
    tenant_id: UUID
    user_id: UUID
    assigned_by: UUID | None = None
    assigned_at: datetime

    # Nested role info
    role: RoleSummary | None = None


class UserWithRoles(UserRead):
    """User with all roles in a tenant."""

    tenant_status: UserTenantStatus
    roles: list[RoleSummary] = []


class UserEffectivePermissions(BaseSchema):
    """User's effective permissions in a tenant."""

    user_id: UUID
    tenant_id: UUID
    roles: list[RoleSummary]
    permissions: list[str]
    applications: list[str]
