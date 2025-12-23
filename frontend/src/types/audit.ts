export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ENABLE'
  | 'DISABLE'
  | 'ASSIGN'
  | 'UNASSIGN'
  | 'SYNC'
  | 'LOGIN'
  | 'LOGOUT'

export interface AuditLog {
  id: string
  tenant_id: string | null
  actor_user_id: string | null
  action: AuditAction
  entity_type: string
  entity_id: string | null
  entity_ref: Record<string, unknown>
  changes: Record<string, unknown>
  reason: string | null
  created_at: string
  actor_name?: string
  entity_name?: string
}

export interface AuditLogFilter {
  action?: AuditAction
  entity_type?: string
  entity_id?: string
  actor_user_id?: string
  start_date?: string
  end_date?: string
}
