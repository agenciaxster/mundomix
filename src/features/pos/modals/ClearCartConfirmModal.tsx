import { useEffect } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ClearCartConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  itemCount: number
}

export function ClearCartConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  itemCount,
}: ClearCartConfirmModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onConfirm, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-3xl border border-rose-500/30 bg-slate-900 text-white shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-white">Cancelar e Limpar Venda Atual?</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Esta ação irá remover todos os <strong className="text-white">{itemCount}</strong> itens do carrinho e resetar o PDV para um novo atendimento.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1 text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800 text-xs"
          >
            Voltar (ESC)
          </Button>

          <Button
            type="button"
            onClick={onConfirm}
            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2.5 rounded-xl shadow-lg shadow-rose-950/50 flex items-center justify-center gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            Limpar Venda (Enter)
          </Button>
        </div>
      </div>
    </div>
  )
}
