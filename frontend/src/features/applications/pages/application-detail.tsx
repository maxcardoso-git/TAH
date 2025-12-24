import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { Application, AppStatus, ApplicationUpdate } from '@/types/application'
import { AppFeature, FeatureSyncResponse } from '@/types/app-feature'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RefreshCw,
  Edit,
  Layers,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  CheckCircle2,
  XCircle,
  PlayCircle,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'
import { useToast } from '@/hooks/use-toast'
import { FeatureDialog } from '../components/feature-dialog'

const LIFECYCLE_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  deprecated: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  removed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const ACTION_COLORS: Record<string, string> = {
  read: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  create: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  update: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  execute: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  publish: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  export: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
}

export function ApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editBaseUrl, setEditBaseUrl] = useState('')
  const [editFeaturesManifestUrl, setEditFeaturesManifestUrl] = useState('')
  const [editStatus, setEditStatus] = useState<AppStatus>('active')
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [isFeatureDialogOpen, setIsFeatureDialogOpen] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<AppFeature | null>(null)
  const [manifestTestStatus, setManifestTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [manifestTestMessage, setManifestTestMessage] = useState('')

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

  const { data: features } = useQuery({
    queryKey: ['application-features', applicationId],
    queryFn: async () => {
      const response = await apiClient.get<AppFeature[]>(
        `/applications/${applicationId}/features`
      )
      return response.data
    },
    enabled: !!applicationId,
  })

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<FeatureSyncResponse>(
        `/applications/${applicationId}/features/sync`
      )
      return response.data
    },
    onSuccess: (data) => {
      if (data.status === 'success') {
        toast({
          title: 'Features synced successfully',
          description: `Added: ${data.summary.added}, Updated: ${data.summary.updated}, Deprecated: ${data.summary.deprecated}`,
        })
      } else if (data.status === 'error') {
        toast({
          title: 'Error syncing features',
          description: data.error_message,
          variant: 'destructive',
        })
      }
      queryClient.invalidateQueries({ queryKey: ['application', applicationId] })
      queryClient.invalidateQueries({
        queryKey: ['application-features', applicationId],
      })
    },
    onError: () => {
      toast({
        title: 'Error syncing features',
        variant: 'destructive',
      })
    },
  })

  const updateAppMutation = useMutation({
    mutationFn: async (data: ApplicationUpdate) => {
      const response = await apiClient.patch<Application>(
        `/applications/${applicationId}`,
        data
      )
      return response.data
    },
    onSuccess: () => {
      toast({ title: 'Application updated successfully' })
      queryClient.invalidateQueries({ queryKey: ['application', applicationId] })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setIsEditDialogOpen(false)
    },
    onError: () => {
      toast({
        title: 'Error updating application',
        variant: 'destructive',
      })
    },
  })

  const openEditDialog = () => {
    if (app) {
      setEditName(app.name)
      setEditDescription(app.description || '')
      setEditBaseUrl(app.base_url)
      setEditFeaturesManifestUrl(app.features_manifest_url || '')
      setEditStatus(app.status)
      setManifestTestStatus('idle')
      setManifestTestMessage('')
      setIsEditDialogOpen(true)
    }
  }

  const handleUpdateApp = (e: React.FormEvent) => {
    e.preventDefault()
    updateAppMutation.mutate({
      name: editName,
      description: editDescription || undefined,
      base_url: editBaseUrl,
      features_manifest_url: editFeaturesManifestUrl || undefined,
      status: editStatus,
    })
  }

  const toggleModule = (moduleKey: string) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(moduleKey)) {
      newExpanded.delete(moduleKey)
    } else {
      newExpanded.add(moduleKey)
    }
    setExpandedModules(newExpanded)
  }

  const openFeatureDialog = (feature?: AppFeature) => {
    setSelectedFeature(feature || null)
    setIsFeatureDialogOpen(true)
  }

  const testManifestUrl = async () => {
    setManifestTestStatus('testing')
    setManifestTestMessage('')

    // Build the URL to test
    let testUrl = editFeaturesManifestUrl
    if (!testUrl) {
      const base = editBaseUrl.replace(/\/$/, '')
      testUrl = `${base}/api/v1/app-features/manifest`
    }

    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        const featuresCount = data.features?.length || 0
        setManifestTestStatus('success')
        setManifestTestMessage(`Connected! Found ${featuresCount} features (v${data.version || 'unknown'})`)
      } else {
        setManifestTestStatus('error')
        setManifestTestMessage(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      setManifestTestStatus('error')
      setManifestTestMessage(error instanceof Error ? error.message : 'Connection failed')
    }
  }

  // Group features by module
  const featuresByModule = features?.reduce(
    (acc, feature) => {
      if (!acc[feature.module]) {
        acc[feature.module] = {
          module_name: feature.module_name || feature.module,
          features: [],
        }
      }
      acc[feature.module].features.push(feature)
      return acc
    },
    {} as Record<string, { module_name: string; features: AppFeature[] }>
  )

  // Count total actions (permissions)
  const totalActions = features?.reduce((acc, f) => acc + f.actions.length, 0) || 0

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
        <p className="text-muted-foreground">Application not found</p>
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
            Sync Features
          </Button>
          <Button variant="outline" onClick={openEditDialog}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <form onSubmit={handleUpdateApp}>
            <DialogHeader>
              <DialogTitle>Edit Application</DialogTitle>
              <DialogDescription>
                Update application information.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  placeholder="Application name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  placeholder="Application description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-base-url">Base URL</Label>
                <Input
                  id="edit-base-url"
                  placeholder="https://api.example.com"
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-features-manifest-url">
                  Features Manifest URL
                  <span className="text-xs text-muted-foreground ml-2">
                    (optional)
                  </span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-features-manifest-url"
                    placeholder="/api/v1/app-features/manifest"
                    value={editFeaturesManifestUrl}
                    onChange={(e) => {
                      setEditFeaturesManifestUrl(e.target.value)
                      setManifestTestStatus('idle')
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={testManifestUrl}
                    disabled={manifestTestStatus === 'testing' || !editBaseUrl}
                  >
                    {manifestTestStatus === 'testing' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : manifestTestStatus === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : manifestTestStatus === 'error' ? (
                      <XCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <PlayCircle className="h-4 w-4" />
                    )}
                    <span className="ml-1">Test</span>
                  </Button>
                </div>
                {manifestTestStatus !== 'idle' && manifestTestMessage && (
                  <p className={`text-xs ${manifestTestStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {manifestTestMessage}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Custom endpoint for features manifest. Leave empty to use default: {'{base_url}'}/api/v1/app-features/manifest
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as AppStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateAppMutation.isPending}>
                {updateAppMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Information</CardTitle>
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
              <dt className="text-muted-foreground">Created at</dt>
              <dd>{formatDate(app.created_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated at</dt>
              <dd>{formatDate(app.updated_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Features
              </CardTitle>
              <CardDescription>
                {features?.length || 0} features with {totalActions} actions in{' '}
                {Object.keys(featuresByModule || {}).length} modules
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => openFeatureDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Feature
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {featuresByModule && Object.keys(featuresByModule).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(featuresByModule).map(([moduleKey, module]) => (
                <div key={moduleKey} className="border rounded-lg">
                  {/* Module Header */}
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    onClick={() => toggleModule(moduleKey)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedModules.has(moduleKey) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{module.module_name}</span>
                      <Badge variant="outline" className="ml-2">
                        {module.features.length} features
                      </Badge>
                    </div>
                  </button>

                  {/* Features List */}
                  {expandedModules.has(moduleKey) && (
                    <div className="border-t">
                      {module.features.map((feature) => (
                        <div
                          key={feature.id}
                          className="flex items-start justify-between p-4 border-b last:border-b-0 hover:bg-muted/30"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{feature.name}</span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {feature.id}
                              </span>
                            </div>
                            {feature.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {feature.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground">
                                Actions:
                              </span>
                              {feature.actions.map((action) => (
                                <Badge
                                  key={action}
                                  className={ACTION_COLORS[action] || 'bg-gray-100 text-gray-800'}
                                  variant="secondary"
                                >
                                  {action}
                                </Badge>
                              ))}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>Path: {feature.path}</span>
                              {feature.is_public && (
                                <Badge variant="outline" className="text-xs">
                                  Public
                                </Badge>
                              )}
                              {!feature.requires_org && (
                                <Badge variant="outline" className="text-xs">
                                  No Org Required
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={LIFECYCLE_COLORS[feature.lifecycle]}>
                              {feature.lifecycle}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openFeatureDialog(feature)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No features discovered. Click "Sync Features" to fetch from the
              application manifest.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Feature Dialog */}
      {applicationId && (
        <FeatureDialog
          applicationId={applicationId}
          feature={selectedFeature}
          open={isFeatureDialogOpen}
          onOpenChange={setIsFeatureDialogOpen}
        />
      )}
    </div>
  )
}
