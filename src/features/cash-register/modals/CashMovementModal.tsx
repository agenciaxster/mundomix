import { useState, useEffect } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  DollarSign,
  AlertCircle,
  X,
  CheckCircle2,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'
import { cashRegisterService } from '@/lib/services/cash-register.service'
import type { CashSession, CashMovementType, CashMovement } from '@/types/cash-register'

interface CashMovementModalProps {
  isOpen: boolean
  onClose: () => void
  session: CashSession | null
  currentExpectedCash?: number
  defaultType?: CashMovementType
  onMovementAdded: (movement: CashMovement) => void
}

export function CashMovementModal({
  isOpen,
  onClose,
  session,
  currentExpectedCash = 0,
  defaultType = 'supply',
  onMovementAdded,
}: CashMovementModalProps) {
  const [movementType, setMovementType] = useState<CashMovementType>(defaultType)
  const [amountStr, setAmountStr] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMovementType(defaultType)
      setAmountStr('')
      setReason('')
      setNotes('')
      setReceiptUrl('')
    }
  }, [isOpen, defaultType])

  if (!isOpen || !session) return null

  function parseAmount(val: string): number {
    const clean = val.replace(/[^\d.,]/g, '').replace(',', '.')
    const parsed = parseFloat(clean)
    return isNaN(parsed) ? 0 : Math.max(0, parsed)
  }

  const currentAmount = parseAmount(amountStr)
  const isSangriaExcessive = movementType === 'bleed' && currentAmount > currentExpectedCash

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return

    const amount = parseAmount(amountStr)
    if (amount <= 0) {
      toast.error('Informe um valor maior que zero.')
      return
    }

    if (!reason.trim()) {
      toast.error('O motivo ou justificativa é obrigatório.')
      return
    }

    setIsSubmitting(true)
    try {
      const mov = await cashRegisterService.addMovement({
        company_id: session.company_id,
        branch_id: session.branch_id,
        cash_session_id: session.id,
        movement_type: movementType,
        amount,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        receipt_url: receiptUrl.trim() || undefined,
      })

      const typeLabels: Record<CashMovementType, string> = {
        supply: 'Suprimento (Entrada)',
        bleed: 'Sangria (Retirada)',
        expense: 'Despesa do Caixa',
      }

      toast.success(`${typeLabels[movementType]} de R$ ${amount.toFixed(2)} registrado com sucesso!`)
      onMovementAdded(mov)
      onClose()
    } catch (err: any) {
      console.error('Erro ao registrar movimentação:', err)
      toast.error(err.message || 'Falha ao registrar movimentação de caixa.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-4 flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/90">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                movementType === 'supply'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : movementType === 'bleed'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}
            >
              {movementType === 'supply' && <ArrowDownCircle className="h-5 w-5" />}
              {movementType === 'bleed' && <ArrowUpCircle className="h-5 w-5" />}
              {movementType === 'expense' && <Receipt className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Movimentação de Caixa
              </h2>
              <p className="text-xs text-slate-400">
                {session.terminal_name} &bull; Operador: {session.opened_by_name || 'Operador'}
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

        {/* Abas do Tipo de Movimentação */}
        <div className="grid grid-cols-3 p-2 bg-slate-950 border-b border-slate-800 gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setMovementType('supply')}
            className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition ${
              movementType === 'supply'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <ArrowDownCircle className="h-4 w-4" />
            Suprimento
          </button>

          <button
            type="button"
            onClick={() => setMovementType('bleed')}
            className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition ${
              movementType === 'bleed'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <ArrowUpCircle className="h-4 w-4" />
            Sangria
          </button>

          <button
            type="button"
            onClick={() => setMovementType('expense')}
            className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition ${
              movementType === 'expense'
                ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Receipt className="h-4 w-4" />
            Despesa
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Card Informativo do Tipo Selecionado */}
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
              movementType === 'supply'
                ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                : movementType === 'bleed'
                ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
            }`}
          >
            <DollarSign className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">
                {movementType === 'supply' && 'Entrada de Dinheiro (Suprimento)'}
                {movementType === 'bleed' && 'Retirada de Dinheiro (Sangria)'}
                {movementType === 'expense' && 'Pagamento de Despesa pelo Caixa'}
              </span>
              <p className="text-[11px] opacity-80 leading-relaxed">
                {movementType === 'supply' && 'Aporte de dinheiro na gaveta durante o expediente (ex: troco extra).'}
                {movementType === 'bleed' && 'Retirada de cédulas por segurança para depósito ou cofre.'}
                {movementType === 'expense' && 'Pagamento em espécie autorizado de despesa miúda ou entrega.'}
              </p>
              <div className="pt-1 text-[11px] font-mono text-slate-300">
                Dinheiro estimado na gaveta agora: <strong>R$ {currentExpectedCash.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* Valor da Movimentação */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Valor da Operação (R$) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
              <Input
                type="text"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0,00"
                required
                className="bg-slate-850 border-slate-700 text-white font-mono font-bold text-base pl-10 h-11"
              />
            </div>
            {isSangriaExcessive && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1 font-semibold">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Atenção: O valor da sangria excede o dinheiro físico estimado na gaveta (R$ {currentExpectedCash.toFixed(2)}).
              </p>
            )}
          </div>

          {/* Atalhos Rápidos */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {[20, 50, 100, 200, 500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmountStr(v.toFixed(2).replace('.', ','))}
                className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-850 text-[11px] font-mono text-slate-300 hover:text-white hover:border-slate-700 transition"
              >
                + R$ {v.toFixed(2)}
              </button>
            ))}
          </div>

          {/* Motivo Obrigatório */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Motivo / Justificativa <span className="text-rose-400">*</span>
            </label>
            <Input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                movementType === 'supply'
                  ? 'Ex: Reforço de troco para notas de R$ 5 e R$ 10'
                  : movementType === 'bleed'
                  ? 'Ex: Sangria periódica de segurança para o cofre'
                  : 'Ex: Pagamento de entrega motoboy / taxa urgente'
              }
              required
              className="bg-slate-850 border-slate-700 text-white text-xs h-10"
            />
          </div>

          {/* Comprovante / Recibo para Despesas */}
          {movementType === 'expense' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-400" />
                Número do Recibo / Comprovante (Opcional)
              </label>
              <Input
                type="text"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                placeholder="Ex: Recibo Nº 104, Cupom 09843"
                className="bg-slate-850 border-slate-700 text-white text-xs h-10"
              />
            </div>
          )}

          {/* Observações Opcionais */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Observações Adicionais
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes ou autorizações complementares..."
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-850 p-3 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs border-slate-700 text-slate-300 hover:text-white"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className={`text-xs font-bold flex items-center gap-1.5 px-5 shadow-lg ${
                movementType === 'supply'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                  : movementType === 'bleed'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting ? 'Registrando...' : 'Confirmar Movimentação'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
