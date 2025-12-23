import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { Application } from '@/types/application'
import { ExternalPermission } from '@/types/permission'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { RefreshCw, Edit, Key, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'
import { useToast } from '@/hooks/use-toast'

export function ApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: app, isLoading } = useQuery({
    queryKey: ['application', applicationId],
    queryFn: async () => {
      const response = await apiClient.get<Application>(
        `/applications/${applicationId}`
      )
      return response.data
    },
    enabled: !!applicationId,
  })

  const { data: permissions } = useQuery({
    queryKey: ['application-permissions', applicationId],
    queryFn: async () => {
      const response = await apiClient.get<ExternalPermission[]>(
        `/applications/${applicationId}/permissions`
      )
      return response.data
    },
    enabled: !!applicationId,
  })

  const syncMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/applications/${applicationId}/sync-permissions`)
    },
    onSuccess: () => {
      toast({ title: 'Permissões sincronizadas com sucesso' })
      queryClient.invalidateQueries({ queryKey: ['application', applicationId] })
      queryClient.invalidateQueries({
        queryKey: ['application-permissions', applicationId],
      })
    },
    onError: () => {
      toast({
        title: 'Erro ao sincronizar permissões',
        variant: 'destructive',
      })
    },
  })

  // Group permissions by module
  const permissionsByModule = permissions?.reduce(
    (acc, perm) => {
      if (!acc[perm.module_key]) {
        acc[perm.module_key] = {
          module_name: perm.module_name || perm.module_key,
          permissions: [],
        }
      }
      acc[perm.module_key].permissions.push(perm)
      return acc
    },
    {} as Record<string, { module_name: string; permissions: ExternalPermission[] }>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <Card className="animate-pulse">
          <CardContent className="h-32" />
        </Card>
      </div>
    )
  }

  if (!app) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Aplicação não encontrada</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{app.name}</h1>
            <Badge className={STATUS_COLORS[app.status]}>{app.status}</Badge>
            {app.current_version && (
              <Badge variant="outline">v{app.current_version}</Badge>
            )}
          </div>
          <p className="font-mono text-sm text-muted-foreground mt-1">
            {app.id}
          </p>
          {app.description && (
            <p className="text-muted-foreground mt-2">{app.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
            />
            Sync Permissions
          </Button>
          <Button variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Base URL</dt>
              <dd className="flex items-center gap-1">
                <span className="font-mono">{app.base_url}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Auth Mode</dt>
              <dd>{app.auth_mode}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Criado em</dt>
              <dd>{formatDate(app.created_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Atualizado em</dt>
              <dd>{formatDate(app.updated_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5" />
                Permissões Descobertas
              </CardTitle>
              <CardDescription>
                {permissions?.length || 0} permissões em{' '}
                {Object.keys(permissionsByModule || {}).length} módulos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {permissionsByModule && Object.keys(permissionsByModule).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(permissionsByModule).map(([moduleKey, module]) => (
                <div key={moduleKey}>
                  <h4 className="font-medium mb-2">{module.module_name}</h4>
                  <div className="space-y-2">
                    {module.permissions.map((perm) => (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                      >
                        <div>
                          <p className="font-mono text-sm">{perm.permission_key}</p>
                          {perm.description && (
                            <p className="text-xs text-muted-foreground">
                              {perm.description}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={
                            perm.lifecycle === 'active' ? 'default' : 'secondary'
                          }
                        >
                          {perm.lifecycle}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma permissão descoberta. Clique em "Sync Permissions" para
              buscar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
