from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.role import RoleStatus
from app.schemas.common import BaseSchema


class RoleBase(BaseSchema):
    """Base role schema."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    metadata_: dict = Field(default_factory=dict, alias="metadata")


class RoleCreate(RoleBase):
    """Schema for creating a new role."""

    pass


class RoleUpdate(BaseSchema):
    """Schema for updating a role."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    status: RoleStatus | None = None
    metadata_: dict | None = Field(None, alias="metadata")


class RoleDuplicate(BaseSchema):
    """Schema for duplicating a role."""

    new_name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    include_permissions: bool = Field(
        default=True,
        description="Copy permissions from source role",
    )


class RoleRead(RoleBase):
    """Schema for reading role data."""

    id: UUID
    tenant_id: UUID
    status: RoleStatus
    is_system: bool
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    # Computed fields
    permissions_count: int | None = None
    users_count: int | None = None


class RoleSummary(BaseSchema):
    """Minimal role info for references."""

    id: UUID
    name: str
    status: RoleStatus
    is_system: bool


class RoleWithPermissions(RoleRead):
    """Role with all its permissions."""

    permissions: list["RolePermissionRead"] = []


# Avoid circular import
from app.schemas.permission import RolePermissionRead  # noqa: E402

RoleWithPermissions.model_rebuild()
