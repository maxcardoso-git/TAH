import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiClient, { PaginatedResponse } from '@/api/client'
import { Role } from '@/types/role'
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
import { Plus, Search, Shield, Users, Key, Copy } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'

export function RolesListPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['roles', tenantId, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)

      const response = await apiClient.get<PaginatedResponse<Role>>(
        `/tenants/${tenantId}/roles?${params}`
      )
      return response.data
    },
    enabled: !!tenantId,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roles</h1>
          <p className="text-muted-foreground">
            Gerencie os perfis de acesso do tenant
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Role
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar roles..."
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
                <div className="h-4 w-48 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((role) => (
            <Card
              key={role.id}
              className="transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{role.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {role.is_system && (
                      <Badge variant="secondary">Sistema</Badge>
                    )}
                    <Badge className={STATUS_COLORS[role.status]}>
                      {role.status}
                    </Badge>
                  </div>
                </div>
                {role.description && (
                  <CardDescription>{role.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {role.permissions_count !== undefined && (
                    <div className="flex items-center gap-1">
                      <Key className="h-4 w-4" />
                      <span>{role.permissions_count} permissões</span>
                    </div>
                  )}
                  {role.users_count !== undefined && (
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{role.users_count} usuários</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Criado {formatRelativeDate(role.created_at)}
                </p>

                <div className="flex gap-2 pt-2">
                  <Link
                    to={`/tenants/${tenantId}/roles/${role.id}/permissions`}
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <Key className="mr-2 h-4 w-4" />
                      Permissões
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={role.is_system}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
