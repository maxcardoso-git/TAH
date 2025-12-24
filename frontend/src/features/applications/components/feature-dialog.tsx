import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { AppFeature, AppFeatureCreate, AppFeatureUpdate } from '@/types/app-feature'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Badge } from '@/components/ui/badge'
import { Loader2, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface FeatureDialogProps {
  applicationId: string
  feature?: AppFeature | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AVAILABLE_ACTIONS = [
  { value: 'read', label: 'Read', description: 'View/list items' },
  { value: 'create', label: 'Create', description: 'Create new items' },
  { value: 'update', label: 'Update', description: 'Modify existing items' },
  { value: 'delete', label: 'Delete', description: 'Remove items' },
  { value: 'execute', label: 'Execute', description: 'Run operations' },
  { value: 'publish', label: 'Publish', description: 'Publish/make public' },
  { value: 'export', label: 'Export', description: 'Export data' },
]

const MODULE_OPTIONS = [
  { value: 'core', label: 'Core' },
  { value: 'admin', label: 'Admin' },
  { value: 'governance', label: 'Governance' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'tools', label: 'Tools' },
  { value: 'user', label: 'User' },
  { value: 'settings', label: 'Settings' },
  { value: 'reports', label: 'Reports' },
]

const LIFECYCLE_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'deprecated', label: 'Deprecated' },
  { value: 'removed', label: 'Removed' },
]

