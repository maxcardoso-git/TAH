export type FeatureLifecycle = 'active' | 'deprecated' | 'removed'

export interface AppFeature {
  id: string // e.g., "orchestrator.projects"
  application_id: string
  name: string
  description: string | null
  module: string
  module_name: string | null
  subcategory: string | null
  parent_id: string | null
  path: string
  icon: string | null
  actions: string[] // ["read", "create", "update", "delete"]
  display_order: number
  is_active: boolean
  is_public: boolean
  requires_org: boolean
  lifecycle: FeatureLifecycle
  first_seen_version: string | null
  last_seen_version: string | null
  discovered_at: string
  last_seen_at: string
  permission_keys: string[] // ["orchestrator.projects:read", ...]
  children_count: number
}

export interface AppFeatureCreate {
  id: string
  name: string
  description?: string
  module: string
  module_name?: string
  subcategory?: string
  parent_id?: string
  path: string
  icon?: string
  actions?: string[]
  display_order?: number
  is_public?: boolean
  requires_org?: boolean
}

export interface AppFeatureUpdate {
  name?: string
  description?: string
  module_name?: string
  subcategory?: string
  path?: string
  icon?: string
  actions?: string[]
  display_order?: number
  is_active?: boolean
  is_public?: boolean
  requires_org?: boolean
}

// Manifest types
export interface ManifestModule {
  id: string
  name: string
  description?: string
  display_order?: number
}

export interface ManifestFeature {
  id: string
  name: string
  description?: string
  module: string
  subcategory?: string
  parent_id?: string
  path: string
  icon?: string
  actions: string[]
  display_order?: number
  is_public?: boolean
  requires_org?: boolean
}

export interface AppFeaturesManifest {
  app_id: string
  app_name: string
  version: string
  modules: ManifestModule[]
  features: ManifestFeature[]
  generated_at: string
}

// Permission Matrix types
export interface FeatureAction {
  action: string
  permission_key: string
  description?: string
}

export interface FeatureWithActions {
  id: string
  name: string
  description: string | null
  path: string
  icon: string | null
  is_public: boolean
  requires_org: boolean
  actions: FeatureAction[]
}

export interface ModuleFeatures {
  module_id: string
  module_name: string
  features: FeatureWithActions[]
}

export interface ApplicationFeatures {
  application_id: string
  application_name: string
  modules: ModuleFeatures[]
}

export interface FeaturePermissionMatrix {
  role_id: string
  role_name: string
  tenant_id: string
  applications: ApplicationFeatures[]
  granted_permissions: string[] // ["orchestrator.projects:read", ...]
}

// Batch update types
export interface FeaturePermissionGrant {
  feature_id: string
  action: string
}

export interface FeaturePermissionBatchUpdate {
  grant: FeaturePermissionGrant[]
  revoke: FeaturePermissionGrant[]
}

// Sync types
export interface FeatureSyncSummary {
  added: number
  updated: number
  deprecated: number
  removed: number
  unchanged: number
}

export interface FeatureSyncResponse {
  status: 'success' | 'error' | 'no_changes'
  app_version: string | null
  summary: FeatureSyncSummary
  error_message: string | null
}
