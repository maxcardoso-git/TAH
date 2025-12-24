import { useNavigate } from 'react-router-dom'
import { useTenant } from '@/contexts/tenant-context'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut, User } from 'lucide-react'
import { Breadcrumbs } from './breadcrumbs'

export function Header() {
  const navigate = useNavigate()
  const { currentTenant } = useTenant()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <img
          src="/logo.png"
          alt="TAH"
          className="h-8 w-auto"
        />
        <div className="h-6 w-px bg-border" />
        <Breadcrumbs />

        {currentTenant && (
          <Badge variant="outline" className="ml-4">
            {currentTenant.name}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {user.display_name || user.email || 'User'}
            </span>
          </div>
        )}

        <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
