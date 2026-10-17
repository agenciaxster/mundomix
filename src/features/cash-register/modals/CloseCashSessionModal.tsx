import { useState, useEffect } from 'react'
import {
  Lock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  X,
  CreditCard,
  QrCode,
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'
import { cashRegisterService } from '@/lib/services/cash-register.service'
import type { CashSession, CashSessionLiveSummary } from '@/types/cash-register'

interface CloseCashSessionModalProps {
  isOpen: boolean
  onClose: () => void
  session: CashSession | null
  companyId: string
  onSessionClosed: (closedSession: CashSession) => void
}

export function CloseCashSessionModal({
  isOpen,
  onClose,
  session,
  companyId,
  onSessionClosed,
}: CloseCashSessionModalProps) {
  const [liveSummary, setLiveSummary] = useState<CashSessionLiveSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [countedCashStr, setCountedCashStr] = useState('')
  const [differenceReason, setDifferenceReason] = useState('')
  const [closingNotes, setClosingNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen || !session) return
    setIsLoading(true)
    setCountedCashStr('')
    setDifferenceReason('')
    setClosingNotes('')

    cashRegisterService
      .getLiveSessionSummary(session.id, companyId)
      .then((summary) => setLiveSummary(summary))
      .catch((err) => {
        console.error('Erro ao carregar resumo ao vivo:', err)
        toast.error('Erro ao apurar totais do caixa.')
      })
      .finally(() => setIsLoading(false))
  }, [isOpen, session, companyId])

  if (!isOpen || !session) return null

  function parseAmount(val: string): number | null {
    if (!val.trim()) return null
    const clean = val.replace(/[^\d.,]/g, '').replace(',', '.')
    const parsed = parseFloat(clean)
    return isNaN(parsed) ? null : Math.max(0, parsed)
  }

  const expectedCash = liveSummary ? liveSummary.expectedCashNow : session.initial_amount
  const countedCash = parseAmount(countedCashStr)
  const hasCounted = countedCash !== null

  const difference = hasCounted ? Math.round((countedCash - expectedCash) * 100) / 100 : 0
  const isDivergent = hasCounted && Math.abs(difference) > 0.01

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return

    if (countedCash === null) {
      toast.error('Informe o valor total contado em dinheiro na gaveta.')
      return
    }

    if (isDivergent && !differenceReason.trim()) {
      toast.error('Informe a justificativa para a diferença apurada no caixa.')
      return
    }

    setIsSubmitting(true)
    try {
      const closed = await cashRegisterService.closeSession({
        company_id: companyId,
        session_id: session.id,
        counted_cash: countedCash,
        closing_notes: closingNotes.trim() || undefined,
        difference_reason: isDivergent ? differenceReason.trim() : undefined,
      })

      toast.success(`Caixa "${closed.terminal_name}" fechado com sucesso!`)
      onSessionClosed(closed)
      onClose()
    } catch (err: any) {
      console.error('Erro ao fechar caixa:', err)
      toast.error(err.message || 'Falha ao processar fechamento do caixa.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Fechamento de Caixa
              </h2>
              <p className="text-xs text-slate-400">
                {session.terminal_name} &bull; Operador: {session.opened_by_name || 'Operador'} &bull; Aberto em: {new Date(session.opened_at).toLocaleTimeString('pt-BR')}
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

        {/* Corpo com scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs">Apurando vendas e movimentações em tempo real...</p>
            </div>
          ) : (
            <>
              {/* ─── 1. RESUMO GERAL DAS FORMAS DE PAGAMENTO ──────────────────── */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Resumo de Vendas por Forma de Pagamento</span>
                  <span className="text-[11px] font-normal text-blue-400">
                    {liveSummary?.salesCount || 0} venda(s) faturada(s)
                  </span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  {/* Dinheiro */}
                  <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Dinheiro (Líquido)
                    </span>
                    <span className="text-sm font-mono font-bold text-white">
                      R$ {(liveSummary?.salesCash || 0).toFixed(2)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block">Entra na gaveta</span>
                  </div>

                  {/* Pix */}
                  <div className="p-3 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-blue-400 block flex items-center gap-1">
                      <QrCode className="h-3 w-3" /> Pix
                    </span>
                    <span className="text-sm font-mono font-bold text-white">
                      R$ {(liveSummary?.salesPix || 0).toFixed(2)}
                    </span>
                    <span className="text-[9.5px] text-slate-500 block">Conta bancária</span>
                  </div>

                  {/* Cartão de Débito */}
                  <div className="p-3 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-300 block flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Cartão Débito
                    </span>
                    <span className="text-sm font-mono font-bold text-white">
                      R$ {(liveSummary?.salesDebit || 0).toFixed(2)}
                    </span>
                    <span className="text-[9.5px] text-slate-500 block">Maquininha</span>
                  </div>

                  {/* Cartão de Crédito */}
                  <div className="p-3 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-purple-400 block flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Cartão Crédito
                    </span>
                    <span className="text-sm font-mono font-bold text-white">
                      R$ {(liveSummary?.salesCredit || 0).toFixed(2)}
                    </span>
                    <span className="text-[9.5px] text-slate-500 block">Maquininha</span>
                  </div>

                  {/* Crediário */}
                  <div className="p-3 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Crediário / A Prazo
                    </span>
                    <span className="text-sm font-mono font-bold text-white">
                      R$ {(liveSummary?.salesStoreCredit || 0).toFixed(2)}
                    </span>
                    <span className="text-[9.5px] text-slate-500 block">A receber</span>
                  </div>

                  {/* Total de Vendas */}
                  <div className="p-3 rounded-2xl bg-blue-950/30 border border-blue-800/40 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-blue-300 block">
                      Total Faturado
                    </span>
                    <span className="text-sm font-mono font-bold text-blue-200">
                      R$ {(liveSummary?.salesTotal || 0).toFixed(2)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block">Todas as formas</span>
                  </div>
                </div>
              </div>

              {/* ─── 2. APURAÇÃO DO DINHEIRO FÍSICO NA GAVETA ────────────────── */}
              <div className="p-4 rounded-3xl bg-slate-850/80 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center justify-between">
                  <span>Composição do Dinheiro Físico no Caixa</span>
                  <span className="text-[10px] text-slate-400 font-normal">Fórmula oficial</span>
                </h4>

                <div className="divide-y divide-slate-800 text-xs space-y-1.5">
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-blue-400" /> Fundo de Caixa Inicial:
                    </span>
                    <span className="font-mono font-bold text-white">
                      + R$ {session.initial_amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-400" /> Vendas em Dinheiro (Líquido):
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      + R$ {(liveSummary?.salesCash || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-400" /> Suprimentos de Caixa:
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      + R$ {(liveSummary?.suppliesTotal || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <ArrowUpCircle className="h-3.5 w-3.5 text-amber-400" /> Sangrias Realizadas:
                    </span>
                    <span className="font-mono font-bold text-amber-400">
                      - R$ {(liveSummary?.bleedTotal || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5 text-rose-400" /> Despesas Pagas pelo Caixa:
                    </span>
                    <span className="font-mono font-bold text-rose-400">
                      - R$ {(liveSummary?.expensesTotal || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2.5 text-sm">
                    <span className="font-bold text-white">
                      Dinheiro Físico Esperado na Gaveta:
                    </span>
                    <span className="font-mono font-black text-blue-400 text-base">
                      R$ {expectedCash.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ─── 3. CONTAGEM DO DINHEIRO FÍSICO ───────────────────────────── */}
              <div className="p-4 rounded-3xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-emerald-400" />
                      Informe o Dinheiro Contado na Gaveta <span className="text-rose-400">*</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">obrigatório para fechamento</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">R$</span>
                    <Input
                      type="text"
                      value={countedCashStr}
                      onChange={(e) => setCountedCashStr(e.target.value)}
                      placeholder="0,00"
                      required
                      autoFocus
                      className="bg-slate-900 border-slate-700 text-white font-mono font-black text-lg pl-12 h-12 rounded-2xl"
                    />
                  </div>
                </div>

                {/* Resultado da Apuração / Divergência */}
                {hasCounted && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
                      difference === 0
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : difference > 0
                        ? 'bg-blue-950/30 border-blue-500/40 text-blue-300'
                        : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {difference === 0 && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
                      {difference > 0 && <ArrowDownCircle className="h-5 w-5 text-blue-400 shrink-0" />}
                      {difference < 0 && <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />}
                      <div>
                        <span className="font-bold text-sm block">
                          {difference === 0 && 'Caixa Conferido (Sem Divergência)'}
                          {difference > 0 && `Sobra de Caixa: + R$ ${difference.toFixed(2)}`}
                          {difference < 0 && `Falta de Caixa: - R$ ${Math.abs(difference).toFixed(2)}`}
                        </span>
                        <p className="text-[11px] opacity-80">
                          {difference === 0 && 'O dinheiro contado bate exatamente com o esperado.'}
                          {difference > 0 && 'Há mais dinheiro físico na gaveta do que o registrado nas vendas.'}
                          {difference < 0 && 'O valor contado é inferior ao dinheiro físico esperado.'}
                        </p>
                      </div>
                    </div>

                    <span className="font-mono font-black text-base">
                      {difference >= 0 ? `+ R$ ${difference.toFixed(2)}` : `- R$ ${Math.abs(difference).toFixed(2)}`}
                    </span>
                  </div>
                )}

                {/* Justificativa Obrigatória se houver divergência */}
                {isDivergent && (
                  <div className="space-y-1.5 pt-1 animate-in fade-in duration-150">
                    <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      Justificativa da Divergência <span className="text-rose-400">*</span>
                    </label>
                    <Input
                      type="text"
                      value={differenceReason}
                      onChange={(e) => setDifferenceReason(e.target.value)}
                      placeholder="Ex: Troco repassado a maior / diferença de moedas miúdas na abertura"
                      required
                      className="bg-slate-900 border-amber-600/40 text-white text-xs h-10 rounded-xl"
                    />
                  </div>
                )}
              </div>

              {/* Observações de Fechamento */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Observações Gerais do Fechamento (Opcional)
                </label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Informações adicionais para a gerência..."
                  rows={2}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-850 p-3 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </>
          )}

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 shrink-0">
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
              disabled={isSubmitting || isLoading || !hasCounted}
              className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 px-6 shadow-lg shadow-rose-900/30"
            >
              <Lock className="h-4 w-4" />
              {isSubmitting ? 'Fechando Caixa...' : 'Confirmar Fechamento'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
