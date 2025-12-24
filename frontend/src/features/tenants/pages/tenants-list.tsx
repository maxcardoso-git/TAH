import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import apiClient, { PaginatedResponse } from '@/api/client'
import { Tenant } from '@/types/tenant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Search, Building2, Users, Shield, Loader2 } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'

export function TenantsListPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newTenantName, setNewTenantName] = useState('')
  const [newTenantSlug, setNewTenantSlug] = useState('')
  const queryClient = useQueryClient()

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

  const createTenantMutation = useMutation({
    mutationFn: async (data: { name: string; slug?: string }) => {
      const response = await apiClient.post<Tenant>('/tenants', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setIsDialogOpen(false)
      setNewTenantName('')
      setNewTenantSlug('')
    },
  })

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault()
    createTenantMutation.mutate({
      name: newTenantName,
      slug: newTenantSlug || undefined,
    })
  }

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleNameChange = (name: string) => {
    setNewTenantName(name)
    if (!newTenantSlug || newTenantSlug === generateSlug(newTenantName)) {
      setNewTenantSlug(generateSlug(name))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">
            Gerencie as organizacoes da plataforma
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateTenant}>
              <DialogHeader>
                <DialogTitle>Criar Novo Tenant</DialogTitle>
                <DialogDescription>
                  Adicione uma nova organizacao a plataforma.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Nome da organizacao"
                    value={newTenantName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    placeholder="nome-da-organizacao"
                    value={newTenantSlug}
                    onChange={(e) => setNewTenantSlug(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Identificador unico usado em URLs e integracoes
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createTenantMutation.isPending}>
                  {createTenantMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Criar Tenant
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
      ) : data?.items.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Nenhum tenant encontrado</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie seu primeiro tenant para comecar.
          </p>
          <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Tenant
          </Button>
        </Card>
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
                        <span>{tenant.users_count} usuarios</span>
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
            Pagina {page} de {data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === data.pages}
            onClick={() => setPage(page + 1)}
          >
            Proxima
          </Button>
        </div>
      )}
    </div>
  )
}
