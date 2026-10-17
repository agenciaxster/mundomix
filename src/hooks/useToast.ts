/**
 * Hook simples de toast baseado em eventos DOM.
 * Usa o componente <Toaster /> do shadcn/ui ou um fallback de console.
 */

export interface ToastOptions {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

// Emite um evento customizado que o Toaster escuta
export function toast(options: ToastOptions) {
  const event = new CustomEvent('erp-toast', { detail: options })
  window.dispatchEvent(event)
}

toast.success = (title: string, description?: string) => {
  toast({ title, description, variant: 'default' })
}

toast.error = (title: string, description?: string) => {
  toast({ title, description, variant: 'destructive' })
}

toast.warning = (title: string, description?: string) => {
  toast({ title, description, variant: 'default' })
}

toast.info = (title: string, description?: string) => {
  toast({ title, description, variant: 'default' })
}

export function useToast() {
  return { toast }
}
