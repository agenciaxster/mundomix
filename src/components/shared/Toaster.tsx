import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastData {
  id: string
  title: string
  description?: string
  variant: 'default' | 'destructive'
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ title: string; description?: string; variant?: 'default' | 'destructive'; duration?: number }>
      const toast: ToastData = {
        id: crypto.randomUUID(),
        title: custom.detail.title,
        description: custom.detail.description,
        variant: custom.detail.variant ?? 'default',
      }
      setToasts((prev) => [...prev, toast])
      const duration = custom.detail.duration ?? 4000
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, duration)
    }

    window.addEventListener('erp-toast', handler)
    return () => window.removeEventListener('erp-toast', handler)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all animate-in slide-in-from-bottom-4',
            toast.variant === 'destructive'
              ? 'border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/80'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          )}
        >
          {toast.variant === 'destructive' ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className={cn(
              'text-sm font-medium',
              toast.variant === 'destructive' ? 'text-rose-800 dark:text-rose-200' : 'text-slate-900 dark:text-slate-100'
            )}>
              {toast.title}
            </div>
            {toast.description && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{toast.description}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
            aria-label="Fechar notificação"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
