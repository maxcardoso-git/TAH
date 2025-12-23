import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  email: string | null
  display_name: string | null
  tenant_id: string | null
  roles: string[]
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing token on mount
    const storedToken = localStorage.getItem('access_token')
    if (storedToken) {
      setToken(storedToken)
      // Decode token to get user info (simplified)
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]))
        setUser({
          id: payload.sub,
          email: payload.email || null,
          display_name: payload.name || null,
          tenant_id: payload.tenant_id || null,
          roles: payload.roles || [],
        })
      } catch {
        // Invalid token
        localStorage.removeItem('access_token')
      }
    }
    setIsLoading(false)
  }, [])

  const login = (newToken: string) => {
    localStorage.setItem('access_token', newToken)
    setToken(newToken)

    try {
      const payload = JSON.parse(atob(newToken.split('.')[1]))
      setUser({
        id: payload.sub,
        email: payload.email || null,
        display_name: payload.name || null,
        tenant_id: payload.tenant_id || null,
        roles: payload.roles || [],
      })
    } catch {
      // Invalid token
    }
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('current_tenant_id')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
