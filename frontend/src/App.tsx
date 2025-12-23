import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/auth-context'
import { TenantProvider } from '@/contexts/tenant-context'
import { Toaster } from '@/components/ui/toaster'
import { Shell } from '@/components/layout/shell'

// Pages
import { TenantsListPage } from '@/features/tenants/pages/tenants-list'
import { TenantDetailPage } from '@/features/tenants/pages/tenant-detail'
import { ApplicationsListPage } from '@/features/applications/pages/applications-list'
import { ApplicationDetailPage } from '@/features/applications/pages/application-detail'
import { RolesListPage } from '@/features/roles/pages/roles-list'
import { RolePermissionsPage } from '@/features/roles/pages/role-permissions'
import { UsersListPage } from '@/features/users/pages/users-list'
import { AuditLogPage } from '@/features/audit/pages/audit-log'

function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <Shell>
          <Routes>
            {/* Redirect root to tenants */}
            <Route path="/" element={<Navigate to="/tenants" replace />} />

            {/* Tenants */}
            <Route path="/tenants" element={<TenantsListPage />} />
            <Route path="/tenants/:tenantId" element={<TenantDetailPage />} />

            {/* Applications (global) */}
            <Route path="/applications" element={<ApplicationsListPage />} />
            <Route path="/applications/:applicationId" element={<ApplicationDetailPage />} />

            {/* Roles (tenant-scoped) */}
            <Route path="/tenants/:tenantId/roles" element={<RolesListPage />} />
            <Route path="/tenants/:tenantId/roles/:roleId/permissions" element={<RolePermissionsPage />} />

            {/* Users (tenant-scoped) */}
            <Route path="/tenants/:tenantId/users" element={<UsersListPage />} />

            {/* Audit (tenant-scoped) */}
            <Route path="/tenants/:tenantId/audit" element={<AuditLogPage />} />
          </Routes>
        </Shell>
        <Toaster />
      </TenantProvider>
    </AuthProvider>
  )
}

export default App
