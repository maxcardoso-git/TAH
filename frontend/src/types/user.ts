export type UserTenantStatus = 'active' | 'invited' | 'suspended' | 'revoked'

export interface User {
  id: string
  email: string | null
  display_name: string | null
  status: string
  external_subject: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface UserTenant {
  id: string
  user_id: string
  tenant_id: string
  status: UserTenantStatus
  invited_by: string | null
  joined_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  user?: User
}

export interface UserWithRoles extends User {
  tenant_status: UserTenantStatus
  roles: Array<{
    id: string
    name: string
    status: string
    is_system: boolean
  }>
}

export interface UserRole {
  id: string
  tenant_id: string
  user_id: string
  role_id: string
  assigned_by: string | null
  assigned_at: string
  role?: {
    id: string
    name: string
    status: string
    is_system: boolean
  }
}

export interface UserRoleAssign {
  role_ids: string[]
}

export interface EffectivePermissions {
  tenant_id: string
  user_id: string
  permissions: string[]
  applications: string[]
  roles: string[]
}
