import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

interface User {
  id: string
  email: string | null
  display_name: string | null
  tenant_id: string | null
  roles: string[]
  permissions: string[]
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (accessToken: string, refreshToken?: string) => void
  logout: () => void
  refreshAccessToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function decodeToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      id: payload.sub,
      email: payload.email || null,
      display_name: payload.name || null,
      tenant_id: payload.tenant_id || null,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
    }
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.exp) return false
    // Consider expired if less than 1 minute left
    return payload.exp * 1000 < Date.now() + 60000
  } catch {
    return true
  }
}

// Internal function to refresh token (outside of component)
async function refreshAccessTokenInternal(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) return null

    const data = await response.json()
    localStorage.setItem('access_token', data.access_token)
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token)
    }
    return data.access_token
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing token on mount
    const storedToken = localStorage.getItem('access_token')
    if (storedToken) {
      const decoded = decodeToken(storedToken)
      if (decoded && !isTokenExpired(storedToken)) {
        setToken(storedToken)
        setUser(decoded)
      } else {
        // Token invalid or expired, try refresh
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          refreshAccessTokenInternal(refreshToken).then((newToken) => {
            if (newToken) {
              setToken(newToken)
              setUser(decodeToken(newToken))
            } else {
              // Refresh failed, clear tokens
              localStorage.removeItem('access_token')
              localStorage.removeItem('refresh_token')
            }
          })
        } else {
          localStorage.removeItem('access_token')
        }
      }
    }
    setIsLoading(false)
  }, [])

  const login = (accessToken: string, refreshToken?: string) => {
    localStorage.setItem('access_token', accessToken)
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken)
    }
    setToken(accessToken)
    setUser(decodeToken(accessToken))
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('current_tenant_id')
    localStorage.removeItem('tah_admin_access_by_tenant')
    setToken(null)
    setUser(null)
  }

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) return null
    return refreshAccessTokenInternal(refreshToken)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Export for use in api client
export { refreshAccessTokenInternal as refreshToken }

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
