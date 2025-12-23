export type PermissionLifecycle = 'active' | 'deprecated' | 'removed'

export interface ExternalPermission {
  id: string
  application_id: string
  module_key: string
  module_name: string | null
  permission_key: string
  description: string | null
  lifecycle: PermissionLifecycle
  first_seen_version: string | null
  last_seen_version: string | null
  discovered_at: string
  last_seen_at: string
  is_new?: boolean
}

export interface RolePermission {
  id: string
  tenant_id: string
  role_id: string
  application_id: string
  permission_key: string
  granted_by: string | null
  granted_at: string
  permission_info?: ExternalPermission
}

export interface RolePermissionBatchUpdate {
  grant: Array<{ application_id: string; permission_key: string }>
  revoke: Array<{ application_id: string; permission_key: string }>
}

export interface ModulePermissions {
  module_key: string
  module_name: string | null
  permissions: ExternalPermission[]
}

export interface ApplicationPermissions {
  application_id: string
  application_name: string
  modules: ModulePermissions[]
}

export interface PermissionMatrix {
  role_id: string
  role_name: string
  tenant_id: string
  applications: ApplicationPermissions[]
  granted_permissions: string[]
}
