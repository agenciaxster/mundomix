import { useState, useEffect, useRef } from 'react'
import {
  Printer,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  X,
  CreditCard,
  QrCode,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/useToast'
import { cashRegisterService } from '@/lib/services/cash-register.service'
import { printThermalReceiptHtml } from '@/lib/utils/thermal-print'
import type { CashSession, CashMovement } from '@/types/cash-register'
import type { Company } from '@/types/auth'

interface CashReportModalProps {
  isOpen: boolean
  onClose: () => void
  session: CashSession | null
  company?: Company | null
}

export function CashReportModal({
  isOpen,
  onClose,
  session,
  company,
}: CashReportModalProps) {
  const [movements, setMovements] = useState<CashMovement[]>([])
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !session) return
    cashRegisterService
      .getMovements(session.id)
      .then((movs) => setMovements(movs))
      .catch((err) => console.warn('Erro ao carregar movimentações para o relatório:', err))
  }, [isOpen, session])

  if (!isOpen || !session) return null

  const diff = session.difference_cash || 0
  const isClosed = session.status === 'closed'
  const salesTotal =
    session.total_sales_cash +
    session.total_sales_pix +
    session.total_sales_debit +
    session.total_sales_credit +
    session.total_sales_store_credit +
    session.total_sales_other

  function handlePrintA4() {
    window.print()
  }

  async function handlePrintThermal() {
    if (!session) return

    const html = `
      <div class="text-center" style="font-family: monospace; font-size: 11px;">
        <div class="font-bold uppercase" style="font-size: 13px;">${company?.trade_name || company?.legal_name || 'MUNDOMIX'}</div>
        <div style="font-size: 10px;">CNPJ: ${company?.cnpj || ''}</div>
        <div style="font-size: 10px;">Palmas - TO</div>
        <div class="divider"></div>
        <div class="font-bold uppercase" style="font-size: 12px; margin: 4px 0;">RELATÓRIO DE FECHAMENTO DE CAIXA</div>
        <div style="font-size: 9px; text-transform: uppercase;">DOCUMENTO DE CONFERÊNCIA INTERNA</div>
        <div class="divider"></div>
      </div>

      <div style="font-family: monospace; font-size: 10px; line-height: 1.3;">
        <div>TERMINAL: <b>${session.terminal_name}</b></div>
        <div>OPERADOR: <b>${session.opened_by_name || 'Operador'}</b></div>
        <div>ABERTURA: ${new Date(session.opened_at).toLocaleString('pt-BR')}</div>
        ${session.closed_at ? `<div>FECHAMENTO: ${new Date(session.closed_at).toLocaleString('pt-BR')}</div>` : `<div>STATUS: <b>CAIXA ABERTO</b></div>`}
        <div class="divider"></div>

        <div class="font-bold uppercase" style="margin: 3px 0;">1. FORMAS DE PAGAMENTO:</div>
        <div class="item-row"><span>Dinheiro Líquido:</span><span>R$ ${session.total_sales_cash.toFixed(2)}</span></div>
        <div class="item-row"><span>Pix:</span><span>R$ ${session.total_sales_pix.toFixed(2)}</span></div>
        <div class="item-row"><span>Cartão de Débito:</span><span>R$ ${session.total_sales_debit.toFixed(2)}</span></div>
        <div class="item-row"><span>Cartão de Crédito:</span><span>R$ ${session.total_sales_credit.toFixed(2)}</span></div>
        <div class="item-row"><span>Crediário / Outros:</span><span>R$ ${(session.total_sales_store_credit + session.total_sales_other).toFixed(2)}</span></div>
        <div class="item-row font-bold" style="border-top: 1px dotted #000; padding-top: 2px;"><span>TOTAL VENDAS (${session.total_sales_count} un):</span><span>R$ ${salesTotal.toFixed(2)}</span></div>
        <div class="divider"></div>

        <div class="font-bold uppercase" style="margin: 3px 0;">2. APURAÇÃO EM DINHEIRO:</div>
        <div class="item-row"><span>(+) Fundo Inicial:</span><span>R$ ${session.initial_amount.toFixed(2)}</span></div>
        <div class="item-row"><span>(+) Vendas em Dinheiro:</span><span>R$ ${session.total_sales_cash.toFixed(2)}</span></div>
        <div class="item-row"><span>(+) Suprimentos:</span><span>R$ ${session.total_supplies.toFixed(2)}</span></div>
        <div class="item-row"><span>(-) Sangrias:</span><span>R$ ${session.total_bleed.toFixed(2)}</span></div>
        <div class="item-row"><span>(-) Despesas Caixa:</span><span>R$ ${session.total_expenses.toFixed(2)}</span></div>
        <div class="divider"></div>

        <div class="item-row font-bold" style="font-size: 11px;">
          <span>DINHEIRO ESPERADO:</span>
          <span>R$ ${(session.expected_cash || 0).toFixed(2)}</span>
        </div>
        ${isClosed ? `
          <div class="item-row font-bold" style="font-size: 11px;">
            <span>DINHEIRO CONTADO:</span>
            <span>R$ ${(session.counted_cash || 0).toFixed(2)}</span>
          </div>
          <div class="item-row font-bold" style="font-size: 12px; margin-top: 3px; border-top: 1px solid #000; padding-top: 2px;">
            <span>DIFERENÇA:</span>
            <span>${diff === 0 ? 'R$ 0,00 (EXATO)' : diff > 0 ? `+ R$ ${diff.toFixed(2)} (SOBRA)` : `- R$ ${Math.abs(diff).toFixed(2)} (FALTA)`}</span>
          </div>
          ${session.difference_reason ? `<div style="font-size: 9px; margin-top: 4px;">JUSTIFICATIVA: ${session.difference_reason}</div>` : ''}
        ` : ''}

        ${session.verified_by_name ? `
          <div class="divider"></div>
          <div style="font-size: 9px;">CONFERÊNCIA: ${session.verified_by_name} em ${new Date(session.verified_at!).toLocaleString('pt-BR')}</div>
          ${session.verification_notes ? `<div style="font-size: 9px;">DESPACHO: ${session.verification_notes}</div>` : ''}
        ` : ''}

        <div class="divider"></div>
        <div class="text-center" style="font-size: 9px; margin-top: 15px;">
          ________________________________________<br/>
          Assinatura do Operador<br/><br/>
          ________________________________________<br/>
          Assinatura do Gerente / Conferência
        </div>
      </div>
    `

    try {
      await printThermalReceiptHtml(html, '80mm')
      toast.success('Cupom de fechamento enviado para impressão térmica!')
    } catch {
      toast.error('Erro ao acionar impressora térmica.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Topo do Modal (Não impresso em A4) */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/90 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Relatório de Fechamento de Caixa</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    isClosed
                      ? 'bg-slate-800 text-slate-300 border-slate-700'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {isClosed ? 'Fechado' : 'Caixa Aberto'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {session.terminal_name} &bull; Operador: {session.opened_by_name || 'Operador'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintThermal}
              className="text-xs border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cupom Térmico (80mm)</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrintA4}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/30"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir / Salvar PDF</span>
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ─── CORPO DO RELATÓRIO (Estilizado para tela e adaptado para @media print) ─── */}
        <div
          ref={reportRef}
          className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-200 print:text-black print:bg-white print:p-0 print:overflow-visible"
        >
          {/* Cabeçalho Oficial do Relatório */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 print:border-black gap-4">
            <div className="space-y-1">
              <h1 className="text-lg font-black tracking-tight text-white print:text-black uppercase">
                {company?.trade_name || company?.legal_name || 'EMPRESA MUNDOMIX'}
              </h1>
              <p className="text-xs text-slate-400 print:text-gray-700">
                {company?.legal_name && `${company.legal_name} • `}CNPJ: {company?.cnpj || 'Não informado'}
              </p>
              <p className="text-xs text-slate-400 print:text-gray-700">
                {company?.city ? `${company.city} - ${company.state || ''} • ` : ''}Sistema ERP MundoMix
              </p>
            </div>

            <div className="text-left sm:text-right space-y-0.5">
              <div className="px-3 py-1 rounded-xl bg-slate-800 print:bg-gray-100 print:text-black inline-block text-xs font-mono font-bold text-blue-400">
                RELATÓRIO DIÁRIO DE CAIXA
              </div>
              <p className="text-[11px] text-slate-400 print:text-gray-600">
                Emissão: {new Date().toLocaleString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Dados do Turno e Operador */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-850 print:bg-gray-50 print:border print:border-gray-300 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 print:text-gray-600 block">Terminal / Caixa</span>
              <span className="font-bold text-white print:text-black">{session.terminal_name}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 print:text-gray-600 block">Operador(a)</span>
              <span className="font-bold text-white print:text-black">{session.opened_by_name || 'Operador'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 print:text-gray-600 block">Abertura</span>
              <span className="font-mono text-slate-200 print:text-black">
                {new Date(session.opened_at).toLocaleString('pt-BR')}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 print:text-gray-600 block">Fechamento</span>
              <span className="font-mono text-slate-200 print:text-black">
                {session.closed_at ? new Date(session.closed_at).toLocaleString('pt-BR') : 'Caixa em Aberto'}
              </span>
            </div>
          </div>

          {/* ─── 1. RESUMO DE FORMAS DE PAGAMENTO ───────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-black flex items-center justify-between border-b border-slate-800 print:border-gray-300 pb-2">
              <span>1. Vendas Faturadas por Forma de Pagamento</span>
              <span className="text-blue-400 print:text-black font-semibold">
                Total de Vendas: {session.total_sales_count} operação(ões)
              </span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-850/60 print:border print:border-gray-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-400 print:text-black flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Dinheiro Físico (Líquido)
                </span>
                <span className="text-base font-mono font-bold text-white print:text-black">
                  R$ {session.total_sales_cash.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 print:text-gray-500 block">Afeta gaveta física</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-850/60 print:border print:border-gray-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-blue-400 print:text-black flex items-center gap-1">
                  <QrCode className="h-3 w-3" /> Pix
                </span>
                <span className="text-base font-mono font-bold text-white print:text-black">
                  R$ {session.total_sales_pix.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 print:text-gray-500 block">Recebido na conta</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-850/60 print:border print:border-gray-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-300 print:text-black flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Cartão de Débito
                </span>
                <span className="text-base font-mono font-bold text-white print:text-black">
                  R$ {session.total_sales_debit.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 print:text-gray-500 block">Maquininha TEF/POS</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-850/60 print:border print:border-gray-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-purple-400 print:text-black flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Cartão de Crédito
                </span>
                <span className="text-base font-mono font-bold text-white print:text-black">
                  R$ {session.total_sales_credit.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 print:text-gray-500 block">À vista ou parcelado</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-850/60 print:border print:border-gray-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-400 print:text-black flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Crediário / Outros
                </span>
                <span className="text-base font-mono font-bold text-white print:text-black">
                  R$ {(session.total_sales_store_credit + session.total_sales_other).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 print:text-gray-500 block">A prazo</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-950/30 print:border print:border-black space-y-1 border border-blue-800/40">
                <span className="text-[10px] uppercase font-bold text-blue-300 print:text-black block">
                  Total Faturado no Caixa
                </span>
                <span className="text-base font-mono font-bold text-blue-200 print:text-black">
                  R$ {salesTotal.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 print:text-gray-600 block">Soma de todas as formas</span>
              </div>
            </div>
          </div>

          {/* ─── 2. MOVIMENTAÇÕES DE CAIXA (EXTRATO DETALHADO) ─────────────── */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-black flex items-center justify-between border-b border-slate-800 print:border-gray-300 pb-2">
              <span>2. Movimentações de Dinheiro (Suprimentos, Sangrias e Despesas)</span>
              <span className="text-slate-400 print:text-black font-normal">
                {movements.length} registro(s)
              </span>
            </h3>

            {movements.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                Nenhum suprimento, sangria ou despesa registrada nesta sessão.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-800 print:border-gray-300 text-[10px] uppercase text-slate-400 print:text-black">
                      <th className="py-2">Horário</th>
                      <th className="py-2">Tipo</th>
                      <th className="py-2">Motivo / Descrição</th>
                      <th className="py-2">Responsável</th>
                      <th className="py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 print:divide-gray-200">
                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-850/40">
                        <td className="py-2 font-mono text-slate-400 print:text-gray-600">
                          {new Date(m.created_at).toLocaleTimeString('pt-BR')}
                        </td>
                        <td className="py-2 font-bold">
                          {m.movement_type === 'supply' && <span className="text-emerald-400 print:text-black">Suprimento (+)</span>}
                          {m.movement_type === 'bleed' && <span className="text-amber-400 print:text-black">Sangria (-)</span>}
                          {m.movement_type === 'expense' && <span className="text-rose-400 print:text-black">Despesa (-)</span>}
                        </td>
                        <td className="py-2 text-slate-200 print:text-black">
                          {m.reason}
                          {m.notes && <span className="text-[10px] text-slate-400 print:text-gray-500 block">Obs: {m.notes}</span>}
                        </td>
                        <td className="py-2 text-slate-400 print:text-gray-600">
                          {m.user_name || 'Operador'}
                          {m.authorized_by_name && <span className="text-[10px] block">Aut: {m.authorized_by_name}</span>}
                        </td>
                        <td className="py-2 text-right font-mono font-bold text-white print:text-black">
                          R$ {m.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ─── 3. DEMONSTRATIVO DE FECHAMENTO E CONCILIAÇÃO ──────────────── */}
          <div className="p-5 rounded-3xl bg-slate-850/90 print:bg-white print:border print:border-black space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 print:text-black flex items-center justify-between border-b border-slate-800 print:border-gray-300 pb-2">
              <span>3. Conciliação do Dinheiro Físico no Caixa</span>
              <span className="text-emerald-400 print:text-black font-semibold">Gaveta Física</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-800/60 print:border-gray-200">
                  <span className="text-slate-400 print:text-gray-700">Fundo Inicial de Caixa:</span>
                  <span className="font-mono font-bold text-white print:text-black">+ R$ {session.initial_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60 print:border-gray-200">
                  <span className="text-slate-400 print:text-gray-700">Vendas em Dinheiro (Líquido):</span>
                  <span className="font-mono font-bold text-emerald-400 print:text-black">+ R$ {session.total_sales_cash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60 print:border-gray-200">
                  <span className="text-slate-400 print:text-gray-700">Suprimentos Recebidos:</span>
                  <span className="font-mono font-bold text-emerald-400 print:text-black">+ R$ {session.total_supplies.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60 print:border-gray-200">
                  <span className="text-slate-400 print:text-gray-700">Sangrias Efetuadas:</span>
                  <span className="font-mono font-bold text-amber-400 print:text-black">- R$ {session.total_bleed.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60 print:border-gray-200">
                  <span className="text-slate-400 print:text-gray-700">Despesas Pagas pelo Caixa:</span>
                  <span className="font-mono font-bold text-rose-400 print:text-black">- R$ {session.total_expenses.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-3 bg-slate-900/90 print:bg-gray-50 p-4 rounded-2xl border border-slate-800 print:border-gray-300 flex flex-col justify-center">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300 print:text-black">Dinheiro Esperado na Gaveta:</span>
                  <span className="font-mono font-black text-blue-400 print:text-black text-sm">
                    R$ {(session.expected_cash || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300 print:text-black">Dinheiro Contado pelo Operador:</span>
                  <span className="font-mono font-black text-white print:text-black text-sm">
                    {session.counted_cash !== null && session.counted_cash !== undefined ? `R$ ${session.counted_cash.toFixed(2)}` : 'Não informado'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-800 print:border-gray-300">
                  <span className="font-black text-white print:text-black flex items-center gap-1.5">
                    {diff === 0 && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    {diff !== 0 && <AlertTriangle className="h-4 w-4 text-amber-400" />}
                    Diferença Apurada:
                  </span>
                  <span
                    className={`font-mono font-black text-base ${
                      diff === 0
                        ? 'text-emerald-400 print:text-black'
                        : diff > 0
                        ? 'text-blue-400 print:text-black'
                        : 'text-rose-400 print:text-black'
                    }`}
                  >
                    {diff === 0 ? 'R$ 0,00 (Conferido)' : diff > 0 ? `+ R$ ${diff.toFixed(2)} (Sobra)` : `- R$ ${Math.abs(diff).toFixed(2)} (Falta)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Justificativa e Parecer Gerencial */}
            {(session.difference_reason || session.verification_notes) && (
              <div className="pt-3 border-t border-slate-800 print:border-gray-200 space-y-2 text-xs">
                {session.difference_reason && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-gray-300">
                    <span className="font-bold text-slate-400 print:text-black block mb-0.5">Justificativa da Vendedora / Operador:</span>
                    <p className="text-slate-200 print:text-black italic">"{session.difference_reason}"</p>
                  </div>
                )}

                {session.verified_by_name && (
                  <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-800/40 print:border-gray-300">
                    <div className="flex items-center gap-1.5 font-bold text-blue-300 print:text-black mb-0.5">
                      <ShieldCheck className="h-4 w-4" />
                      Conferência Gerencial Registrada por {session.verified_by_name} ({new Date(session.verified_at!).toLocaleString('pt-BR')}):
                    </div>
                    <p className="text-slate-200 print:text-black">{session.verification_notes || 'Sem observações adicionais.'}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Campo de Assinaturas para Impressão */}
          <div className="pt-8 border-t border-slate-800 print:border-gray-300 grid grid-cols-2 gap-8 text-center text-xs text-slate-400 print:text-black print:block print:pt-12">
            <div className="space-y-1">
              <div className="border-t border-slate-700 print:border-black mx-auto w-48 mb-1" />
              <p className="font-bold">{session.opened_by_name || 'Operador de Caixa'}</p>
              <p className="text-[10px]">Operador Responsável</p>
            </div>

            <div className="space-y-1">
              <div className="border-t border-slate-700 print:border-black mx-auto w-48 mb-1" />
              <p className="font-bold">{session.verified_by_name || 'Gerente / Fiscal de Caixa'}</p>
              <p className="text-[10px]">Conferência e Visto</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
