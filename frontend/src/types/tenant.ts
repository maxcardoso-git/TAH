export type TenantStatus = 'active' | 'suspended' | 'deleted'

export interface Tenant {
  id: string
  name: string
  slug: string | null
  status: TenantStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
  applications_count?: number
  users_count?: number
  roles_count?: number
}

export interface TenantCreate {
  name: string
  slug?: string
  metadata?: Record<string, unknown>
}

export interface TenantUpdate {
  name?: string
  slug?: string
  status?: TenantStatus
  metadata?: Record<string, unknown>
}
