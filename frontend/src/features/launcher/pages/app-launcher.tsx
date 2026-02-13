import { useNavigate } from "react-router-dom"
import { useTenant } from "@/contexts/tenant-context"
import { useAuth } from "@/contexts/auth-context"
import { useQuery, useMutation } from "@tanstack/react-query"
import apiClient from "@/api/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { 
  LayoutDashboard, 
  Settings, 
  Loader2,
  ExternalLink,
  Building2,
  Palette,
  Factory,
  Shield,
  Database,
  Cog,
  Sparkles,
  User,
  LogOut,
} from "lucide-react"

interface AppLauncherItem {
  id: string
  name: string
  description: string | null
  icon: string | null
  logo_url: string | null
  base_url: string
  launch_url: string | null
  callback_url: string | null
  status: string
  category: string | null
}

interface AppLauncherResponse {
  tenant_id: string
  tenant_name: string
  current_user_id?: string | null
  current_user_name?: string | null
  current_user_email?: string | null
  current_user_roles?: string[]
  can_access_admin?: boolean
  applications: AppLauncherItem[]
}

interface AppTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  application_id: string
  permissions: string[]
}

type CategoryKey = "studio" | "production" | "governance" | "data" | "settings" | "other"

interface CategoryConfig {
  label: string
  description: string
  icon: React.ElementType
  gradient: string
  iconBg: string
}

const CATEGORY_CONFIG: Record<CategoryKey, CategoryConfig> = {
  studio: {
    label: "Studio",
    description: "Design & Development Tools",
    icon: Palette,
    gradient: "from-purple-500 to-indigo-600",
    iconBg: "bg-purple-100 text-purple-600",
  },
  production: {
    label: "Production",
    description: "Operations & Execution",
    icon: Factory,
    gradient: "from-blue-500 to-cyan-600",
    iconBg: "bg-blue-100 text-blue-600",
  },
  governance: {
    label: "Governance",
    description: "Compliance & Control",
    icon: Shield,
    gradient: "from-amber-500 to-orange-600",
    iconBg: "bg-amber-100 text-amber-600",
  },
  data: {
    label: "Data",
    description: "Analytics & Storage",
    icon: Database,
    gradient: "from-emerald-500 to-teal-600",
    iconBg: "bg-emerald-100 text-emerald-600",
  },
  settings: {
    label: "Settings",
    description: "Configuration & Admin",
    icon: Cog,
    gradient: "from-slate-500 to-gray-600",
    iconBg: "bg-slate-100 text-slate-600",
  },
  other: {
    label: "Other",
    description: "Additional Applications",
    icon: Sparkles,
    gradient: "from-pink-500 to-rose-600",
    iconBg: "bg-pink-100 text-pink-600",
  },
}

const CATEGORY_ORDER: CategoryKey[] = ["studio", "production", "governance", "data", "settings", "other"]

