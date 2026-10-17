import { X, ShoppingBag, User, Building2, CreditCard, Printer } from 'lucide-react'
import type { Sale } from '@/types/sale'
import { Button } from '@/components/ui/button'

interface SaleDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  sale: Sale | null
  onPrint?: (sale: Sale) => void
}

export function SaleDetailsModal({ isOpen, onClose, sale, onPrint }: SaleDetailsModalProps) {
  if (!isOpen || !sale) return null

  function getPaymentLabel(method: string) {
    switch (method) {
      case 'cash':
        return 'Dinheiro'
      case 'pix':
        return 'Pix'
      case 'credit_card':
        return 'Cartão de Crédito'
      case 'debit_card':
        return 'Cartão de Débito'
      case 'store_credit':
        return 'Crediário'
      default:
        return 'Outros'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Venda {sale.code}</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">
                  Faturada
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Emitida em {new Date(sale.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Informações da Venda */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Dados Gerais: Filial e Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-850/60 border border-slate-800 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">
                Unidade / Filial
              </span>
              <div className="text-white font-bold flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-400" />
                {sale.branch?.name || 'Filial'}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">
                Cliente
              </span>
              <div className="text-white font-bold flex items-center gap-1.5 truncate">
                <User className="h-3.5 w-3.5 text-emerald-400" />
                {sale.customer_name || 'Consumidor Final (Não Identificado)'}
              </div>
              {sale.customer_document && (
                <div className="text-[11px] font-mono text-slate-400">{sale.customer_document}</div>
              )}
            </div>
          </div>

          {/* Tabela de Itens Faturados */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Itens da Venda ({sale.items?.length || 0})
            </h3>

            <div className="rounded-2xl border border-slate-800 bg-slate-850/40 divide-y divide-slate-800/80 overflow-hidden">
              {sale.items && sale.items.length > 0 ? (
                sale.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 text-xs">
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="font-bold text-white truncate">{item.product_name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2">
                        {item.product_sku && <span className="font-mono">SKU: {item.product_sku}</span>}
                        {item.price_type === 'wholesale' && (
                          <span className="text-amber-400 font-bold uppercase text-[9px]">Atacado</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-slate-300">
                        {item.quantity} {item.unit} x R$ {item.unit_price.toFixed(2)}
                      </div>
                      <div className="font-mono font-bold text-white">
                        R$ {item.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">Sem itens registrados.</div>
              )}
            </div>
          </div>

          {/* Formas de Pagamento e Troco */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pagamento(s) Registrado(s)
            </h3>

            <div className="rounded-2xl border border-slate-800 bg-slate-850/40 p-4 space-y-2.5">
              {sale.payments && sale.payments.length > 0 ? (
                sale.payments.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300 flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5 text-blue-400" />
                      {getPaymentLabel(p.payment_method)}
                      {p.installments && p.installments > 1 && (
                        <span className="text-[10px] text-slate-400">({p.installments}x)</span>
                      )}
                    </span>
                    <span className="font-mono font-bold text-white">
                      R$ {p.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400">Sem pagamentos registrados.</div>
              )}

              {sale.change_amount > 0 && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800 text-emerald-400 font-bold">
                  <span>Troco Devolvido:</span>
                  <span className="font-mono">R$ {sale.change_amount.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Totais */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono font-bold text-slate-200">R$ {sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.discount_amount > 0 && (
              <div className="flex items-center justify-between text-rose-400">
                <span>Desconto:</span>
                <span className="font-mono font-bold">- R$ {sale.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-base font-black text-emerald-400 pt-2 border-t border-slate-800">
              <span>Total da Venda:</span>
              <span className="font-mono text-xl">R$ {sale.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-850/80">
          <div>
            {onPrint && (
              <Button
                type="button"
                onClick={() => onPrint(sale)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-950/40"
              >
                <Printer className="h-4 w-4" />
                Imprimir Comprovante
              </Button>
            )}
          </div>
          <Button type="button" onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white text-xs">
            Fechar (ESC)
          </Button>
        </div>
      </div>
    </div>
  )
}
