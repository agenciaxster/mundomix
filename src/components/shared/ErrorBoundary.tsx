import React, { Component, type ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Erro capturado no render React:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Ocorreu um erro ao carregar a página
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {this.state.error?.message || 'Erro inesperado na renderização.'}
            </p>
            {this.state.error?.stack && (
              <pre className="text-[11px] text-left p-3 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-slate-700 dark:text-slate-300 overflow-x-auto max-h-40">
                {this.state.error.stack}
              </pre>
            )}
            <div className="pt-2 flex justify-center gap-3">
              <Button onClick={this.handleReload} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <RefreshCw className="mr-2 h-4 w-4" /> Recarregar Aplicação
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
