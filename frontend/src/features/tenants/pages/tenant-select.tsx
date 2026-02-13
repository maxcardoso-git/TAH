import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiClient, { PaginatedResponse } from '@/api/client'
import { Tenant } from '@/types/tenant'
import { useTenant } from '@/contexts/tenant-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Building2, Users, Shield, ArrowRight, Loader2 } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'

export function TenantSelectPage() {
  const navigate = useNavigate()
  const { setCurrentTenant } = useTenant()

  const { data, isLoading } = useQuery({
    queryKey: ['user-tenants'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<Tenant>>(
        '/tenants?page_size=100'
      )
      return response.data
    },
  })

  const handleSelectTenant = (tenant: Tenant) => {
    setCurrentTenant(tenant)
    navigate('/apps')
  }

  // Auto-redirect if only one tenant
  useEffect(() => {
    if (data?.items && data.items.length === 1) {
      const tenant = data.items[0]
      setCurrentTenant(tenant)
      navigate('/apps', { replace: true })
    }
  }, [data, setCurrentTenant, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading your organizations...</p>
        </div>
      </div>
    )
  }

  // If only one tenant, show loading while redirecting
  if (data?.items && data.items.length === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  // No tenants
  if (!data?.items || data.items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <img
                src="/logo.png"
                alt="TAH Logo"
                className="h-12 w-auto"
              />
            </div>
            <CardTitle>No Organizations</CardTitle>
            <CardDescription>
              You don't have access to any organization yet.
              Please contact an administrator to be added to an organization.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="TAH Logo"
            className="h-16 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold">Select Organization</h1>
          <p className="text-muted-foreground mt-2">
            Choose which organization you want to access
          </p>
        </div>

        {/* Tenant Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((tenant) => (
            <Card
              key={tenant.id}
              className="transition-all hover:shadow-md hover:border-primary/50 cursor-pointer group"
              onClick={() => handleSelectTenant(tenant)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{tenant.name}</CardTitle>
                      {tenant.slug && (
                        <CardDescription className="font-mono text-xs">
                          {tenant.slug}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge
                    className={STATUS_COLORS[tenant.status] || 'bg-gray-100'}
                  >
                    {tenant.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {tenant.users_count !== undefined && (
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{tenant.users_count} users</span>
                      </div>
                    )}
                    {tenant.roles_count !== undefined && (
                      <div className="flex items-center gap-1">
                        <Shield className="h-4 w-4" />
                        <span>{tenant.roles_count} roles</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Enter
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Created {formatRelativeDate(tenant.created_at)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
