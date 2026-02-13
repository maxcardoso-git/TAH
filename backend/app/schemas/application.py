from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field, field_validator

from app.models.application import AppStatus
from app.schemas.common import BaseSchema


class ApplicationBase(BaseSchema):
    """Base application schema."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    logo_url: str | None = None
    icon: str | None = None
    base_url: str = Field(..., description="Base URL for the application API")
    callback_url: str | None = None
    launch_url: str | None = None
    features_manifest_url: str | None = Field(
        None,
        description="Custom URL for features manifest. If empty, uses {base_url}/api/v1/app-features/manifest",
    )
    healthcheck_url: str | None = None
    auth_mode: str = Field(default="platform_jwt")
    metadata_: dict = Field(default_factory=dict, alias="metadata")

    @field_validator("metadata_", mode="before")
    @classmethod
    def ensure_dict(cls, v: Any) -> dict:
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        return dict(v) if hasattr(v, "__iter__") else {}


class ApplicationCreate(ApplicationBase):
    """Schema for registering a new application."""

    id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=r"^[a-z0-9_]+$",
        description="Unique application identifier (e.g., orchestrator_ai)",
    )
    app_catalog_id: str = Field(..., description="App catalog entry ID")
    tenant_id: UUID | None = Field(None, description="Tenant ID (defaults to token tenant)")
    # Override: name is optional on create — falls back to catalog name
    name: str | None = Field(None, max_length=255)


class ApplicationUpdate(BaseSchema):
    """Schema for updating an application."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    logo_url: str | None = None
    icon: str | None = None
    base_url: str | None = None
    callback_url: str | None = None
    launch_url: str | None = None
    features_manifest_url: str | None = None
    healthcheck_url: str | None = None
    status: AppStatus | None = None
    auth_mode: str | None = None
    metadata_: dict | None = Field(None, alias="metadata")


class ApplicationRead(ApplicationBase):
    """Schema for reading application data."""

    id: str
    tenant_id: UUID
    app_catalog_id: str | None = None
    status: AppStatus
    current_version: str | None = None
    created_at: datetime
    updated_at: datetime

    # Computed fields
    permissions_count: int | None = None
    features_count: int | None = None
    last_sync_at: datetime | None = None
    sync_status: str | None = None


class ApplicationSummary(BaseSchema):
    """Minimal application info."""

    id: str
    name: str
    status: AppStatus
    current_version: str | None = None


# Tenant Application schemas
class TenantApplicationBase(BaseSchema):
    """Base schema for tenant-application relationship."""

    config: dict = Field(default_factory=dict)

    @field_validator("config", mode="before")
    @classmethod
    def ensure_config_dict(cls, v: Any) -> dict:
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        return dict(v) if hasattr(v, "__iter__") else {}


class TenantApplicationCreate(TenantApplicationBase):
    """Schema for enabling an application for a tenant."""

    application_id: str


class TenantApplicationUpdate(BaseSchema):
    """Schema for updating tenant-application settings."""

    status: AppStatus | None = None
    config: dict | None = None


class TenantApplicationRead(TenantApplicationBase):
    """Schema for reading tenant-application data."""

    id: UUID
    tenant_id: UUID
    application_id: str
    status: AppStatus
    enabled_at: datetime | None = None
    disabled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Nested application info
    application: ApplicationSummary | None = None


# Permission sync schemas
class PermissionSyncRequest(BaseSchema):
    """Request to trigger permission sync."""

    force: bool = Field(default=False, description="Force sync even if up to date")


class PermissionSyncResponse(BaseSchema):
    """Response from permission sync."""

    status: str
    app_version: str | None = None
    summary: dict = Field(default_factory=dict)
    error_message: str | None = None


class AppLauncherItem(BaseSchema):
    """Application entry shown in TAH app launcher."""

    id: str
    name: str
    description: str | None = None
    icon: str | None = None
    logo_url: str | None = None
    base_url: str
    launch_url: str | None = None
    callback_url: str | None = None
    status: AppStatus
    category: str | None = None


class AppLauncherResponse(BaseSchema):
    """Launcher payload scoped to current user and tenant."""

    tenant_id: str
    tenant_name: str
    current_user_id: str | None = None
    current_user_name: str | None = None
    current_user_email: str | None = None
    current_user_roles: list[str] = Field(default_factory=list)
    can_access_admin: bool = False
    applications: list[AppLauncherItem] = Field(default_factory=list)
