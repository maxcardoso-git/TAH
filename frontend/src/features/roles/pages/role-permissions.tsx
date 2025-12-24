import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { PermissionMatrix, RolePermissionBatchUpdate } from '@/types/permission'
import { Role } from '@/types/role'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Save, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

export function RolePermissionsPage() {
  const { tenantId, roleId } = useParams<{ tenantId: string; roleId: string }>()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set())
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set()
  )
  const [hasChanges, setHasChanges] = useState(false)

  const { data: role } = useQuery({
    queryKey: ['role', tenantId, roleId],
    queryFn: async () => {
      const response = await apiClient.get<Role>(
        `/tenants/${tenantId}/roles/${roleId}`
      )
      return response.data
    },
    enabled: !!tenantId && !!roleId,
  })

  const { data: matrix, isLoading } = useQuery({
    queryKey: ['permission-matrix', tenantId, roleId],
    queryFn: async () => {
      const response = await apiClient.get<PermissionMatrix>(
        `/tenants/${tenantId}/roles/${roleId}/permissions/matrix`
      )
      // Initialize selected permissions from granted
      setSelectedPermissions(new Set(response.data.granted_permissions))
      return response.data
    },
    enabled: !!tenantId && !!roleId,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const original = new Set(matrix?.granted_permissions || [])
      const grant: Array<{ application_id: string; permission_key: string }> = []
      const revoke: Array<{ application_id: string; permission_key: string }> = []

      // Find permissions to grant (in selected but not in original)
      selectedPermissions.forEach((key) => {
        if (!original.has(key)) {
          const appId = findAppIdForPermission(key)
          if (appId) grant.push({ application_id: appId, permission_key: key })
        }
      })

      // Find permissions to revoke (in original but not in selected)
      original.forEach((key) => {
        if (!selectedPermissions.has(key)) {
          const appId = findAppIdForPermission(key)
          if (appId) revoke.push({ application_id: appId, permission_key: key })
        }
      })

      const body: RolePermissionBatchUpdate = { grant, revoke }

      await apiClient.put(
        `/tenants/${tenantId}/roles/${roleId}/permissions`,
        body
      )
    },
    onSuccess: () => {
      toast({ title: 'Permissions saved successfully' })
      setHasChanges(false)
      queryClient.invalidateQueries({
        queryKey: ['permission-matrix', tenantId, roleId],
      })
    },
    onError: () => {
      toast({ title: 'Error saving permissions', variant: 'destructive' })
    },
  })

  const findAppIdForPermission = (permissionKey: string): string | null => {
    if (!matrix) return null
    for (const app of matrix.applications) {
      for (const module of app.modules) {
        if (module.permissions.some((p) => p.permission_key === permissionKey)) {
          return app.application_id
        }
      }
    }
    return null
  }

  const toggleApp = (appId: string) => {
    const newExpanded = new Set(expandedApps)
    if (newExpanded.has(appId)) {
      newExpanded.delete(appId)
    } else {
      newExpanded.add(appId)
    }
    setExpandedApps(newExpanded)
  }

  const togglePermission = (permissionKey: string) => {
    const newSelected = new Set(selectedPermissions)
    if (newSelected.has(permissionKey)) {
      newSelected.delete(permissionKey)
    } else {
      newSelected.add(permissionKey)
    }
    setSelectedPermissions(newSelected)
    setHasChanges(true)
  }

  const toggleModule = (permissions: string[]) => {
    const allSelected = permissions.every((p) => selectedPermissions.has(p))
    const newSelected = new Set(selectedPermissions)

    if (allSelected) {
      permissions.forEach((p) => newSelected.delete(p))
    } else {
      permissions.forEach((p) => newSelected.add(p))
    }

    setSelectedPermissions(newSelected)
    setHasChanges(true)
  }

  const resetChanges = () => {
    setSelectedPermissions(new Set(matrix?.granted_permissions || []))
    setHasChanges(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <Card className="animate-pulse">
          <CardContent className="h-64" />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Role Permissions</h1>
          <p className="text-muted-foreground">
            {role?.name} - Manage permissions assigned to this role
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={resetChanges}
            disabled={!hasChanges}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-md text-sm">
          You have unsaved changes
        </div>
      )}

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Permissions Matrix</CardTitle>
          <CardDescription>
            Select the permissions this role should have access to
          </CardDescription>
        </CardHeader>
        <CardContent>
          {matrix?.applications.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No applications enabled for this tenant
            </p>
          ) : (
            <div className="space-y-4">
              {matrix?.applications.map((app) => (
                <div key={app.application_id} className="border rounded-lg">
                  {/* App Header */}
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    onClick={() => toggleApp(app.application_id)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedApps.has(app.application_id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{app.application_name}</span>
                      <Badge variant="outline" className="ml-2">
                        {app.modules.reduce(
                          (acc, m) => acc + m.permissions.length,
                          0
                        )}{' '}
                        permissions
                      </Badge>
                    </div>
                  </button>

                  {/* Modules */}
                  {expandedApps.has(app.application_id) && (
                    <div className="border-t">
                      {app.modules.map((module) => {
                        const modulePermKeys = module.permissions.map(
                          (p) => p.permission_key
                        )
                        const allSelected = modulePermKeys.every((k) =>
                          selectedPermissions.has(k)
                        )
                        const someSelected = modulePermKeys.some((k) =>
                          selectedPermissions.has(k)
                        )

                        return (
                          <div key={module.module_key} className="border-b last:border-b-0">
                            {/* Module Header */}
                            <div className="flex items-center gap-3 p-3 bg-muted/30">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = someSelected && !allSelected
                                }}
                                onChange={() => toggleModule(modulePermKeys)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <span className="font-medium text-sm">
                                {module.module_name || module.module_key}
                              </span>
                            </div>

                            {/* Permissions */}
                            <div className="divide-y">
                              {module.permissions.map((perm) => (
                                <label
                                  key={perm.permission_key}
                                  className={cn(
                                    'flex items-center gap-3 p-3 pl-10 cursor-pointer hover:bg-muted/20 transition-colors',
                                    selectedPermissions.has(perm.permission_key) &&
                                      'bg-primary/5'
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedPermissions.has(
                                      perm.permission_key
                                    )}
                                    onChange={() =>
                                      togglePermission(perm.permission_key)
                                    }
                                    className="h-4 w-4 rounded border-gray-300"
                                  />
                                  <div className="flex-1">
                                    <p className="font-mono text-sm">
                                      {perm.permission_key}
                                    </p>
                                    {perm.description && (
                                      <p className="text-xs text-muted-foreground">
                                        {perm.description}
                                      </p>
                                    )}
                                  </div>
                                  {perm.is_new && (
                                    <Badge variant="success">NEW</Badge>
                                  )}
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
