import { useState, useEffect } from 'react'
import {
  DollarSign,
  Calendar,
  User,
  CreditCard,
  Banknote,
  QrCode,
  Building2,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'
import { receivableService } from '@/lib/services/receivable.service'
import { cashRegisterService } from '@/lib/services/cash-register.service'
import type { ReceivableInstallment, ReceivablePaymentMethod } from '@/types/receivable'
import type { CashSession } from '@/types/cash-register'

interface ReceivePaymentModalProps {
  isOpen: boolean
  onClose: () => void
  installment: ReceivableInstallment | null
  companyId: string
  branchId: string
  userId?: string
  onSuccess: () => void
}

const PAYMENT_METHODS: Array<{
  id: ReceivablePaymentMethod
  label: string
  icon: typeof Banknote
  colorClass: string
}> = [
  { id: 'cash', label: 'Dinheiro', icon: Banknote, colorClass: 'text-emerald-400' },
  { id: 'pix', label: 'Pix', icon: QrCode, colorClass: 'text-teal-400' },
  { id: 'debit_card', label: 'Cartão de Débito', icon: CreditCard, colorClass: 'text-blue-400' },
  { id: 'credit_card', label: 'Cartão de Crédito', icon: CreditCard, colorClass: 'text-indigo-400' },
  { id: 'bank_transfer', label: 'Transferência Bancária', icon: Building2, colorClass: 'text-purple-400' },
  { id: 'other', label: 'Outro', icon: Wallet, colorClass: 'text-slate-400' },
]

export function ReceivePaymentModal({
  isOpen,
  onClose,
  installment,
  companyId,
  branchId,
  userId,
  onSuccess,
}: ReceivePaymentModalProps) {
  const [amountStr, setAmountStr] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<ReceivablePaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [openCashSession, setOpenCashSession] = useState<CashSession | null>(null)

  // Inicializa dados ao abrir
  useEffect(() => {
    if (isOpen && installment) {
      setAmountStr(installment.balance_amount.toFixed(2))
      setPaymentMethod('cash')
      setNotes('')

      // Busca caixa aberto ativo para receber se for em dinheiro
      if (companyId && branchId) {
        cashRegisterService
          .getCurrentOpenSession(companyId, branchId, userId)
          .then((sess) => setOpenCashSession(sess))
          .catch((err) => console.warn('Aviso ao consultar caixa:', err))
      }
    }
  }, [isOpen, installment, companyId, branchId, userId])

  if (!isOpen || !installment) return null

  const numAmount = parseFloat(amountStr) || 0
  const maxAmount = installment.balance_amount
  const isOverpaid = numAmount > maxAmount + 0.009
  const isValidAmount = numAmount > 0 && !isOverpaid
  const newRemaining = Math.max(0, Math.round((maxAmount - numAmount) * 100) / 100)

  async function handleConfirm() {
    if (!installment) return

    if (!isValidAmount) {
      toast.error(`Informe um valor válido entre R$ 0,01 e R$ ${maxAmount.toFixed(2)}.`)
      return
    }

    if (paymentMethod === 'cash' && !openCashSession) {
      const confirmNoCash = window.confirm(
        'Nenhum caixa aberto encontrado para seu operador/filial.\n' +
        'O recebimento em dinheiro será registrado no financeiro, mas não constará no fechamento de caixa do turno atual.\n\n' +
        'Deseja continuar mesmo assim?'
      )
      if (!confirmNoCash) return
    }

    setIsSubmitting(true)
    try {
      await receivableService.receivePayment({
        company_id: companyId,
        branch_id: branchId,
        installment_id: installment.id,
        amount: numAmount,
        payment_method: paymentMethod,
        cash_session_id: paymentMethod === 'cash' ? openCashSession?.id || null : null,
        notes: notes.trim() || undefined,
        idempotency_key: crypto.randomUUID(),
      })

      toast.success(
        `Recebimento de R$ ${numAmount.toFixed(2)} registrado com sucesso!` +
        (newRemaining <= 0 ? ' Parcela totalmente quitada!' : ` Saldo restante: R$ ${newRemaining.toFixed(2)}`)
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Erro ao registrar recebimento:', err)
      toast.error(err.message || 'Falha ao processar recebimento da parcela.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Liquidação / Baixa de Parcela
              </span>
              <h2 className="text-base font-bold text-white">Registrar Recebimento</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Card com Detalhes da Parcela */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Parcela {installment.installment_number} de {installment.receivable?.document_number || 'Crediário'}
              </span>
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-amber-400" />
                Vence em: {new Date(installment.due_date).toLocaleDateString('pt-BR')}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <User className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="truncate">{installment.customer?.name || 'Cliente'}</span>
              {installment.customer?.document && (
                <span className="text-xs text-slate-400 font-mono">({installment.customer.document})</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Valor Original</span>
                <span className="text-sm font-mono text-slate-300">R$ {installment.original_amount.toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo em Aberto</span>
                <span className="text-base font-mono font-black text-emerald-400">
                  R$ {installment.balance_amount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Valor a Receber */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Valor do Recebimento (R$) *
              </label>
              <button
                type="button"
                onClick={() => setAmountStr(maxAmount.toFixed(2))}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
              >
                Quitação Total (R$ {maxAmount.toFixed(2)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-sm font-bold text-slate-400">R$</span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={maxAmount}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="pl-10 h-12 bg-slate-800 border-slate-700 text-white font-mono text-lg font-bold focus:border-emerald-500"
                autoFocus
              />
            </div>
            {isOverpaid && (
              <p className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> O valor digitado ultrapassa o saldo devedor da parcela.
              </p>
            )}
            {isValidAmount && newRemaining > 0 && (
              <p className="text-xs text-slate-400">
                Recebimento parcial: restará um saldo devedor de <strong className="text-amber-400 font-mono">R$ {newRemaining.toFixed(2)}</strong> nesta parcela.
              </p>
            )}
          </div>

          {/* Meio de Pagamento */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              Forma de Pagamento *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon
                const isSelected = paymentMethod === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500/50'
                        : 'border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isSelected ? m.colorClass : 'text-slate-400'}`} />
                    <span className="text-xs font-bold leading-tight truncate">{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Indicador de Integração com Caixa Aberto */}
          {paymentMethod === 'cash' && (
            <div className="p-3.5 rounded-2xl border text-xs space-y-1 bg-slate-950/40">
              {openCashSession ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Integrado ao caixa aberto: <strong>{openCashSession.terminal_name}</strong>. O dinheiro entrará automaticamente na gaveta.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Nenhum caixa aberto neste terminal. O recebimento constará no financeiro sem alterar a gaveta de turno.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              Observações / Referência
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Pago no balcão, comprovante arquivado..."
              className="bg-slate-800 border-slate-700 text-white text-xs"
            />
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-850/80">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!isValidAmount || isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2 rounded-xl shadow-lg shadow-emerald-950/50 flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Recebimento
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
