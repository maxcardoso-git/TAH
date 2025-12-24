export type AppStatus = 'active' | 'inactive' | 'maintenance' | 'deprecated'

export interface Application {
  id: string
  name: string
  description: string | null
  base_url: string
  features_manifest_url: string | null
  status: AppStatus
  current_version: string | null
  healthcheck_url: string | null
  auth_mode: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  permissions_count?: number
  last_sync_at?: string | null
  sync_status?: string | null
}

export interface ApplicationCreate {
  id: string
  name: string
  description?: string
  base_url: string
  features_manifest_url?: string
  healthcheck_url?: string
  auth_mode?: string
  metadata?: Record<string, unknown>
}

export interface ApplicationUpdate {
  name?: string
  description?: string
  base_url?: string
  features_manifest_url?: string
  healthcheck_url?: string
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
