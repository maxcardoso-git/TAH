export type AppStatus = "active" | "inactive" | "maintenance" | "deprecated"
export type CatalogStatus = "active" | "inactive"
export type AppCategory = "studio" | "production" | "governance" | "data" | "settings"

// App Catalog - Global dictionary of applications
export interface AppCatalog {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  category: AppCategory | null
  status: CatalogStatus
  created_at: string
  updated_at: string
  tenant_count?: number
}

export interface AppCatalogCreate {
  id: string
  name: string
  description?: string
  logo_url?: string
  category?: AppCategory
  status?: CatalogStatus
}

export interface AppCatalogUpdate {
  name?: string
  description?: string
  logo_url?: string
  category?: AppCategory
  status?: CatalogStatus
}

export interface AppCatalogList {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  category: AppCategory | null
  status: CatalogStatus
}

// Application - Tenant-specific configuration
export interface Application {
  id: string
  tenant_id: string | null
  app_catalog_id: string | null
  name: string
  description: string | null
  base_url: string
  features_manifest_url: string | null
  status: AppStatus
  current_version: string | null
  healthcheck_url: string | null
  icon: string | null
  callback_url: string | null
  launch_url: string | null
  logo_url: string | null
  auth_mode: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  permissions_count?: number
  features_count?: number
  last_sync_at?: string | null
  sync_status?: string | null
}

export interface ApplicationCreate {
  id: string
  app_catalog_id: string  // Required - must select from catalog
  base_url: string
  features_manifest_url?: string
  healthcheck_url?: string
  icon?: string
  callback_url?: string
  launch_url?: string
  auth_mode?: string
  metadata?: Record<string, unknown>
  // Optional overrides (if not provided, uses catalog values)
  name?: string
  description?: string
  logo_url?: string
}

export interface ApplicationUpdate {
  app_catalog_id?: string  // Can change the catalog app
  name?: string
  description?: string
  base_url?: string
  features_manifest_url?: string
  healthcheck_url?: string
  icon?: string
  callback_url?: string
  launch_url?: string
  logo_url?: string
  status?: AppStatus
  auth_mode?: string
  metadata?: Record<string, unknown>
}

export interface TenantApplication {
  id: string
  tenant_id: string
  application_id: string
  status: AppStatus
  enabled_at: string | null
  disabled_at: string | null
  config: Record<string, unknown>
  created_at: string
  updated_at: string
  application?: Application
}