export function AppLauncherPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { currentTenant } = useTenant()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["app-launcher", currentTenant?.id],
    enabled: !!currentTenant?.id,
    queryFn: async () => {
      const tenantId = currentTenant?.id
      if (!tenantId) {
        throw new Error("No tenant selected")
      }
      const response = await apiClient.get<AppLauncherResponse>(`/auth/apps?tenant_id=${tenantId}`)
      return response.data
    },
  })

  const launchMutation = useMutation({
    mutationFn: async (app: AppLauncherItem) => {
      const response = await apiClient.post<AppTokenResponse>("/auth/app-token", {
        application_id: app.id,
        tenant_id: currentTenant?.id,
      })
      return { app, token: response.data }
    },
    onSuccess: ({ app, token }) => {
      const baseUrl = app.launch_url || app.base_url
      const callbackPath = app.callback_url || "/auth/tah-callback"
      const cleanBaseUrl = baseUrl.replace(/\/$/, "")
      const launchUrl = `${cleanBaseUrl}${callbackPath}?token=${token.access_token}`
      window.open(launchUrl, "_blank")
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to launch application",
        description: error.response?.data?.error?.message || "Unknown error",
      })
    },
  })

  // Group applications by category
  const groupedApps = data?.applications.reduce((acc, app) => {
    const category = (app.category || "other") as CategoryKey
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(app)
    return acc
  }, {} as Record<CategoryKey, AppLauncherItem[]>)

  // Sort apps within each category alphabetically
  if (groupedApps) {
    Object.keys(groupedApps).forEach((key) => {
      groupedApps[key as CategoryKey].sort((a, b) => a.name.localeCompare(b.name))
    })
  }

  if (!currentTenant) {
    navigate("/select-tenant")
    return null
  }

  const canAccessAdmin = Boolean(data?.can_access_admin)
  const userDisplayName = data?.current_user_name || user?.display_name || user?.email || "User"
  const currentRoles = data?.current_user_roles || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading applications...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 gap-4">
        <p className="text-muted-foreground">Failed to load applications</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-primary/10">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{data?.tenant_name}</h1>
                <p className="text-sm text-muted-foreground">Application Launcher</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{userDisplayName}</span>
                {currentRoles.length > 0 && (
                  <Badge variant="secondary">
                    {currentRoles.join(" · ")}
                  </Badge>
                )}
              </div>
              {canAccessAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/tenants/${data?.tenant_id}`)}
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Admin
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-6 py-8">
        {data?.applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="p-4 rounded-full bg-slate-100 mb-4">
              <LayoutDashboard className="h-12 w-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No applications available</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Your administrator hasn't enabled any applications for your organization yet.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {CATEGORY_ORDER.map((categoryKey) => {
              const apps = groupedApps?.[categoryKey]
              if (!apps || apps.length === 0) return null

              const config = CATEGORY_CONFIG[categoryKey]
              const Icon = config.icon

              return (
                <section key={categoryKey}>
                  {/* Category Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} text-white shadow-lg`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{config.label}</h2>
                      <p className="text-sm text-muted-foreground">{config.description}</p>
                    </div>
                    <Badge variant="secondary" className="ml-auto">
                      {apps.length} {apps.length === 1 ? "app" : "apps"}
                    </Badge>
                  </div>

                  {/* Apps Grid */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {apps.map((app) => {
                      const isLaunching = launchMutation.isPending && 
                        launchMutation.variables?.id === app.id

                      return (
                        <div
                          key={app.id}
                          onClick={() => !isLaunching && launchMutation.mutate(app)}
                          className="group relative bg-white rounded-xl border border-slate-200 p-5 cursor-pointer 
                                   transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 
                                   hover:border-slate-300 hover:-translate-y-1"
                        >
                          {/* App Icon/Logo */}
                          <div className="flex items-start gap-4 mb-3">
                            {app.logo_url ? (
                              <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 border">
                                <img 
                                  src={app.logo_url} 
                                  alt={app.name}
                                  className="w-full h-full object-contain p-1"
                                />
                              </div>
                            ) : (
                              <div className={`w-14 h-14 rounded-xl ${config.iconBg} flex items-center justify-center shrink-0`}>
                                <Icon className="h-7 w-7" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 truncate group-hover:text-primary transition-colors">
                                {app.name}
                              </h3>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {app.base_url.replace(/https?:\/\//, "").replace(/\/$/, "")}
                              </p>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-slate-600 line-clamp-2 min-h-[40px]">
                            {app.description || "No description available"}
                          </p>

                          {/* Launch Button */}
                          <div className="mt-4 flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {app.status}
                            </Badge>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              disabled={isLaunching}
                              className="gap-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {isLaunching ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Opening...
                                </>
                              ) : (
                                <>
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Launch
                                </>
                              )}
                            </Button>
                          </div>

                          {/* Hover Glow Effect */}
                          <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${config.gradient} opacity-0 
                                         group-hover:opacity-5 transition-opacity pointer-events-none`} />
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 mt-12">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <p className="text-xs text-center text-muted-foreground">
            TAH - Tenant Access Hub • {data?.applications.length || 0} applications available
          </p>
        </div>
      </footer>
    </div>
  )
}
