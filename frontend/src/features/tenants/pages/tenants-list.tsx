import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import apiClient, { PaginatedResponse } from '@/api/client'
import { Tenant } from '@/types/tenant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Plus, Search, Building2, Users, Shield } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'

export function TenantsListPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '12',
      })
      if (search) params.append('search', search)

      const response = await apiClient.get<PaginatedResponse<Tenant>>(
        `/tenants?${params}`
      )
      return response.data
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">
            Gerencie as organizações da plataforma
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Tenant
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((tenant) => (
            <Link key={tenant.id} to={`/tenants/${tenant.id}`}>
              <Card className="transition-shadow hover:shadow-md cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{tenant.name}</CardTitle>
                    </div>
                    <Badge
                      className={STATUS_COLORS[tenant.status] || 'bg-gray-100'}
                    >
                      {tenant.status}
                    </Badge>
                  </div>
                  {tenant.slug && (
                    <CardDescription className="font-mono text-xs">
                      {tenant.slug}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {tenant.users_count !== undefined && (
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{tenant.users_count} usuários</span>
                      </div>
                    )}
                    {tenant.roles_count !== undefined && (
                      <div className="flex items-center gap-1">
                        <Shield className="h-4 w-4" />
                        <span>{tenant.roles_count} roles</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Criado {formatRelativeDate(tenant.created_at)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === data.pages}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}
