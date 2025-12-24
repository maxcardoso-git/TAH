import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { TenantProvider } from '@/contexts/tenant-context'
import { Toaster } from '@/components/ui/toaster'
import { Shell } from '@/components/layout/shell'

// Pages
import { LoginPage } from '@/features/auth/pages/login'
import { AcceptInvitePage } from '@/features/auth/pages/accept-invite'
import { TenantsListPage } from '@/features/tenants/pages/tenants-list'
import { TenantDetailPage } from '@/features/tenants/pages/tenant-detail'
import { ApplicationsListPage } from '@/features/applications/pages/applications-list'
import { ApplicationDetailPage } from '@/features/applications/pages/application-detail'
import { RolesListPage } from '@/features/roles/pages/roles-list'
import { RolePermissionsPage } from '@/features/roles/pages/role-permissions'
import { UsersListPage } from '@/features/users/pages/users-list'
import { AuditLogPage } from '@/features/audit/pages/audit-log'

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
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

          {/* Catch all - redirect to tenants */}
          <Route path="*" element={<Navigate to="/tenants" replace />} />
        </Routes>
      </Shell>
      <Toaster />
    </TenantProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