export function FeatureDialog({
  applicationId,
  feature,
  open,
  onOpenChange,
}: FeatureDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEditing = !!feature

  // Form state
  const [featureId, setFeatureId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [module, setModule] = useState('core')
  const [moduleName, setModuleName] = useState('')
  const [path, setPath] = useState('')
  const [icon, setIcon] = useState('')
  const [actions, setActions] = useState<string[]>(['read'])
  const [displayOrder, setDisplayOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [isPublic, setIsPublic] = useState(false)
  const [requiresOrg, setRequiresOrg] = useState(true)
  const [lifecycle, setLifecycle] = useState('active')

  // Reset form when feature changes
  useEffect(() => {
    if (feature) {
      setFeatureId(feature.id)
      setName(feature.name)
      setDescription(feature.description || '')
      setModule(feature.module)
      setModuleName(feature.module_name || '')
      setPath(feature.path)
      setIcon(feature.icon || '')
      setActions(feature.actions)
      setDisplayOrder(feature.display_order)
      setIsActive(feature.is_active)
      setIsPublic(feature.is_public)
      setRequiresOrg(feature.requires_org)
      setLifecycle(feature.lifecycle)
    } else {
      // Reset to defaults for new feature
      setFeatureId('')
      setName('')
      setDescription('')
      setModule('core')
      setModuleName('')
      setPath('')
      setIcon('')
      setActions(['read'])
      setDisplayOrder(0)
      setIsActive(true)
      setIsPublic(false)
      setRequiresOrg(true)
      setLifecycle('active')
    }
  }, [feature, open])

  const createMutation = useMutation({
    mutationFn: async (data: AppFeatureCreate) => {
      const response = await apiClient.post<AppFeature>(
        `/applications/${applicationId}/features`,
        data
      )
      return response.data
    },
    onSuccess: () => {
      toast({ title: 'Feature created successfully' })
      queryClient.invalidateQueries({
        queryKey: ['application-features', applicationId],
      })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating feature',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: AppFeatureUpdate) => {
      const response = await apiClient.patch<AppFeature>(
        `/applications/${applicationId}/features/${encodeURIComponent(feature!.id)}`,
        data
      )
      return response.data
    },
    onSuccess: () => {
      toast({ title: 'Feature updated successfully' })
      queryClient.invalidateQueries({
        queryKey: ['application-features', applicationId],
      })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating feature',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isEditing) {
      updateMutation.mutate({
        name,
        description: description || undefined,
        module,
        module_name: moduleName || undefined,
        path,
        icon: icon || undefined,
        actions,
        display_order: displayOrder,
        is_active: isActive,
        is_public: isPublic,
        requires_org: requiresOrg,
        lifecycle,
      })
    } else {
      // Generate feature ID: applicationId.module.featureName
      const generatedId =
        featureId || `${applicationId}.${module}.${name.toLowerCase().replace(/\s+/g, '_')}`

      createMutation.mutate({
        id: generatedId,
        name,
        description: description || undefined,
        module,
        module_name: moduleName || undefined,
        path: path || `/${name.toLowerCase().replace(/\s+/g, '-')}`,
        icon: icon || undefined,
        actions,
        display_order: displayOrder,
        is_active: isActive,
        is_public: isPublic,
        requires_org: requiresOrg,
      })
    }
  }

  const toggleAction = (action: string) => {
    if (actions.includes(action)) {
      if (actions.length > 1) {
        setActions(actions.filter((a) => a !== action))
      }
    } else {
      setActions([...actions, action])
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Feature' : 'Create Feature'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the feature configuration.'
                : 'Add a new feature to this application manually.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Feature ID (only for create) */}
            {!isEditing && (
              <div className="grid gap-2">
                <Label htmlFor="feature-id">
                  Feature ID
                  <span className="text-xs text-muted-foreground ml-2">
                    (auto-generated if empty)
                  </span>
                </Label>
                <Input
                  id="feature-id"
                  placeholder="e.g., orchestrator.core.projects"
                  value={featureId}
                  onChange={(e) => setFeatureId(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Format: app.module.feature (e.g., orchestrator.core.projects)
                </p>
              </div>
            )}

            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Feature name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What does this feature do?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Module */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="module">Module *</Label>
                <Select value={module} onValueChange={setModule}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="module-name">Module Display Name</Label>
                <Input
                  id="module-name"
                  placeholder="Human-readable name"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                />
              </div>
            </div>

            {/* Path & Icon */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="path">Path *</Label>
                <Input
                  id="path"
                  placeholder="/projects"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  required={!isEditing}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="icon">Icon</Label>
                <Input
                  id="icon"
                  placeholder="Icon name (e.g., FolderOpen)"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="grid gap-2">
              <Label>Actions *</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_ACTIONS.map((action) => (
                  <Badge
                    key={action.value}
                    variant={actions.includes(action.value) ? 'default' : 'outline'}
                    className="cursor-pointer select-none"
                    onClick={() => toggleAction(action.value)}
                  >
                    {action.label}
                    {actions.includes(action.value) && (
                      <X className="ml-1 h-3 w-3" />
                    )}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select the actions users can perform on this feature.
                At least one action is required.
              </p>
            </div>

            {/* Display Order */}
            <div className="grid gap-2">
              <Label htmlFor="display-order">Display Order</Label>
              <Input
                id="display-order"
                type="number"
                min="0"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                className="w-24"
              />
            </div>

            {/* Lifecycle (only for edit) */}
            {isEditing && (
              <div className="grid gap-2">
                <Label htmlFor="lifecycle">Lifecycle</Label>
                <Select value={lifecycle} onValueChange={setLifecycle}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select lifecycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {LIFECYCLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Flags */}
            <div className="space-y-4">
              <Label>Feature Flags</Label>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={isActive}
                    onCheckedChange={(checked) => setIsActive(checked as boolean)}
                  />
                  <div>
                    <span className="font-medium">Active</span>
                    <p className="text-xs text-muted-foreground">
                      Feature is available for permission assignment
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={isPublic}
                    onCheckedChange={(checked) => setIsPublic(checked as boolean)}
                  />
                  <div>
                    <span className="font-medium">Public</span>
                    <p className="text-xs text-muted-foreground">
                      Feature is accessible without authentication
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={requiresOrg}
                    onCheckedChange={(checked) => setRequiresOrg(checked as boolean)}
                  />
                  <div>
                    <span className="font-medium">Requires Organization</span>
                    <p className="text-xs text-muted-foreground">
                      User must belong to an organization to access
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name || actions.length === 0}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Feature'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
