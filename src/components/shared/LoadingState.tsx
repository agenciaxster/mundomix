import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  text?: string
  message?: string
  description?: string
  className?: string
  variant?: 'spinner' | 'skeleton'
}

export function LoadingState({
  text,
  message,
  description,
  className,
  variant = 'spinner',
}: LoadingStateProps) {
  const displayText = text ?? message ?? 'Carregando informações...'
  if (variant === 'skeleton') {
    return (
      <div className={cn('w-full space-y-3 p-4 animate-pulse', className)}>
        <div className="h-6 w-1/3 rounded-md bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-2/3 rounded-md bg-slate-200 dark:bg-slate-800" />
        <div className="h-24 w-full rounded-xl bg-slate-100 dark:bg-slate-800/50" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-500" />
      <span className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">
        {displayText}
      </span>
      {description && (
        <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {description}
        </span>
      )}
    </div>
  )
}
