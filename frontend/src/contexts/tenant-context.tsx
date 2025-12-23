import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Tenant } from '@/types/tenant'

interface TenantContextType {
  currentTenant: Tenant | null
  setCurrentTenant: (tenant: Tenant | null) => void
  clearTenant: () => void
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null)

  useEffect(() => {
    // Load tenant from localStorage on mount
    const storedTenant = localStorage.getItem('current_tenant')
    if (storedTenant) {
      try {
        setCurrentTenantState(JSON.parse(storedTenant))
      } catch {
        localStorage.removeItem('current_tenant')
        localStorage.removeItem('current_tenant_id')
      }
    }
  }, [])

  const setCurrentTenant = (tenant: Tenant | null) => {
    setCurrentTenantState(tenant)
    if (tenant) {
      localStorage.setItem('current_tenant', JSON.stringify(tenant))
      localStorage.setItem('current_tenant_id', tenant.id)
    } else {
      localStorage.removeItem('current_tenant')
      localStorage.removeItem('current_tenant_id')
    }
  }

  const clearTenant = () => {
    setCurrentTenantState(null)
    localStorage.removeItem('current_tenant')
    localStorage.removeItem('current_tenant_id')
  }

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        setCurrentTenant,
        clearTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}
