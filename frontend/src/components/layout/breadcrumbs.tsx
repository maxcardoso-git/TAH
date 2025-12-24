import { Link, useLocation, useParams } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useTenant } from '@/contexts/tenant-context'
import { cn } from '@/lib/utils'

export function Breadcrumbs() {
  const location = useLocation()
  const { tenantId, roleId, applicationId } = useParams()
  const { currentTenant } = useTenant()

  const pathSegments = location.pathname.split('/').filter(Boolean)

  const breadcrumbs: Array<{ label: string; href: string }> = []

  // Build breadcrumbs based on path
  pathSegments.forEach((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/')

    // Skip IDs, we'll handle them with context
    if (segment === tenantId || segment === roleId || segment === applicationId) {
      return
    }

    // Map segments to labels
    const labelMap: Record<string, string> = {
      tenants: 'Tenants',
      applications: 'Applications',
      roles: 'Roles',
      users: 'Users',
      audit: 'Audit Log',
      permissions: 'Permissions',
    }

    const label = labelMap[segment] || segment

    breadcrumbs.push({ label, href })
  })

  // Add tenant name if in tenant context
  if (tenantId && currentTenant) {
    const tenantIndex = breadcrumbs.findIndex((b) => b.label === 'Tenants')
    if (tenantIndex !== -1) {
      breadcrumbs.splice(tenantIndex + 1, 0, {
        label: currentTenant.name,
        href: `/tenants/${tenantId}`,
      })
    }
  }

  if (breadcrumbs.length === 0) {
    return null
  }

  return (
    <nav className="flex items-center gap-2 text-sm">
      <Link
        to="/"
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <Home className="h-4 w-4" />
      </Link>

      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Link
            to={crumb.href}
            className={cn(
              'transition-colors hover:text-foreground',
              index === breadcrumbs.length - 1
                ? 'font-medium text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {crumb.label}
          </Link>
        </div>
      ))}
    </nav>
  )
}
