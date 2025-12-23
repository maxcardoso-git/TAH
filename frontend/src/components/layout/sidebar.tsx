import { Link, useLocation, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Building2,
  LayoutGrid,
  Shield,
  Users,
  FileText,
  ChevronRight,
} from 'lucide-react'
import { useTenant } from '@/contexts/tenant-context'

const mainNavItems = [
  {
    title: 'Tenants',
    href: '/tenants',
    icon: Building2,
  },
  {
    title: 'Aplicações',
    href: '/applications',
    icon: LayoutGrid,
  },
]

const tenantNavItems = [
  {
    title: 'Roles',
    href: '/roles',
    icon: Shield,
  },
  {
    title: 'Usuários',
    href: '/users',
    icon: Users,
  },
  {
    title: 'Audit Log',
    href: '/audit',
    icon: FileText,
  },
]

export function Sidebar() {
  const location = useLocation()
  const { tenantId } = useParams()
  const { currentTenant } = useTenant()

  const isActive = (href: string) => location.pathname.startsWith(href)

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link to="/" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">IAM Console</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {/* Main Navigation */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Plataforma
          </p>
          {mainNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          ))}
        </div>

        {/* Tenant Navigation - only show when in tenant context */}
        {(tenantId || currentTenant) && (
          <div className="mt-6 space-y-1">
            <div className="flex items-center gap-2 px-3">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {currentTenant?.name || 'Tenant'}
              </p>
            </div>
            {tenantNavItems.map((item) => {
              const href = `/tenants/${tenantId || currentTenant?.id}${item.href}`
              return (
                <Link
                  key={item.href}
                  to={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ml-4',
                    location.pathname.includes(item.href)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          Access & Role Management
        </p>
        <p className="text-xs text-muted-foreground">v0.1.0</p>
      </div>
    </aside>
  )
}
