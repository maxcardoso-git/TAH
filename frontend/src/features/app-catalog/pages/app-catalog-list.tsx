import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import apiClient, { PaginatedResponse } from "@/api/client"
import { AppCatalog, AppCatalogCreate, CatalogStatus, AppCategory } from "@/types/application"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Search, Library, Loader2, Pencil, Trash2, Building2, CheckCircle, XCircle, Palette, Factory, Shield, Database, Settings } from "lucide-react"
import { formatRelativeDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const STATUS_COLORS: Record<CatalogStatus, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
}

const CATEGORY_CONFIG: Record<AppCategory, { label: string; color: string; icon: typeof Palette }> = {
  studio: { label: "Studio", color: "bg-purple-100 text-purple-800", icon: Palette },
  production: { label: "Production", color: "bg-blue-100 text-blue-800", icon: Factory },
  governance: { label: "Governance", color: "bg-amber-100 text-amber-800", icon: Shield },
  data: { label: "Data", color: "bg-emerald-100 text-emerald-800", icon: Database },
  settings: { label: "Settings", color: "bg-slate-100 text-slate-800", icon: Settings },
}

const CATEGORIES: AppCategory[] = ["studio", "production", "governance", "data", "settings"]

export function AppCatalogListPage() {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingApp, setEditingApp] = useState<AppCatalog | null>(null)
  const [formData, setFormData] = useState<AppCatalogCreate>({
    id: "",
    name: "",
    description: "",
    logo_url: "",
    category: undefined,
    status: "active",
  })
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["app-catalog", search],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<AppCatalog>>(
        "/app-catalog"
      )
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: AppCatalogCreate) => {
      const response = await apiClient.post<AppCatalog>("/app-catalog", data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-catalog"] })
      closeDialog()
      toast({ title: "App adicionado ao catálogo" })
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AppCatalogCreate> }) => {
      const response = await apiClient.patch<AppCatalog>(`/app-catalog/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-catalog"] })
      closeDialog()
      toast({ title: "App atualizado" })
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/app-catalog/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-catalog"] })
      toast({ title: "App removido do catálogo" })
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" })
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CatalogStatus }) => {
      const response = await apiClient.patch<AppCatalog>(`/app-catalog/${id}`, { status })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-catalog"] })
      toast({ title: "Status atualizado" })
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" })
    },
  })

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingApp(null)
    setFormData({ id: "", name: "", description: "", logo_url: "", category: undefined, status: "active" })
  }

  const openEditDialog = (app: AppCatalog) => {
    setEditingApp(app)
    setFormData({
      id: app.id,
      name: app.name,
      description: app.description || "",
      logo_url: app.logo_url || "",
      category: app.category || undefined,
      status: app.status,
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingApp) {
      updateMutation.mutate({
        id: editingApp.id,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          logo_url: formData.logo_url || undefined,
          category: formData.category || undefined,
          status: formData.status,
        },
      })
    } else {
      createMutation.mutate(formData)
    }
  }

  const generateId = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
  }

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      id: !editingApp && (!prev.id || prev.id === generateId(prev.name))
        ? generateId(name)
        : prev.id,
    }))
  }

  const toggleStatus = (app: AppCatalog) => {
    const newStatus: CatalogStatus = app.status === "active" ? "inactive" : "active"
    toggleStatusMutation.mutate({ id: app.id, status: newStatus })
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">App Catalog</h1>
          <p className="text-muted-foreground">
            Dicionário global de aplicações disponíveis na plataforma
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo App
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingApp ? "Editar App" : "Novo App no Catálogo"}
                </DialogTitle>
                <DialogDescription>
                  {editingApp
                    ? "Atualize as informações do app."
                    : "Adicione um novo app ao catálogo global."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="appName">Nome</Label>
                  <Input
                    id="appName"
                    placeholder="Nome do App"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                  />
                </div>
                {!editingApp && (
                  <div className="grid gap-2">
                    <Label htmlFor="appId">ID</Label>
                    <Input
                      id="appId"
                      placeholder="meu_app"
                      value={formData.id}
                      onChange={(e) => setFormData((prev) => ({ ...prev, id: e.target.value }))}
                      className="font-mono"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Identificador único (snake_case)
                    </p>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="appDescription">Descrição</Label>
                  <Textarea
                    id="appDescription"
                    placeholder="Descrição do app"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="appLogoUrl">URL do Logo</Label>
                  <Input
                    id="appLogoUrl"
                    placeholder="/logo.png ou https://..."
                    value={formData.logo_url}
                    onChange={(e) => setFormData((prev) => ({ ...prev, logo_url: e.target.value }))}
                  />
                  {formData.logo_url && (
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded border overflow-hidden bg-muted">
                        <img
                          src={formData.logo_url}
                          alt="Preview"
                          className="w-full h-full object-contain"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">Preview</span>
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="appCategory">Categoria</Label>
                  <Select 
                    value={formData.category || ""} 
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, category: v as AppCategory || undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => {
                        const config = CATEGORY_CONFIG[cat]
                        const Icon = config.icon
                        return (
                          <SelectItem key={cat} value={cat}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {config.label}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="appStatus">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v as CatalogStatus }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Ativo
                        </div>
                      </SelectItem>
                      <SelectItem value="inactive">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-gray-500" />
                          Inativo
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingApp ? "Salvar" : "Criar"}
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
            placeholder="Pesquisar no catálogo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : data?.items.length === 0 ? (
        <Card className="p-12 text-center">
          <Library className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Catálogo vazio</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Adicione apps ao catálogo global.
          </p>
          <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo App
          </Button>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Logo</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[120px]">Categoria</TableHead>
                <TableHead className="w-[100px] text-center">Status</TableHead>
                <TableHead className="w-[100px] text-center">Tenants</TableHead>
                <TableHead className="w-[120px]">Criado</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((app) => (
                <TableRow key={app.id} className={app.status === "inactive" ? "opacity-60" : ""}>
                  <TableCell>
                    {app.logo_url ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted">
                        <img
                          src={app.logo_url}
                          alt={app.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Library className="h-5 w-5 text-primary" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{app.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{app.id}</div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <span className="text-sm text-muted-foreground line-clamp-2">
                      {app.description || "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {app.category ? (
                      (() => {
                        const config = CATEGORY_CONFIG[app.category]
                        const Icon = config.icon
                        return (
                          <Badge className={config.color}>
                            <Icon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        )
                      })()
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      className={`cursor-pointer ${STATUS_COLORS[app.status]}`}
                      onClick={() => toggleStatus(app)}
                    >
                      {app.status === "active" ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {app.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {app.tenant_count !== undefined && app.tenant_count > 0 ? (
                      <Badge variant="outline">
                        <Building2 className="h-3 w-3 mr-1" />
                        {app.tenant_count}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelativeDate(app.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(app)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Remover ${app.name} do catálogo?`)) {
                            deleteMutation.mutate(app.id)
                          }
                        }}
                        disabled={deleteMutation.isPending || (app.tenant_count !== undefined && app.tenant_count > 0)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
