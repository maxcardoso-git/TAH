import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import apiClient, { PaginatedResponse } from '@/api/client'
import { Application } from '@/types/application'
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
import { Plus, Search, LayoutGrid, RefreshCw, Key } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'

export function ApplicationsListPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['applications', search],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<Application>>(
        '/applications'
      )
      return response.data
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Aplicações</h1>
          <p className="text-muted-foreground">
            Registry de aplicações integradas à plataforma
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Registrar Aplicação
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar aplicações..."
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
          {data?.items.map((app) => (
            <Link key={app.id} to={`/applications/${app.id}`}>
              <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{app.name}</CardTitle>
                    </div>
                    <Badge className={STATUS_COLORS[app.status]}>
                      {app.status}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {app.id}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {app.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {app.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    {app.current_version && (
                      <Badge variant="outline">v{app.current_version}</Badge>
                    )}
                    {app.permissions_count !== undefined && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Key className="h-4 w-4" />
                        <span>{app.permissions_count} permissões</span>
                      </div>
                    )}
                  </div>

                  {app.last_sync_at && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <RefreshCw className="h-3 w-3" />
                      <span>Sync {formatRelativeDate(app.last_sync_at)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
