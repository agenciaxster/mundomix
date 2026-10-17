import { useState, useEffect } from 'react'
import {
  X,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  History,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { customerService } from '@/lib/services/customer.service'
import type { Customer, CustomerCreditHistory, CreditStatus } from '@/types/customer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

interface CreditLimitModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer | null
  onSuccess: () => void
}

export function CreditLimitModal({
  isOpen,
  onClose,
  customer,
  onSuccess,
}: CreditLimitModalProps) {
  const { activeCompany, activeRole, hasPermission } = useAuth()

  const [newLimit, setNewLimit] = useState<string>('0')
  const [reason, setReason] = useState<string>('')
  const [creditStatus, setCreditStatus] = useState<CreditStatus>('available')
  const [history, setHistory] = useState<CustomerCreditHistory[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canEditCredit =
    activeRole === 'owner' ||
    activeRole === 'admin' ||
    hasPermission('financial', 'edit') ||
    hasPermission('sales', 'edit')

  useEffect(() => {
    if (isOpen && customer && activeCompany) {
      setNewLimit(String(customer.credit_limit || 0))
      setReason('')
      setCreditStatus(customer.credit_status || 'available')
      setError(null)
      loadHistory(customer.id)
    }
  }, [isOpen, customer, activeCompany])

  async function loadHistory(customerId: string) {
    if (!activeCompany?.id) return
    setIsLoadingHistory(true)
    try {
      const data = await customerService.getCreditHistory(activeCompany.id, customerId)
      setHistory(data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!canEditCredit) {
      setError('Você não tem permissão para alterar o limite de crédito deste cliente.')
      return
    }

    if (!activeCompany?.id || !customer) {
      setError('Empresa ou cliente não identificado.')
      return
    }

    const val = parseFloat(newLimit)
    if (isNaN(val) || val < 0) {
      setError('O limite de crédito não pode ser negativo.')
      return
    }

    if (!reason.trim()) {
      setError('A justificativa é obrigatória para manter a rastreabilidade do crédito.')
      return
    }

    setIsSubmitting(true)
    try {
      await customerService.updateCreditLimit(
        activeCompany.id,
        customer.id,
        val,
        reason.trim(),
        creditStatus
      )

      toast.success(
        `Limite de crédito de "${customer.name}" atualizado para R$ ${val.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
        })}!`
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Erro ao atualizar limite:', err)
      setError(err.message || 'Falha ao atualizar limite de crédito.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !customer) return null

  // Cálculo de crédito: saldo utilizado no momento é 0.00 (nenhum título em aberto)
  const currentCreditUsed = 0.0
  const currentAvailableCredit = Math.max(0, (customer.credit_limit || 0) - currentCreditUsed)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Limite de Crédito</h2>
              <p className="text-xs text-slate-400 truncate max-w-sm">
                {customer.name} {customer.trade_name ? `(${customer.trade_name})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Cartões de Posição de Crédito Atual */}
          <div className="grid grid-cols-3 gap-3 bg-slate-850 p-4 rounded-xl border border-slate-800 text-center">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Limite Atual
              </span>
              <span className="text-sm font-bold text-white">
                R${' '}
                {customer.credit_limit.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Utilizado
              </span>
              <span className="text-sm font-bold text-slate-400">
                R${' '}
                {currentCreditUsed.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Disponível
              </span>
              <span className="text-sm font-bold text-emerald-400">
                R${' '}
                {currentAvailableCredit.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Form de Ajuste */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Novo Limite Concedido (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    disabled={!canEditCredit}
                    value={newLimit}
                    onChange={(e) => setNewLimit(e.target.value)}
                    className="pl-9 bg-slate-800/80 border-slate-700 text-white font-bold text-base"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Situação do Crédito *
                </label>
                <select
                  value={creditStatus}
                  onChange={(e) => setCreditStatus(e.target.value as CreditStatus)}
                  disabled={!canEditCredit}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="available">Liberado / Disponível</option>
                  <option value="under_review">Em Análise / Avaliação</option>
                  <option value="blocked">Bloqueado para Vendas</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Justificativa da Alteração *
              </label>
              <textarea
                rows={2}
                required
                disabled={!canEditCredit}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Análise cadastral aprovada, pontualidade no pagamento, garantia prestada..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !canEditCredit}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-2 font-medium"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Confirmar Limite
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Histórico Auditável */}
          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <History className="h-4 w-4 text-blue-400" />
              <span>Histórico de Alterações de Limite ({history.length})</span>
            </div>

            {isLoadingHistory ? (
              <div className="flex items-center justify-center p-6 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando auditoria...
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-3 bg-slate-850 rounded-xl">
                Nenhuma alteração registrada até o momento.
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-lg bg-slate-850 p-3 border border-slate-800 text-xs text-slate-300 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        R$ {h.previous_limit.toFixed(2)} ➔{' '}
                        <strong className="text-emerald-400">R$ {h.new_limit.toFixed(2)}</strong>
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(h.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-slate-400 italic">&ldquo;{h.reason}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
