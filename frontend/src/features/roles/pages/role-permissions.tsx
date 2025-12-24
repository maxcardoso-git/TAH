import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { FeaturePermissionMatrix, FeaturePermissionBatchUpdate } from '@/types/app-feature'
import { Role } from '@/types/role'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Save, RotateCcw, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Common action types that appear as columns
const ACTION_ORDER = ['read', 'create', 'update', 'delete', 'execute', 'publish', 'export']

const ACTION_LABELS: Record<string, string> = {
  read: 'Read',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  execute: 'Execute',
  publish: 'Publish',
  export: 'Export',
}

export function RolePermissionsPage() {
  const { tenantId, roleId } = useParams<{ tenantId: string; roleId: string }>()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set())
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
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
    queryKey: ['feature-permission-matrix', tenantId, roleId],
    queryFn: async () => {
      const response = await apiClient.get<FeaturePermissionMatrix>(
        `/tenants/${tenantId}/roles/${roleId}/permissions/feature-matrix`
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
      const grant: string[] = []
      const revoke: string[] = []

      // Find permissions to grant (in selected but not in original)
      selectedPermissions.forEach((key) => {
        if (!original.has(key)) {
          grant.push(key)
        }
      })

      // Find permissions to revoke (in original but not in selected)
      original.forEach((key) => {
        if (!selectedPermissions.has(key)) {
          revoke.push(key)
        }
      })

      const body: FeaturePermissionBatchUpdate = { grant, revoke }

      await apiClient.put(
        `/tenants/${tenantId}/roles/${roleId}/permissions/features`,
        body
      )
    },
    onSuccess: () => {
      toast({ title: 'Permissions saved successfully' })
      setHasChanges(false)
      queryClient.invalidateQueries({
        queryKey: ['feature-permission-matrix', tenantId, roleId],
      })
    },
    onError: () => {
      toast({ title: 'Error saving permissions', variant: 'destructive' })
    },
  })

  const toggleApp = (appId: string) => {
    const newExpanded = new Set(expandedApps)
    if (newExpanded.has(appId)) {
      newExpanded.delete(appId)
    } else {
      newExpanded.add(appId)
    }
    setExpandedApps(newExpanded)
  }

  const toggleModuleExpand = (moduleKey: string) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(moduleKey)) {
      newExpanded.delete(moduleKey)
    } else {
      newExpanded.add(moduleKey)
    }
    setExpandedModules(newExpanded)
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

  const toggleFeatureAllActions = (featureId: string, actionKeys: string[]) => {
    const allSelected = actionKeys.every((k) => selectedPermissions.has(k))
    const newSelected = new Set(selectedPermissions)

    if (allSelected) {
      actionKeys.forEach((k) => newSelected.delete(k))
    } else {
      actionKeys.forEach((k) => newSelected.add(k))
    }

    setSelectedPermissions(newSelected)
    setHasChanges(true)
  }

  const toggleModuleAllActions = (modulePermKeys: string[]) => {
    const allSelected = modulePermKeys.every((k) => selectedPermissions.has(k))
    const newSelected = new Set(selectedPermissions)

    if (allSelected) {
      modulePermKeys.forEach((k) => newSelected.delete(k))
    } else {
      modulePermKeys.forEach((k) => newSelected.add(k))
    }

    setSelectedPermissions(newSelected)
    setHasChanges(true)
  }

  const resetChanges = () => {
    setSelectedPermissions(new Set(matrix?.granted_permissions || []))
    setHasChanges(false)
  }

  // Get all unique actions across all features for column headers
  const getAllActions = () => {
    const actions = new Set<string>()
    matrix?.applications.forEach((app) => {
      app.modules.forEach((module) => {
        module.features.forEach((feature) => {
          feature.actions.forEach((action) => {
            actions.add(action.action)
          })
        })
      })
    })
    // Return sorted by ACTION_ORDER, then alphabetically for any extras
    return Array.from(actions).sort((a, b) => {
      const aIndex = ACTION_ORDER.indexOf(a)
      const bIndex = ACTION_ORDER.indexOf(b)
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })
  }

  const allActions = getAllActions()

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
            {role?.name} - Manage feature permissions assigned to this role
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
          <CardTitle>Feature Permissions Matrix</CardTitle>
          <CardDescription>
            Select the feature actions this role should have access to
          </CardDescription>
        </CardHeader>
        <CardContent>
          {matrix?.applications.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No applications enabled for this tenant
            </p>
          ) : (
            <div className="space-y-4">
              {matrix?.applications.map((app) => {
                // Count total permissions for this app
                let totalPerms = 0
                let grantedPerms = 0
                app.modules.forEach((m) => {
                  m.features.forEach((f) => {
                    f.actions.forEach((a) => {
                      totalPerms++
                      if (selectedPermissions.has(a.permission_key)) {
                        grantedPerms++
                      }
                    })
                  })
                })

                return (
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
                          {grantedPerms}/{totalPerms} permissions
                        </Badge>
                      </div>
                    </button>

                    {/* Modules with Feature Tables */}
                    {expandedApps.has(app.application_id) && (
                      <div className="border-t">
                        {app.modules.map((module) => {
                          // Get all permission keys for this module
                          const modulePermKeys: string[] = []
                          module.features.forEach((f) => {
                            f.actions.forEach((a) => {
                              modulePermKeys.push(a.permission_key)
                            })
                          })

                          const allModuleSelected = modulePermKeys.every((k) =>
                            selectedPermissions.has(k)
                          )
                          const someModuleSelected = modulePermKeys.some((k) =>
                            selectedPermissions.has(k)
                          )

                          const moduleExpandKey = `${app.application_id}:${module.module_key}`

                          return (
                            <div key={module.module_key} className="border-b last:border-b-0">
                              {/* Module Header */}
                              <div className="flex items-center gap-3 p-3 bg-muted/30">
                                <Checkbox
                                  checked={allModuleSelected}
                                  ref={(el) => {
                                    if (el) {
                                      // Indeterminate state for partial selection
                                      const input = el.querySelector('button')
                                      if (input) {
                                        (input as HTMLButtonElement).dataset.state =
                                          someModuleSelected && !allModuleSelected ? 'indeterminate' :
                                          allModuleSelected ? 'checked' : 'unchecked'
                                      }
                                    }
                                  }}
                                  onCheckedChange={() => toggleModuleAllActions(modulePermKeys)}
                                />
                                <button
                                  className="flex items-center gap-2 flex-1 text-left"
                                  onClick={() => toggleModuleExpand(moduleExpandKey)}
                                >
                                  {expandedModules.has(moduleExpandKey) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <span className="font-medium text-sm">
                                    {module.module_name || module.module_key}
                                  </span>
                                  <Badge variant="secondary" className="text-xs">
                                    {module.features.length} features
                                  </Badge>
                                </button>
                              </div>

                              {/* Features Table */}
                              {expandedModules.has(moduleExpandKey) && (
                                <div className="p-4">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-[40px]"></TableHead>
                                        <TableHead className="min-w-[200px]">Feature</TableHead>
                                        {allActions.map((action) => (
                                          <TableHead
                                            key={action}
                                            className="w-[80px] text-center"
                                          >
                                            {ACTION_LABELS[action] || action}
                                          </TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {module.features.map((feature) => {
                                        // Map actions by action type for easy lookup
                                        const actionMap = new Map(
                                          feature.actions.map((a) => [a.action, a])
                                        )
                                        const featurePermKeys = feature.actions.map(
                                          (a) => a.permission_key
                                        )
                                        const allFeatureSelected = featurePermKeys.every(
                                          (k) => selectedPermissions.has(k)
                                        )

                                        return (
                                          <TableRow key={feature.id}>
                                            <TableCell>
                                              <Checkbox
                                                checked={allFeatureSelected}
                                                onCheckedChange={() =>
                                                  toggleFeatureAllActions(
                                                    feature.id,
                                                    featurePermKeys
                                                  )
                                                }
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium">
                                                  {feature.name}
                                                </span>
                                                {feature.description && (
                                                  <TooltipProvider>
                                                    <Tooltip>
                                                      <TooltipTrigger>
                                                        <Info className="h-3 w-3 text-muted-foreground" />
                                                      </TooltipTrigger>
                                                      <TooltipContent>
                                                        <p className="max-w-xs">
                                                          {feature.description}
                                                        </p>
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  </TooltipProvider>
                                                )}
                                                {feature.is_public && (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-xs"
                                                  >
                                                    Public
                                                  </Badge>
                                                )}
                                                {feature.lifecycle === 'deprecated' && (
                                                  <Badge
                                                    variant="destructive"
                                                    className="text-xs"
                                                  >
                                                    Deprecated
                                                  </Badge>
                                                )}
                                              </div>
                                              <p className="text-xs text-muted-foreground font-mono">
                                                {feature.id}
                                              </p>
                                            </TableCell>
                                            {allActions.map((action) => {
                                              const actionData = actionMap.get(action)
                                              if (!actionData) {
                                                return (
                                                  <TableCell
                                                    key={action}
                                                    className="text-center"
                                                  >
                                                    <span className="text-muted-foreground">
                                                      -
                                                    </span>
                                                  </TableCell>
                                                )
                                              }
                                              return (
                                                <TableCell
                                                  key={action}
                                                  className="text-center"
                                                >
                                                  <Checkbox
                                                    checked={selectedPermissions.has(
                                                      actionData.permission_key
                                                    )}
                                                    onCheckedChange={() =>
                                                      togglePermission(
                                                        actionData.permission_key
                                                      )
                                                    }
                                                    className={cn(
                                                      selectedPermissions.has(
                                                        actionData.permission_key
                                                      ) && 'data-[state=checked]:bg-primary'
                                                    )}
                                                  />
                                                </TableCell>
                                              )
                                            })}
                                          </TableRow>
                                        )
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
