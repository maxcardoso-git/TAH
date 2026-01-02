from datetime import datetime

from pydantic import Field

from app.models.app_feature import FeatureLifecycle
from app.schemas.common import BaseSchema


# ==================== Manifest Schemas ====================


class ManifestModule(BaseSchema):
    """Module definition in manifest."""

    id: str
    name: str
    description: str | None = None
    granted: bool = False
    display_order: int = 0


class ManifestFeature(BaseSchema):
    """Feature definition in manifest."""

    id: str  # e.g., "orchestrator.projects"
    name: str
    description: str | None = None
    granted: bool = False
    module: str  # e.g., "core"
    subcategory: str | None = None
    parent_id: str | None = None
    path: str  # e.g., "/projects"
    icon: str | None = None
    actions: list[str] = Field(default=["read"])
    display_order: int = 0
    is_public: bool = False
    requires_org: bool = True


class AppFeaturesManifest(BaseSchema):
    """Complete manifest from an application."""

    app_id: str
    app_name: str
    version: str
    modules: list[ManifestModule]
    features: list[ManifestFeature]
    generated_at: datetime | None = None


# ==================== CRUD Schemas ====================


class AppFeatureBase(BaseSchema):
    """Base schema for app features."""

    name: str
    description: str | None = None
    granted: bool = False
    module: str
    module_name: str | None = None
    subcategory: str | None = None
    path: str
    icon: str | None = None
    actions: list[str] = Field(default=["read"])
    display_order: int = 0
    is_public: bool = False
    requires_org: bool = True


class AppFeatureCreate(AppFeatureBase):
    """Schema for creating a feature manually."""

    id: str = Field(..., pattern=r"^[a-z0-9_]+\.[a-z0-9_]+(\.[a-z0-9_]+)?$")
    parent_id: str | None = None


class AppFeatureUpdate(BaseSchema):
    """Schema for updating a feature."""

    name: str | None = None
    description: str | None = None
    granted: bool = False
    module_name: str | None = None
    subcategory: str | None = None
    path: str | None = None
    icon: str | None = None
    actions: list[str] | None = None
    display_order: int | None = None
    is_active: bool | None = None
    is_public: bool | None = None
    requires_org: bool | None = None


class AppFeatureRead(AppFeatureBase):
    """Schema for reading feature data."""

    id: str
    application_id: str
    parent_id: str | None = None
    is_active: bool
    lifecycle: FeatureLifecycle
    first_seen_version: str | None = None
    last_seen_version: str | None = None
    discovered_at: datetime
    last_seen_at: datetime

    # Computed fields
    permission_keys: list[str] = Field(default_factory=list)
    children_count: int = 0


# ==================== UI Display Schemas ====================


class FeatureAction(BaseSchema):
    """Single action on a feature for permission matrix."""

    action: str  # e.g., "read", "create", "update", "delete"
    permission_key: str  # e.g., "orchestrator.projects:read"
    description: str | None = None
    granted: bool = False


class FeatureWithActions(BaseSchema):
    """Feature with expanded actions for permission matrix UI."""

    id: str
    name: str
    description: str | None = None
    granted: bool = False
    path: str
    icon: str | None = None
    is_public: bool
    requires_org: bool
    lifecycle: FeatureLifecycle = FeatureLifecycle.ACTIVE
    actions: list[FeatureAction]


class ModuleFeatures(BaseSchema):
    """Features grouped by module for UI display."""

    module_id: str
    module_name: str
    features: list[FeatureWithActions]


class ApplicationFeatures(BaseSchema):
    """Features grouped by application for UI display."""

    application_id: str
    application_name: str
    modules: list[ModuleFeatures]


class FeaturePermissionMatrixRead(BaseSchema):
    """
    Full feature permission matrix for a role.
    Used for the Permission Matrix UI component.
    """

    role_id: str
    role_name: str
    tenant_id: str
    applications: list[ApplicationFeatures]
    granted_permissions: list[str]  # List of "feature_id:action" keys that are granted


# ==================== Sync Schemas ====================


class FeatureSyncRequest(BaseSchema):
    """Request to trigger feature sync."""

    force: bool = Field(default=False, description="Force sync even if up to date")


class FeatureSyncSummary(BaseSchema):
    """Summary of sync operation."""

    added: int = 0
    updated: int = 0
    deprecated: int = 0
    removed: int = 0
    unchanged: int = 0


class FeatureSyncResponse(BaseSchema):
    """Response from feature sync."""

    status: str  # "success", "error", "no_changes"
    app_version: str | None = None
    summary: FeatureSyncSummary
    error_message: str | None = None


# ==================== Permission Batch Schemas ====================


class FeaturePermissionGrant(BaseSchema):
    """Schema for granting a feature permission to a role."""

    feature_id: str  # e.g., "orchestrator.projects"
    action: str  # e.g., "read", "create", "update", "delete"

    @property
    def permission_key(self) -> str:
        return f"{self.feature_id}:{self.action}"


class FeaturePermissionBatchUpdate(BaseSchema):
    """Schema for batch updating role permissions with features."""

    grant: list[str] = Field(default_factory=list)  # List of "feature_id:action" strings
    revoke: list[str] = Field(default_factory=list)  # List of "feature_id:action" strings


# ==================== Bulk Operation Schemas ====================


class BulkSyncRequest(BaseSchema):
    """Request for bulk syncing multiple applications."""
    
    application_ids: list[str] | None = Field(
        default=None,
        description="List of application IDs to sync. If empty, syncs all active applications."
    )
    force: bool = Field(default=False, description="Force sync even if up to date")


class AppSyncResult(BaseSchema):
    """Result of syncing a single application."""
    
    application_id: str
    application_name: str
    status: str  # "success", "error", "skipped"
    app_version: str | None = None
    summary: FeatureSyncSummary | None = None
    error_message: str | None = None


class BulkSyncResponse(BaseSchema):
    """Response from bulk sync operation."""
    
    total_apps: int
    successful: int
    failed: int
    skipped: int
    results: list[AppSyncResult]


class BulkDeleteRequest(BaseSchema):
    """Request for bulk deleting features."""
    
    feature_ids: list[str] = Field(..., min_length=1, description="List of feature IDs to delete")


class BulkDeleteResponse(BaseSchema):
    """Response from bulk delete operation."""
    
    total_requested: int
    deleted: int
    not_found: int
    errors: list[str] = Field(default_factory=list)
