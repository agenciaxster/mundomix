import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'

export function PrivateRoute() {
  const { isAuthenticated, isLoading, authError } = useAuth()
  const location = useLocation()

  // Enquanto a sessão está sendo verificada, exibe loading
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingState
          text="Verificando sessão..."
          description="Aguarde enquanto recuperamos sua autenticação."
        />
      </div>
    )
  }

  // Erro crítico de configuração
  if (authError && !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-md">
          <ErrorState
            title="Erro de Configuração"
            description={authError}
          />
        </div>
      </div>
    )
  }

  // Usuário não autenticado → redireciona ao login preservando a rota de origem
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
