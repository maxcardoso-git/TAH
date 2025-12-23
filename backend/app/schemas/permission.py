from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.external_permission import PermissionLifecycle
from app.schemas.common import BaseSchema


class ExternalPermissionBase(BaseSchema):
    """Base schema for external permissions."""

    permission_key: str
    module_key: str
    module_name: str | None = None
    description: str | None = None


class ExternalPermissionRead(ExternalPermissionBase):
    """Schema for reading external permission data."""

    id: UUID
    application_id: str
    lifecycle: PermissionLifecycle
    first_seen_version: str | None = None
    last_seen_version: str | None = None
    discovered_at: datetime
    last_seen_at: datetime

    # Computed fields
    is_new: bool = False  # True if discovered recently


class RolePermissionBase(BaseSchema):
    """Base schema for role-permission assignments."""

    application_id: str
    permission_key: str


class RolePermissionCreate(RolePermissionBase):
    """Schema for granting a permission to a role."""

    pass


class RolePermissionRead(RolePermissionBase):
    """Schema for reading role-permission data."""

    id: UUID
    tenant_id: UUID
    role_id: UUID
    granted_by: UUID | None = None
    granted_at: datetime

    # Nested permission info (optional)
    permission_info: ExternalPermissionRead | None = None


class RolePermissionBatchUpdate(BaseSchema):
    """Schema for batch updating role permissions."""

    grant: list[RolePermissionCreate] = Field(
        default_factory=list,
        description="Permissions to grant",
    )
    revoke: list[RolePermissionCreate] = Field(
        default_factory=list,
        description="Permissions to revoke",
    )


class ModulePermissions(BaseSchema):
    """Permissions grouped by module for UI display."""

    module_key: str
    module_name: str | None = None
    permissions: list[ExternalPermissionRead]


class ApplicationPermissions(BaseSchema):
    """Permissions grouped by application for UI display."""

    application_id: str
    application_name: str
    modules: list[ModulePermissions]


class PermissionMatrixRead(BaseSchema):
    """
    Full permission matrix for a role.
    Used for the Permission Matrix UI component.
    """

    role_id: UUID
    role_name: str
    tenant_id: UUID
    applications: list[ApplicationPermissions]
    granted_permissions: list[str]  # List of permission_keys that are granted


class EffectivePermissions(BaseSchema):
    """User's effective permissions (computed from all roles)."""

    tenant_id: UUID
    user_id: UUID
    permissions: list[str]
    applications: list[str]
    roles: list[str]
