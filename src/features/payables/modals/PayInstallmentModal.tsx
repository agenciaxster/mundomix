import { useState, useEffect } from 'react'
import {
  X,
  Loader2,
  DollarSign,
  AlertTriangle,
  Coins,
  CreditCard,
  QrCode,
  Building,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'
import { payableService } from '@/lib/services/payable.service'
import { cashRegisterService } from '@/lib/services/cash-register.service'
import type { PayableInstallment, PayablePaymentMethod } from '@/types/payable'
import type { CashSession } from '@/types/cash-register'

interface PayInstallmentModalProps {
  isOpen: boolean
  onClose: () => void
  installment: PayableInstallment | null
  companyId: string
  branchId: string
  userId?: string
  onSuccess: () => void
}

const PAYMENT_METHODS = [
  { id: 'cash' as PayablePaymentMethod, label: 'Dinheiro', icon: Coins, color: 'text-emerald-400' },
  { id: 'pix' as PayablePaymentMethod, label: 'Pix', icon: QrCode, color: 'text-cyan-400' },
  { id: 'bank_transfer' as PayablePaymentMethod, label: 'Transferência', icon: Building, color: 'text-blue-400' },
  { id: 'bank_slip' as PayablePaymentMethod, label: 'Boleto', icon: FileText, color: 'text-amber-400' },
  { id: 'credit_card' as PayablePaymentMethod, label: 'Cartão', icon: CreditCard, color: 'text-purple-400' },
]

export function PayInstallmentModal({
  isOpen,
  onClose,
  installment,
  companyId,
  branchId,
  userId,
  onSuccess,
}: PayInstallmentModalProps) {
  const [amountStr, setAmountStr] = useState('')
  const [discountStr, setDiscountStr] = useState('0.00')
  const [interestStr, setInterestStr] = useState('0.00')
  const [fineStr, setFineStr] = useState('0.00')
  const [paymentMethod, setPaymentMethod] = useState<PayablePaymentMethod>('bank_transfer')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [openCashSession, setOpenCashSession] = useState<CashSession | null>(null)

  useEffect(() => {
    if (isOpen && installment) {
      setAmountStr(installment.balance_amount.toFixed(2))
      setDiscountStr('0.00')
      setInterestStr('0.00')
      setFineStr('0.00')
      setPaymentMethod('bank_transfer')
      setNotes('')

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
  const remaining = Math.max(0, Math.round((maxAmount - numAmount) * 100) / 100)

  async function handleConfirm() {
    if (!installment) return

    if (!isValidAmount) {
      toast.error(`Informe um valor válido entre R$ 0,01 e R$ ${maxAmount.toFixed(2)}.`)
      return
    }

    if (paymentMethod === 'cash' && !openCashSession) {
      const confirmNoCash = window.confirm(
        'Nenhum caixa aberto encontrado para seu operador/filial.\n' +
        'O pagamento da despesa será registrado no financeiro, mas não constará como saída no fechamento de caixa do turno atual.\n\n' +
        'Deseja continuar mesmo assim?'
      )
      if (!confirmNoCash) return
    }

    setIsSubmitting(true)
    try {
      await payableService.payInstallment({
        company_id: companyId,
        branch_id: branchId,
        installment_id: installment.id,
        amount: numAmount,
        payment_method: paymentMethod,
        cash_session_id: paymentMethod === 'cash' ? openCashSession?.id || null : null,
        discount: parseFloat(discountStr) || 0,
        interest: parseFloat(interestStr) || 0,
        fine: parseFloat(fineStr) || 0,
        notes: notes.trim() || undefined,
        idempotency_key: crypto.randomUUID(),
      })

      toast.success(
        `Pagamento de R$ ${numAmount.toFixed(2)} registrado com sucesso!` +
          (paymentMethod === 'cash' && openCashSession
            ? ` Saída de R$ ${numAmount.toFixed(2)} lançada no caixa ${openCashSession.terminal_name}.`
            : '')
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar pagamento da despesa.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Baixa de Conta a Pagar
              </span>
              <h2 className="text-base font-bold text-white">
                {installment.payable?.description || 'Despesa'} (Parc. {installment.installment_number})
              </h2>
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

        {/* Conteúdo */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Card Resumo da Parcela */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Fornecedor / Favorecido:</span>
              <strong className="text-white">
                {installment.supplier?.name || 'Não informado / Despesa geral'}
              </strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Vencimento da Parcela:</span>
              <span className="text-amber-400 font-bold font-mono">
                {new Date(installment.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
              <span className="text-slate-400">Saldo Devedor Pendente:</span>
              <span className="text-base font-black text-rose-400 font-mono">
                R$ {installment.balance_amount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Valor do Pagamento */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Valor do Pagamento (R$) *
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
                className="pl-10 h-12 bg-slate-800 border-slate-700 text-white font-mono text-lg font-bold focus:border-rose-500"
                autoFocus
              />
            </div>
            {isOverpaid && (
              <p className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> O valor digitado ultrapassa o saldo devedor da parcela.
              </p>
            )}
            {isValidAmount && remaining > 0 && (
              <p className="text-xs text-slate-400">
                Pagamento parcial: restará um saldo pendente de <strong className="text-amber-400 font-mono">R$ {remaining.toFixed(2)}</strong> nesta parcela.
              </p>
            )}
          </div>

          {/* Forma de Pagamento */}
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
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition text-left ${
                      isSelected
                        ? 'border-rose-500 bg-rose-500/15 text-white ring-1 ring-rose-500/30'
                        : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${m.color}`} />
                    <span>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Integração com Caixa se Dinheiro */}
          {paymentMethod === 'cash' && (
            <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-950/70 text-xs">
              {openCashSession ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Coins className="h-4 w-4 shrink-0" />
                  <span>
                    Integrado ao caixa aberto: <strong>{openCashSession.terminal_name}</strong>. A saída de despesa será lançada automaticamente na gaveta.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Nenhum caixa aberto neste terminal. O pagamento constará no financeiro sem movimentar gaveta física de turno.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              Observações / Comprovante
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Pago via Pix pelo internet banking, comprovante arquivado..."
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
            disabled={isSubmitting || !isValidAmount}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-rose-900/30"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" /> Registrando...
              </span>
            ) : (
              `Confirmar Pagamento de R$ ${numAmount.toFixed(2)}`
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
