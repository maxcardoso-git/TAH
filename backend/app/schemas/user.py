from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field

from app.models.user import UserTenantStatus
from app.schemas.common import BaseSchema
from app.schemas.role import RoleSummary


class UserBase(BaseSchema):
    """Base user schema."""

    email: EmailStr | None = None
    display_name: str | None = None
    metadata_: dict = Field(default_factory=dict, alias="metadata")


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
