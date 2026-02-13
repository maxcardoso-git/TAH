import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { TenantProvider } from '@/contexts/tenant-context'
import { Toaster } from '@/components/ui/toaster'
import { Shell } from '@/components/layout/shell'

// Pages
import { LoginPage } from '@/features/auth/pages/login'
import { AcceptInvitePage } from '@/features/auth/pages/accept-invite'
import { TenantsListPage } from '@/features/tenants/pages/tenants-list'
import { TenantSelectPage } from '@/features/tenants/pages/tenant-select'
import { TenantDetailPage } from '@/features/tenants/pages/tenant-detail'
import { AppOrgMappingsPage } from '@/features/tenants/pages/app-org-mappings'
import { ApplicationsListPage } from '@/features/applications/pages/applications-list'
import { ApplicationDetailPage } from '@/features/applications/pages/application-detail'
import { AppCatalogListPage } from '@/features/app-catalog/pages/app-catalog-list'
import { RolesListPage } from '@/features/roles/pages/roles-list'
import { RolePermissionsPage } from '@/features/roles/pages/role-permissions'
import { UsersListPage } from '@/features/users/pages/users-list'
import { AuditLogPage } from '@/features/audit/pages/audit-log'
import { AppLauncherPage } from '@/features/launcher/pages/app-launcher'
import { HowItWorksPage } from '@/features/docs/pages/how-it-works'

function ProtectedRoutes() {
  const { isAuthenticated, isLoading, user } = useAuth()

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

  const canAccessTahAdmin = Boolean(
    user?.permissions?.some((permission) => permission.startsWith('tah.'))
  )

  return (
    <TenantProvider>
      <Routes>
        {/* Tenant Selection (without Shell) */}
        <Route path="/select-tenant" element={<TenantSelectPage />} />

        {/* App Launcher (without Shell) */}
        <Route path="/apps" element={<AppLauncherPage />} />

        {/* Redirect root to app launcher */}
        <Route path="/" element={<Navigate to="/apps" replace />} />

        {/* Routes with Shell */}
        <Route
          path="*"
          element={
            canAccessTahAdmin ? (
            <Shell>
              <Routes>
                {/* Tenants */}
                <Route path="/tenants" element={<TenantsListPage />} />
                <Route path="/tenants/:tenantId" element={<TenantDetailPage />} />
                <Route path="/tenants/:tenantId/app-org-mappings" element={<AppOrgMappingsPage />} />

                {/* App Catalog (global dictionary) */}
                <Route path="/app-catalog" element={<AppCatalogListPage />} />

                {/* Applications (tenant-specific) */}
                <Route path="/applications" element={<ApplicationsListPage />} />
                <Route path="/applications/:applicationId" element={<ApplicationDetailPage />} />

                {/* Roles (tenant-scoped) */}
                <Route path="/tenants/:tenantId/roles" element={<RolesListPage />} />
                <Route path="/tenants/:tenantId/roles/:roleId/permissions" element={<RolePermissionsPage />} />

                {/* Users (tenant-scoped) */}
                <Route path="/tenants/:tenantId/users" element={<UsersListPage />} />

                {/* Documentation */}
                <Route path="/docs/how-it-works" element={<HowItWorksPage />} />

                {/* Audit (tenant-scoped) */}
                <Route path="/tenants/:tenantId/audit" element={<AuditLogPage />} />

                {/* Catch all - redirect to tenant selection */}
                <Route path="*" element={<Navigate to="/apps" replace />} />
              </Routes>
            </Shell>
            ) : (
              <Navigate to="/apps" replace />
            )
          }
        />
      </Routes>
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
