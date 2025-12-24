import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import apiClient, { PaginatedResponse } from '@/api/client'
import { Application } from '@/types/application'
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
import { Plus, Search, LayoutGrid, RefreshCw, Key, Loader2 } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'

export function ApplicationsListPage() {
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newAppName, setNewAppName] = useState('')
  const [newAppId, setNewAppId] = useState('')
  const [newAppDescription, setNewAppDescription] = useState('')
  const [newAppBaseUrl, setNewAppBaseUrl] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['applications', search],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<Application>>(
        '/applications'
      )
      return response.data
    },
  })

  const createAppMutation = useMutation({
    mutationFn: async (data: {
      id: string
      name: string
      description?: string
      base_url?: string
    }) => {
      const response = await apiClient.post<Application>('/applications', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setIsDialogOpen(false)
      setNewAppName('')
      setNewAppId('')
      setNewAppDescription('')
      setNewAppBaseUrl('')
    },
  })

  const handleCreateApp = (e: React.FormEvent) => {
    e.preventDefault()
    createAppMutation.mutate({
      id: newAppId,
      name: newAppName,
      description: newAppDescription || undefined,
      base_url: newAppBaseUrl || undefined,
    })
  }

  const generateId = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
  }

  const handleNameChange = (name: string) => {
    setNewAppName(name)
    if (!newAppId || newAppId === generateId(newAppName)) {
      setNewAppId(generateId(name))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Aplicacoes</h1>
          <p className="text-muted-foreground">
            Registry de aplicacoes integradas a plataforma
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Registrar Aplicacao
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <form onSubmit={handleCreateApp}>
              <DialogHeader>
                <DialogTitle>Registrar Nova Aplicacao</DialogTitle>
                <DialogDescription>
                  Adicione uma aplicacao ao registry da plataforma.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="appName">Nome</Label>
                  <Input
                    id="appName"
                    placeholder="Nome da aplicacao"
                    value={newAppName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="appId">ID da Aplicacao</Label>
                  <Input
                    id="appId"
                    placeholder="minha_aplicacao"
                    value={newAppId}
                    onChange={(e) => setNewAppId(e.target.value)}
                    className="font-mono"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Identificador unico (snake_case)
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="appDescription">Descricao</Label>
                  <Input
                    id="appDescription"
                    placeholder="Descricao da aplicacao"
                    value={newAppDescription}
                    onChange={(e) => setNewAppDescription(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="appBaseUrl">URL Base</Label>
                  <Input
                    id="appBaseUrl"
                    placeholder="https://api.exemplo.com"
                    value={newAppBaseUrl}
                    onChange={(e) => setNewAppBaseUrl(e.target.value)}
                    type="url"
                  />
                  <p className="text-xs text-muted-foreground">
                    URL para discovery de permissoes via /api/meta/access
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
                <Button type="submit" disabled={createAppMutation.isPending}>
                  {createAppMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Registrar
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
            placeholder="Buscar aplicacoes..."
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
      ) : data?.items.length === 0 ? (
        <Card className="p-12 text-center">
          <LayoutGrid className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Nenhuma aplicacao registrada</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Registre sua primeira aplicacao para comecar.
          </p>
          <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Registrar Aplicacao
          </Button>
        </Card>
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
                        <span>{app.permissions_count} permissoes</span>
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
