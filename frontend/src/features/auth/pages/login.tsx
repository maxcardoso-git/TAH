import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Shield, Loader2, AlertCircle } from 'lucide-react'
import apiClient from '@/api/client'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await apiClient.post('/auth/login', {
        email,
      })

      login(response.data.access_token)
      navigate('/tenants')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Erro ao fazer login. Verifique o email.')
    } finally {
      setIsLoading(false)
    }
  }

  // Demo login - get a real token from the backend
  const handleDemoLogin = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await apiClient.post('/auth/dev-token')
      login(response.data.access_token)
      navigate('/tenants')
    } catch {
      setError('Erro ao criar sessao de demonstracao.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">IAM Console</CardTitle>
          <CardDescription>
            Access & Role Management Console
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Use o email de um usuário cadastrado no sistema
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Ou
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full mt-4"
              onClick={handleDemoLogin}
              disabled={isLoading}
            >
              Entrar como Demo
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Cria um usuário demo com acesso admin
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
