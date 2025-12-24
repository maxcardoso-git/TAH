import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient, { PaginatedResponse } from '@/api/client'
import { UserWithRoles } from '@/types/user'
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
import { Plus, Search, User, Shield, Mail, Loader2 } from 'lucide-react'
import { STATUS_COLORS } from '@/lib/constants'

export function UsersListPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteDisplayName, setInviteDisplayName] = useState('')
  const queryClient = useQueryClient()

  const inviteUserMutation = useMutation({
    mutationFn: async (data: { email: string; display_name?: string }) => {
      const response = await apiClient.post<UserWithRoles>(
        `/tenants/${tenantId}/users/invite`,
        data
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', tenantId] })
      setIsDialogOpen(false)
      setInviteEmail('')
      setInviteDisplayName('')
    },
  })

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault()
    inviteUserMutation.mutate({
      email: inviteEmail,
      display_name: inviteDisplayName || undefined,
    })
  }

  const { data, isLoading } = useQuery({
    queryKey: ['users', tenantId, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)

      const response = await apiClient.get<PaginatedResponse<UserWithRoles>>(
        `/tenants/${tenantId}/users?${params}`
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
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie os usuários e suas atribuições de roles
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Convidar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleInviteUser}>
              <DialogHeader>
                <DialogTitle>Convidar Usuário</DialogTitle>
                <DialogDescription>
                  Convide um novo usuário para este tenant.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@exemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="displayName">Nome (opcional)</Label>
                  <Input
                    id="displayName"
                    placeholder="Nome do usuario"
                    value={inviteDisplayName}
                    onChange={(e) => setInviteDisplayName(e.target.value)}
                  />
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
                <Button type="submit" disabled={inviteUserMutation.isPending}>
                  {inviteUserMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Convidar
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
            placeholder="Buscar usuários..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Membros do Tenant</CardTitle>
          <CardDescription>
            {data?.total || 0} usuários encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 border rounded-lg animate-pulse"
                >
                  <div className="h-10 w-10 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-32 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum usuário encontrado
            </p>
          ) : (
            <div className="space-y-2">
              {data?.items.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {user.display_name || 'Usuário'}
                      </p>
                      {user.email && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Roles */}
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <div className="flex gap-1">
                        {user.roles.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            Sem roles
                          </span>
                        ) : (
                          user.roles.map((role) => (
                            <Badge
                              key={role.id}
                              variant={role.is_system ? 'secondary' : 'outline'}
                            >
                              {role.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <Badge className={STATUS_COLORS[user.tenant_status] || ''}>
                      {user.tenant_status}
                    </Badge>

                    <Button variant="outline" size="sm">
                      Gerenciar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
