import { Link } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="py-12">
      <EmptyState
        icon={FileQuestion}
        title="Página não encontrada"
        description="A rota acessada não existe ou foi movida. Verifique o endereço no menu de navegação."
        action={
          <Button asChild size="sm">
            <Link to="/">Voltar ao Dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}
