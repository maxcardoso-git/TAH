import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient, { PaginatedResponse } from '@/api/client'
import { UserWithRoles } from '@/types/user'
import { Role } from '@/types/role'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Plus, Search, User, Shield, Mail, Loader2, X, Edit } from 'lucide-react'
import { STATUS_COLORS } from '@/lib/constants'

export function UsersListPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteDisplayName, setInviteDisplayName] = useState('')
  const [manageUser, setManageUser] = useState<UserWithRoles | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [editUser, setEditUser] = useState<UserWithRoles | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const queryClient = useQueryClient()

  // Fetch available roles for the tenant
  const { data: rolesData } = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<Role>>(
        `/tenants/${tenantId}/roles`
      )
      return response.data
    },
    enabled: !!tenantId && !!manageUser,
  })

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

  const assignRolesMutation = useMutation({
    mutationFn: async ({ userId, roleIds }: { userId: string; roleIds: string[] }) => {
      const response = await apiClient.post(
        `/tenants/${tenantId}/users/${userId}/roles`,
        { role_ids: roleIds }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', tenantId] })
    },
  })

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      await apiClient.delete(`/tenants/${tenantId}/users/${userId}/roles/${roleId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', tenantId] })
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, displayName }: { userId: string; displayName: string }) => {
      const response = await apiClient.patch(
        `/tenants/${tenantId}/users/${userId}`,
        { display_name: displayName }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', tenantId] })
      setEditUser(null)
    },
  })

  const openEditDialog = (user: UserWithRoles) => {
    setEditUser(user)
    setEditDisplayName(user.display_name || '')
  }

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    updateUserMutation.mutate({
      userId: editUser.id,
      displayName: editDisplayName,
    })
  }

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault()
    inviteUserMutation.mutate({
      email: inviteEmail,
      display_name: inviteDisplayName || undefined,
    })
  }

  const handleOpenManageDialog = (user: UserWithRoles) => {
    setManageUser(user)
    setSelectedRoles([])
  }

  const handleCloseManageDialog = () => {
    setManageUser(null)
    setSelectedRoles([])
  }

  const handleToggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    )
  }

  const handleAssignRoles = async () => {
    if (!manageUser || selectedRoles.length === 0) return
    await assignRolesMutation.mutateAsync({
      userId: manageUser.id,
      roleIds: selectedRoles,
    })
    setSelectedRoles([])
    // Refresh user data
    const response = await apiClient.get<PaginatedResponse<UserWithRoles>>(
      `/tenants/${tenantId}/users`
    )
    const updatedUser = response.data.items.find((u) => u.id === manageUser.id)
    if (updatedUser) {
      setManageUser(updatedUser)
    }
  }

  const handleRemoveRole = async (roleId: string) => {
    if (!manageUser) return
    await removeRoleMutation.mutateAsync({
      userId: manageUser.id,
      roleId,
    })
    // Update local state
    setManageUser({
      ...manageUser,
      roles: manageUser.roles.filter((r) => r.id !== roleId),
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

  // Get roles that user doesn't have yet
  const availableRoles = rolesData?.items.filter(
    (role) => !manageUser?.roles.some((ur) => ur.id === role.id)
  ) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            Manage users and their role assignments
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleInviteUser}>
              <DialogHeader>
                <DialogTitle>Invite User</DialogTitle>
                <DialogDescription>
                  Invite a new user to this tenant.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="displayName">Name (optional)</Label>
                  <Input
                    id="displayName"
                    placeholder="User name"
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
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteUserMutation.isPending}>
                  {inviteUserMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Invite
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
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Members</CardTitle>
          <CardDescription>
            {data?.total || 0} users found
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
              No users found
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
                        {user.display_name || 'User'}
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
                            No roles
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

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenManageDialog(user)}
                    >
                      Manage
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <form onSubmit={handleUpdateUser}>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                {editUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-display-name">Display name</Label>
                <Input
                  id="edit-display-name"
                  placeholder="User name"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage User Roles Dialog */}
      <Dialog open={!!manageUser} onOpenChange={(open) => !open && handleCloseManageDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
            <DialogDescription>
              {manageUser?.display_name || manageUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Current Roles */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Current Roles</Label>
              {manageUser?.roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No roles assigned
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {manageUser?.roles.map((role) => (
                    <Badge
                      key={role.id}
                      variant={role.is_system ? 'secondary' : 'outline'}
                      className="flex items-center gap-1 pr-1"
                    >
                      {role.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveRole(role.id)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted"
                        disabled={removeRoleMutation.isPending}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Add Roles */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Add Roles</Label>
              {availableRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All roles already assigned
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {availableRoles.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center space-x-3 py-1"
                    >
                      <Checkbox
                        id={role.id}
                        checked={selectedRoles.includes(role.id)}
                        onCheckedChange={() => handleToggleRole(role.id)}
                      />
                      <label
                        htmlFor={role.id}
                        className="flex-1 text-sm cursor-pointer"
                      >
                        <span className="font-medium">{role.name}</span>
                        {role.description && (
                          <span className="text-muted-foreground ml-2">
                            - {role.description}
                          </span>
                        )}
                      </label>
                      {role.is_system && (
                        <Badge variant="secondary" className="text-xs">
                          System
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseManageDialog}>
              Close
            </Button>
            <Button
              onClick={handleAssignRoles}
              disabled={selectedRoles.length === 0 || assignRolesMutation.isPending}
            >
              {assignRolesMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Assign Roles ({selectedRoles.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
