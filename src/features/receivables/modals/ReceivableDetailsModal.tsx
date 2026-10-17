import { useState, useEffect } from 'react'
import {
  FileText,
  User,
  DollarSign,
  X,
  Receipt,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { receivableService } from '@/lib/services/receivable.service'
import type { ReceivableInstallment, ReceivablePayment } from '@/types/receivable'

interface ReceivableDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  installment: ReceivableInstallment | null
  onOpenReceive?: (inst: ReceivableInstallment) => void
}

export function ReceivableDetailsModal({
  isOpen,
  onClose,
  installment,
  onOpenReceive,
}: ReceivableDetailsModalProps) {
  const [payments, setPayments] = useState<ReceivablePayment[]>([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(false)

  useEffect(() => {
    if (isOpen && installment) {
      setIsLoadingPayments(true)
      receivableService
        .getInstallmentPayments(installment.id)
        .then((p) => setPayments(p))
        .catch((e) => console.warn('Aviso ao carregar pagamentos da parcela:', e))
        .finally(() => setIsLoadingPayments(false))
    }
  }, [isOpen, installment])

  if (!isOpen || !installment) return null

  const rec = installment.receivable
  const cust = installment.customer
  const isPaid = installment.status === 'paid'
  const isOverdue = installment.status === 'overdue'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Título {rec?.document_number || 'Financeiro'}
              </span>
              <h2 className="text-base font-bold text-white">Detalhes da Parcela #{installment.installment_number}</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Card Resumo do Cliente e Título */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-400" />
                <span className="font-bold text-sm text-slate-200">{cust?.name || 'Cliente'}</span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                  isPaid
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : isOverdue
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {isPaid ? 'Quitada' : isOverdue ? 'Vencida' : 'Em Aberto'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Vencimento</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {new Date(installment.due_date).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Valor Original</span>
                <span className="font-mono text-slate-200 font-semibold">
                  R$ {installment.original_amount.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Pago</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  R$ {installment.paid_amount.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Devedor</span>
                <span className="font-mono text-base font-black text-white">
                  R$ {installment.balance_amount.toFixed(2)}
                </span>
              </div>
            </div>

            {rec?.description && (
              <p className="text-xs text-slate-400 italic pt-1">
                Ref: {rec.description}
              </p>
            )}
          </div>

          {/* Histórico Auditável de Recebimentos desta Parcela */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-400" />
              Histórico de Pagamentos Recebidos ({payments.length})
            </h3>

            {isLoadingPayments ? (
              <div className="p-4 text-center text-xs text-slate-400">Carregando pagamentos...</div>
            ) : payments.length === 0 ? (
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-850/40 text-center text-xs text-slate-400">
                Nenhum pagamento registrado ainda para esta parcela.
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl border border-slate-800 bg-slate-850/70 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white capitalize">{p.payment_method}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(p.payment_date).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block">
                        Recebido por: {p.received_by_name || 'Operador'}
                        {p.notes ? ` • ${p.notes}` : ''}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        + R$ {p.amount_paid.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-850/80">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            Fechar
          </Button>

          {!isPaid && onOpenReceive && (
            <Button
              type="button"
              onClick={() => {
                onClose()
                onOpenReceive(installment)
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl flex items-center gap-2 text-xs shadow-md shadow-emerald-950/40"
            >
              <DollarSign className="h-4 w-4" />
              Receber Esta Parcela
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
