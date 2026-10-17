import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorState({
  title = 'Não foi possível carregar as informações',
  description = 'Verifique sua conexão ou tente novamente mais tarde.',
  onRetry,
  retryLabel = 'Tentar novamente',
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-rose-200/60 bg-rose-50/40 p-8 text-center transition-colors dark:border-rose-900/40 dark:bg-rose-950/20',
        className
      )}
      role="alert"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
        <AlertCircle className="h-6 w-6" />
      </div>

      <h3 className="text-base font-semibold text-rose-950 dark:text-rose-200">
        {title}
      </h3>

      <p className="mt-1 max-w-md text-sm text-rose-700/80 dark:text-rose-300/80">
        {description}
      </p>

      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-rose-200 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/40"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
