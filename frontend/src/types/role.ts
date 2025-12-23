export type RoleStatus = 'active' | 'inactive' | 'deleted'

export interface Role {
  id: string
  tenant_id: string
  name: string
  description: string | null
  status: RoleStatus
  is_system: boolean
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  permissions_count?: number
  users_count?: number
}

export interface RoleCreate {
  name: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface RoleUpdate {
  name?: string
  description?: string
  status?: RoleStatus
  metadata?: Record<string, unknown>
}

export interface RoleDuplicate {
  new_name: string
  description?: string
  include_permissions?: boolean
}
