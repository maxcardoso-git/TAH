# Pydantic Schemas
from app.schemas.app_feature import (
    AppFeatureCreate,
    AppFeatureRead,
    AppFeatureUpdate,
    AppFeaturesManifest,
    ApplicationFeatures,
    FeatureAction,
    FeaturePermissionBatchUpdate,
    FeaturePermissionMatrixRead,
    FeatureSyncRequest,
    FeatureSyncResponse,
    FeatureSyncSummary,
    FeatureWithActions,
    ManifestFeature,
    ManifestModule,
    ModuleFeatures,
)
from app.schemas.application import (
    ApplicationCreate,
    ApplicationRead,
    ApplicationUpdate,
    TenantApplicationCreate,
    TenantApplicationRead,
    TenantApplicationUpdate,
)
from app.schemas.audit import AuditLogRead
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.permission import (
    ExternalPermissionRead,
    PermissionMatrixRead,
    RolePermissionBatchUpdate,
    RolePermissionRead,
)
from app.schemas.role import RoleCreate, RoleDuplicate, RoleRead, RoleUpdate
from app.schemas.tenant import TenantCreate, TenantRead, TenantUpdate
from app.schemas.user import (
    UserRead,
    UserRoleAssign,
    UserRoleRead,
    UserTenantRead,
)

__all__ = [
    # Common
    "PaginatedResponse",
    "PaginationParams",
    # Tenant
    "TenantCreate",
    "TenantRead",
    "TenantUpdate",
    # Application
    "ApplicationCreate",
    "ApplicationRead",
    "ApplicationUpdate",
    "TenantApplicationCreate",
    "TenantApplicationRead",
    "TenantApplicationUpdate",
    # App Features
    "AppFeatureCreate",
    "AppFeatureRead",
    "AppFeatureUpdate",
    "AppFeaturesManifest",
    "ManifestModule",
    "ManifestFeature",
    "FeatureAction",
    "FeatureWithActions",
    "ModuleFeatures",
    "ApplicationFeatures",
    "FeaturePermissionMatrixRead",
    "FeatureSyncRequest",
    "FeatureSyncResponse",
    "FeatureSyncSummary",
    "FeaturePermissionBatchUpdate",
    # Permission (legacy)
    "ExternalPermissionRead",
    "RolePermissionRead",
    "RolePermissionBatchUpdate",
    "PermissionMatrixRead",
    # Role
    "RoleCreate",
    "RoleRead",
    "RoleUpdate",
    "RoleDuplicate",
    # User
    "UserRead",
    "UserTenantRead",
    "UserRoleRead",
    "UserRoleAssign",
    # Audit
    "AuditLogRead",
]
