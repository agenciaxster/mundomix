import { useEffect } from 'react'
import { CheckCircle2, ShoppingBag, Sparkles, User, Building2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SaleSuccessModalProps {
  isOpen: boolean
  saleId?: string
  saleCode: string
  total: number
  changeAmount: number
  paymentMethods: string[]
  operatorName?: string
  branchName?: string
  onNewSale: () => void
  onViewHistory: () => void
  onPrintReceipt?: () => void
}

export function SaleSuccessModal({
  isOpen,
  saleId: _saleId,
  saleCode,
  total,
  changeAmount,
  paymentMethods,
  operatorName,
  branchName,
  onNewSale,
  onViewHistory,
  onPrintReceipt,
}: SaleSuccessModalProps) {
  // Atalhos: Enter para nova venda, P para imprimir comprovante
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return
      if (e.key === 'Enter') {
        e.preventDefault()
        onNewSale()
      } else if ((e.key === 'p' || e.key === 'P') && onPrintReceipt) {
        e.preventDefault()
        onPrintReceipt()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onNewSale, onPrintReceipt])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-slate-900 text-white shadow-2xl p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Ícone de Sucesso */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xl shadow-emerald-950/60">
          <CheckCircle2 className="h-10 w-10 animate-bounce duration-1000" />
        </div>

        {/* Título e Código da Venda */}
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" /> Venda Concluída com Sucesso
          </span>
          <h2 className="text-2xl font-black text-white pt-1">Frente de Caixa (PDV)</h2>
          <p className="text-sm font-mono font-bold text-slate-300">
            Identificador: <span className="text-emerald-400">{saleCode}</span>
          </p>
        </div>

        {/* Box com Resumo de Valores */}
        <div className="p-5 rounded-2xl bg-slate-850/80 border border-slate-800 space-y-3 text-left">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 font-medium">Total Pago:</span>
            <span className="text-xl font-black text-white font-mono">
              R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {changeAmount > 0 && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700/60">
              <span className="text-emerald-400 font-bold uppercase tracking-wider text-xs">
                Troco Devolvido:
              </span>
              <span className="text-lg font-black text-emerald-400 font-mono">
                R$ {changeAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1">Pagamento:</span>
            {paymentMethods.map((m, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 capitalize"
              >
                {m}
              </span>
            ))}
          </div>

          {(operatorName || branchName) && (
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              {branchName && (
                <span className="flex items-center gap-1 truncate">
                  <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                  {branchName}
                </span>
              )}
              {operatorName && (
                <span className="flex items-center gap-1 truncate">
                  <User className="h-3 w-3 text-slate-400 shrink-0" />
                  {operatorName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Informação sobre Comprovante Térmico */}
        <p className="text-xs text-slate-400">
          Comprovante não fiscal pronto para impressão térmica (80mm e 58mm).
        </p>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          {onPrintReceipt && (
            <Button
              type="button"
              variant="outline"
              onClick={onPrintReceipt}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-750 text-blue-400 hover:text-blue-300 border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 py-3"
            >
              <Printer className="h-4 w-4" />
              Imprimir (P)
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={onViewHistory}
            className="w-full sm:w-auto text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-850 text-xs"
          >
            Ver Histórico
          </Button>

          <Button
            type="button"
            onClick={onNewSale}
            className="w-full flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 text-sm"
          >
            <ShoppingBag className="h-4 w-4" />
            Nova Venda (Enter)
          </Button>
        </div>
      </div>
    </div>
  )
}
