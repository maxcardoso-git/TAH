import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { Tenant, TenantStatus, TenantUpdate } from '@/types/tenant'
import { useTenant } from '@/contexts/tenant-context'
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
import { Shield, Users, LayoutGrid, FileText, ArrowRight, Edit, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'

export function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const { setCurrentTenant } = useTenant()
  const queryClient = useQueryClient()

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editStatus, setEditStatus] = useState<TenantStatus>('active')

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: async () => {
      const response = await apiClient.get<Tenant>(`/tenants/${tenantId}`)
      return response.data
    },
    enabled: !!tenantId,
  })

  // Set current tenant context
  useEffect(() => {
    if (tenant) {
      setCurrentTenant(tenant)
    }
  }, [tenant, setCurrentTenant])

  const updateTenantMutation = useMutation({
    mutationFn: async (data: TenantUpdate) => {
      const response = await apiClient.patch<Tenant>(`/tenants/${tenantId}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setIsEditDialogOpen(false)
    },
  })

  const openEditDialog = () => {
    if (tenant) {
      setEditName(tenant.name)
      setEditSlug(tenant.slug || '')
      setEditStatus(tenant.status)
      setIsEditDialogOpen(true)
    }
  }

  const handleUpdateTenant = (e: React.FormEvent) => {
    e.preventDefault()
    updateTenantMutation.mutate({
      name: editName,
      slug: editSlug ? editSlug.toLowerCase() : undefined,
      status: editStatus,
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-24 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Tenant not found</p>
      </div>
    )
  }

  const quickLinks = [
    {
      title: 'Roles',
      description: 'Manage access profiles',
      href: `/tenants/${tenantId}/roles`,
      icon: Shield,
      count: tenant.roles_count,
    },
    {
      title: 'Users',
      description: 'Manage tenant users',
      href: `/tenants/${tenantId}/users`,
      icon: Users,
      count: tenant.users_count,
    },
    {
      title: 'Applications',
      description: 'Apps enabled for this tenant',
      href: `/tenants/${tenantId}/applications`,
      icon: LayoutGrid,
      count: tenant.applications_count,
    },
    {
      title: 'Audit Log',
      description: 'Change history',
      href: `/tenants/${tenantId}/audit`,
      icon: FileText,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{tenant.name}</h1>
            <Badge className={STATUS_COLORS[tenant.status]}>{tenant.status}</Badge>
          </div>
          {tenant.slug && (
            <p className="font-mono text-sm text-muted-foreground mt-1">
              {tenant.slug}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={openEditDialog}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <form onSubmit={handleUpdateTenant}>
            <DialogHeader>
              <DialogTitle>Edit Tenant</DialogTitle>
              <DialogDescription>
                Update tenant information.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  placeholder="Organization name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-slug">Slug</Label>
                <Input
                  id="edit-slug"
                  placeholder="organization-name"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier used in URLs and integrations
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as TenantStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
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
              <Button type="submit" disabled={updateTenantMutation.isPending}>
                {updateTenantMutation.isPending && (
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
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono">{tenant.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created at</dt>
              <dd>{formatDate(tenant.created_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated at</dt>
              <dd>{formatDate(tenant.updated_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge className={STATUS_COLORS[tenant.status]}>
                  {tenant.status}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((link) => (
          <Link key={link.href} to={link.href}>
            <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <link.icon className="h-5 w-5 text-muted-foreground" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg">{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
              {link.count !== undefined && (
                <CardContent>
                  <p className="text-2xl font-bold">{link.count}</p>
                </CardContent>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
