import { useState, useEffect } from 'react'
import {
  X,
  FileText,
  DollarSign,
  Receipt,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Trash2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/useToast'
import { payableService } from '@/lib/services/payable.service'
import type { PayableInstallment, PayablePayment } from '@/types/payable'

interface PayableDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  installment: PayableInstallment | null
  companyId: string
  onOpenPay?: (inst: PayableInstallment) => void
  onSuccess?: () => void
}

export function PayableDetailsModal({
  isOpen,
  onClose,
  installment,
  companyId,
  onOpenPay,
  onSuccess,
}: PayableDetailsModalProps) {
  const [payments, setPayments] = useState<PayablePayment[]>([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    if (isOpen && installment) {
      setIsLoadingPayments(true)
      payableService
        .getInstallmentPayments(installment.id)
        .then((list) => setPayments(list))
        .catch((err) => console.warn('Erro ao carregar pagamentos da despesa:', err))
        .finally(() => setIsLoadingPayments(false))
    } else {
      setPayments([])
    }
  }, [isOpen, installment])

  if (!isOpen || !installment) return null

  const payable = installment.payable
  const isPending = ['pending', 'partially_paid', 'overdue'].includes(installment.status)
  const canCancel = payable && Number(payable.paid_amount || 0) <= 0.009 && payable.status !== 'cancelled'

  async function handleCancelPayable() {
    if (!payable) return
    const reason = window.prompt(
      'Informe o motivo do cancelamento desta conta a pagar:\n(O motivo será registrado para fins de auditoria)'
    )
    if (!reason || !reason.trim()) {
      toast.error('O cancelamento foi abortado: motivo é obrigatório.')
      return
    }

    setIsCancelling(true)
    try {
      await payableService.cancelPayable(companyId, payable.id, reason.trim())
      toast.success('Conta a pagar cancelada com sucesso.')
      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cancelar conta a pagar.')
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-rose-400 border border-slate-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Auditoria de Despesa
              </span>
              <h2 className="text-base font-bold text-white">
                {payable?.description || 'Conta a Pagar'} (Parc. {installment.installment_number})
              </h2>
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
        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Informações Gerais */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 text-[11px] block uppercase font-bold">Documento</span>
              <strong className="text-white font-mono">{payable?.document_number || 'Sem documento'}</strong>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block uppercase font-bold">Fornecedor / Favorecido</span>
              <strong className="text-white">{installment.supplier?.name || 'Geral / Não informado'}</strong>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block uppercase font-bold">Categoria</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                {payable?.category?.name || 'Despesas Gerais'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block uppercase font-bold">Emissão</span>
              <span className="text-slate-300">
                {payable?.issue_date ? new Date(payable.issue_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block uppercase font-bold">Vencimento da Parcela</span>
              <span className="text-amber-400 font-bold font-mono">
                {new Date(installment.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block uppercase font-bold">Status da Parcela</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  installment.status === 'paid'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : installment.status === 'partially_paid'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : installment.status === 'overdue'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : installment.status === 'cancelled'
                    ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}
              >
                {installment.status === 'paid' && 'Quitada'}
                {installment.status === 'partially_paid' && 'Parcialmente Paga'}
                {installment.status === 'overdue' && 'Vencida'}
                {installment.status === 'pending' && 'Pendente'}
                {installment.status === 'cancelled' && 'Cancelada'}
              </span>
            </div>
          </div>

          {/* Cards de Valores da Parcela */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Valor Nominal
              </span>
              <span className="text-base font-bold text-white font-mono">
                R$ {installment.amount.toFixed(2)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-0.5">
                Valor Já Pago
              </span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                R$ {installment.paid_amount.toFixed(2)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-0.5">
                Saldo Devedor
              </span>
              <span className="text-base font-black text-rose-400 font-mono">
                R$ {installment.balance_amount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Se cancelada, exibe motivo */}
          {payable?.status === 'cancelled' && payable.cancellation_reason && (
            <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <AlertTriangle className="h-4 w-4" /> Conta Cancelada
              </div>
              <p>Motivo: {payable.cancellation_reason}</p>
            </div>
          )}

          {/* Histórico de Pagamentos Realizados */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Receipt className="h-4 w-4 text-slate-400" /> Histórico de Pagamentos Efetuados
              </span>
              <span className="text-[11px] text-slate-400">
                {payments.length} {payments.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            {isLoadingPayments ? (
              <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
                Carregando histórico...
              </div>
            ) : payments.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-2xl">
                Nenhum pagamento efetuado para esta parcela até o momento.
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-400 font-mono text-sm">
                          R$ {Number(p.amount_paid).toFixed(2)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] uppercase font-bold">
                          {p.payment_method === 'cash' && 'Dinheiro'}
                          {p.payment_method === 'pix' && 'Pix'}
                          {p.payment_method === 'bank_transfer' && 'Transferência'}
                          {p.payment_method === 'bank_slip' && 'Boleto'}
                          {p.payment_method === 'credit_card' && 'Cartão'}
                          {p.payment_method === 'other' && 'Outro'}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(p.payment_date).toLocaleString('pt-BR')}
                        </span>
                        {p.cash_session_id && (
                          <span className="text-cyan-400 font-semibold">
                            &bull; Saída lançada no caixa
                          </span>
                        )}
                        {p.notes && <span className="text-slate-400">&bull; {p.notes}</span>}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-emerald-400 flex items-center gap-1 font-bold text-[11px]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Confirmado
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
          <div>
            {canCancel && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleCancelPayable}
                disabled={isCancelling}
                className="text-xs font-bold bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800"
              >
                {isCancelling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                )}
                Cancelar Conta
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            >
              Fechar
            </Button>
            {isPending && onOpenPay && (
              <Button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenPay(installment)
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-rose-900/30"
              >
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Pagar Parcela
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
