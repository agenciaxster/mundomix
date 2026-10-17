import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign,
  Lock,
  Unlock,
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  FileText,
  Calendar,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Calculator,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'
import { cashRegisterService } from '@/lib/services/cash-register.service'
import type { CashSession, CashSessionLiveSummary, CashMovementType } from '@/types/cash-register'

// Modais
import { OpenCashSessionModal } from './modals/OpenCashSessionModal'
import { CashMovementModal } from './modals/CashMovementModal'
import { CloseCashSessionModal } from './modals/CloseCashSessionModal'
import { CashReportModal } from './modals/CashReportModal'
import { CashAuditModal } from './modals/CashAuditModal'

export function CashRegisterPage() {
  const { activeCompany, activeBranch, user, profile, activeRole } = useAuth()
  const companyId = activeCompany?.id || ''
  const branchId = activeBranch?.id || ''
  const isManagerOrAdmin = activeRole === 'admin' || activeRole === 'manager' || activeRole === 'owner'

  // Sessão atual aberta
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null)
  const [liveSummary, setLiveSummary] = useState<CashSessionLiveSummary | null>(null)

  // Histórico de sessões
  const [sessionsHistory, setSessionsHistory] = useState<CashSession[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Modais
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [movementModalType, setMovementModalType] = useState<CashMovementType>('supply')
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [selectedSessionForReport, setSelectedSessionForReport] = useState<CashSession | null>(null)
  const [selectedSessionForAudit, setSelectedSessionForAudit] = useState<CashSession | null>(null)

  // Carrega caixa atual aberto
  const loadCurrentSession = useCallback(async () => {
    if (!companyId || !branchId) {
      return
    }
    try {
      const sess = await cashRegisterService.getCurrentOpenSession(companyId, branchId, user?.id)
      setCurrentSession(sess)
      if (sess) {
        const live = await cashRegisterService.getLiveSessionSummary(sess.id, companyId)
        setLiveSummary(live)
      } else {
        setLiveSummary(null)
      }
    } catch (err) {
      console.warn('Aviso ao carregar sessão de caixa atual:', err)
    }
  }, [companyId, branchId, user?.id])

  // Carrega histórico de caixas
  const loadHistory = useCallback(async () => {
    if (!companyId) return
    setIsLoadingHistory(true)
    try {
      const list = await cashRegisterService.listSessions(companyId, {
        branchId: branchId || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      setSessionsHistory(list)
    } catch (err) {
      console.warn('Aviso ao listar histórico de caixas:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [companyId, branchId, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    loadCurrentSession()
  }, [loadCurrentSession])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  function handleOpenMovement(type: CashMovementType) {
    if (!currentSession) {
      toast.error('Nenhum caixa aberto no momento. Abra o caixa primeiro.')
      return
    }
    setMovementModalType(type)
    setIsMovementModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* ─── TOPO DA PÁGINA ─────────────────────────────────────────────── */}
      <PageHeader
        title="Controle de Caixa"
        description="Gestão de abertura, suprimentos, sangrias, despesas e fechamento com conciliação física."
        badge={activeBranch?.name || activeCompany?.trade_name || 'Frente de Caixa'}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="text-xs border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300">
              <Link to="/comercial/pdv">
                <Calculator className="h-3.5 w-3.5 mr-1 text-blue-400" />
                Ir para o PDV
              </Link>
            </Button>

            {!currentSession ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsOpenModalOpen(true)}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
              >
                <Unlock className="h-3.5 w-3.5" />
                Abrir Caixa
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCloseModalOpen(true)}
                className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-rose-900/30"
              >
                <Lock className="h-3.5 w-3.5" />
                Fechar Caixa
              </Button>
            )}
          </div>
        }
      />

      {/* ─── CARD PRINCIPAL: STATUS DO CAIXA DO OPERADOR ────────────────── */}
      <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                currentSession
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {currentSession ? <Unlock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {currentSession ? currentSession.terminal_name : 'Caixa Fechado'}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    currentSession
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {currentSession ? 'Caixa em Operação' : 'Encerrado'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {currentSession ? (
                  <>
                    Operador: <strong className="text-slate-200">{currentSession.opened_by_name || 'Operador'}</strong> &bull; Aberto em:{' '}
                    <span className="font-mono text-slate-300">{new Date(currentSession.opened_at).toLocaleString('pt-BR')}</span>
                  </>
                ) : (
                  'Nenhuma sessão de caixa aberta para esta filial. Abra o caixa para iniciar os recebimentos.'
                )}
              </p>
            </div>
          </div>

          {/* Ações Rápidas quando Aberto */}
          {currentSession && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenMovement('supply')}
                className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
              >
                <ArrowDownCircle className="h-3.5 w-3.5 mr-1" />
                Suprimento
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenMovement('bleed')}
                className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              >
                <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
                Sangria
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenMovement('expense')}
                className="text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Receipt className="h-3.5 w-3.5 mr-1" />
                Despesa
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedSessionForReport(currentSession)}
                className="text-xs border-slate-700 text-slate-300 hover:text-white"
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Relatório Parcial
              </Button>
            </div>
          )}
        </div>

        {/* Grade de Indicadores em Tempo Real */}
        {currentSession ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Fundo Inicial */}
            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Fundo Inicial</span>
              <span className="text-base font-mono font-bold text-white">
                R$ {currentSession.initial_amount.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 block">Abertura</span>
            </div>

            {/* 2. Vendas em Dinheiro */}
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Dinheiro (Líquido)
              </span>
              <span className="text-base font-mono font-bold text-emerald-300">
                + R$ {(liveSummary?.salesCash || 0).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 block">{liveSummary?.salesCount || 0} venda(s)</span>
            </div>

            {/* 3. Outras Formas (Pix/Cartão/Crediário) */}
            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-blue-400 block">Pix / Cartões</span>
              <span className="text-base font-mono font-bold text-blue-300">
                R$ {((liveSummary?.salesPix || 0) + (liveSummary?.salesDebit || 0) + (liveSummary?.salesCredit || 0) + (liveSummary?.salesStoreCredit || 0)).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 block">Fora da gaveta</span>
            </div>

            {/* 4. Suprimentos */}
            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Suprimentos</span>
              <span className="text-base font-mono font-bold text-white">
                + R$ {(liveSummary?.suppliesTotal || 0).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 block">Entradas extras</span>
            </div>

            {/* 5. Sangrias e Despesas */}
            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-rose-400 block">Sangrias / Despesas</span>
              <span className="text-base font-mono font-bold text-rose-300">
                - R$ {((liveSummary?.bleedTotal || 0) + (liveSummary?.expensesTotal || 0)).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 block">Saídas da gaveta</span>
            </div>

            {/* 6. Dinheiro Esperado Fisicamente (Destaque) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/60 to-slate-900 border border-blue-500/40 space-y-1 shadow-lg shadow-blue-950/40">
              <span className="text-[10px] uppercase font-black text-blue-400 block">Dinheiro na Gaveta</span>
              <span className="text-lg font-mono font-black text-white">
                R$ {(liveSummary?.expectedCashNow || currentSession.initial_amount).toFixed(2)}
              </span>
              <span className="text-[10px] text-blue-300/80 block">Saldo físico atual</span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 space-y-3">
            <p className="text-xs max-w-md mx-auto">
              Para registrar vendas no balcão e emitir cupons não fiscais no PDV, o operador deve realizar a abertura do caixa informando o valor inicial de troco.
            </p>
            <Button
              type="button"
              onClick={() => setIsOpenModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/30"
            >
              <Unlock className="h-3.5 w-3.5 mr-1.5" />
              Abrir Caixa Agora
            </Button>
          </div>
        )}
      </div>

      {/* ─── HISTÓRICO DE SESSÕES DE CAIXA ─────────────────────────────────── */}
      <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              Histórico de Aberturas e Fechamentos
            </h3>
            <p className="text-xs text-slate-400">
              Auditoria de caixas anteriores, fechamentos com divergência e relatórios fiscais.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={loadHistory}
            className="text-xs text-slate-400 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Atualizar
          </Button>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full h-9 rounded-xl border border-slate-700 bg-slate-850 px-3 text-xs text-white"
            >
              <option value="all">Todos os Status</option>
              <option value="open">Abertos</option>
              <option value="closed">Fechados</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Data Início</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 bg-slate-850 border-slate-700 text-xs text-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Data Fim</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 bg-slate-850 border-slate-700 text-xs text-white"
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('all')
                setDateFrom('')
                setDateTo('')
              }}
              className="h-9 w-full text-xs border-slate-700 text-slate-400 hover:text-white"
            >
              Limpar Filtros
            </Button>
          </div>
        </div>

        {/* Tabela de Histórico */}
        {isLoadingHistory ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs">Carregando histórico de caixas...</p>
          </div>
        ) : sessionsHistory.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Nenhuma sessão de caixa encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 font-bold">
                  <th className="py-3 px-3">Terminal / Caixa</th>
                  <th className="py-3 px-3">Operador</th>
                  <th className="py-3 px-3">Abertura</th>
                  <th className="py-3 px-3">Fechamento</th>
                  <th className="py-3 px-3 text-right">Fundo Inicial</th>
                  <th className="py-3 px-3 text-right">Dinheiro Esperado</th>
                  <th className="py-3 px-3 text-right">Dinheiro Contado</th>
                  <th className="py-3 px-3 text-right">Diferença</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sessionsHistory.map((s) => {
                  const diff = s.difference_cash || 0
                  const isClosed = s.status === 'closed'
                  const isVerified = !!s.verified_by

                  return (
                    <tr key={s.id} className="hover:bg-slate-850/50 transition">
                      <td className="py-3 px-3 font-bold text-white">
                        {s.terminal_name}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {s.opened_by_name || 'Operador'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {new Date(s.opened_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {s.closed_at ? new Date(s.closed_at).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-white">
                        R$ {s.initial_amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-blue-400 font-bold">
                        {s.expected_cash !== null && s.expected_cash !== undefined ? `R$ ${s.expected_cash.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-white font-bold">
                        {s.counted_cash !== null && s.counted_cash !== undefined ? `R$ ${s.counted_cash.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {!isClosed ? (
                          <span className="text-slate-500">-</span>
                        ) : diff === 0 ? (
                          <span className="text-emerald-400 font-bold">R$ 0,00</span>
                        ) : diff > 0 ? (
                          <span className="text-blue-400 font-bold">+ R$ {diff.toFixed(2)}</span>
                        ) : (
                          <span className="text-rose-400 font-bold">- R$ {Math.abs(diff).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            s.status === 'open'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {s.status === 'open' ? 'Aberto' : 'Fechado'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedSessionForReport(s)}
                            className="h-7 px-2 text-[11px] text-slate-300 hover:text-white hover:bg-slate-800"
                            title="Ver Relatório"
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            Relatório
                          </Button>

                          {isManagerOrAdmin && isClosed && !isVerified && Math.abs(diff) > 0.01 && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setSelectedSessionForAudit(s)}
                              className="h-7 px-2 text-[11px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30"
                              title="Conferir Divergência"
                            >
                              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                              Conferir
                            </Button>
                          )}

                          {isVerified && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold" title={`Conferido por ${s.verified_by_name}`}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Auditado
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAIS ────────────────────────────────────────────────────────── */}
      {/* Modal de Abertura */}
      <OpenCashSessionModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        companyId={companyId}
        branchId={branchId}
        companyName={activeCompany?.trade_name || activeCompany?.legal_name || 'MundoMix'}
        branchName={activeBranch?.name || 'Filial Principal'}
        operatorName={profile?.full_name || user?.email?.split('@')[0] || 'Operador'}
        onSessionOpened={(sess) => {
          setCurrentSession(sess)
          loadCurrentSession()
          loadHistory()
        }}
      />

      {/* Modal de Movimentações (Suprimento / Sangria / Despesa) */}
      <CashMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        session={currentSession}
        currentExpectedCash={liveSummary?.expectedCashNow || currentSession?.initial_amount || 0}
        defaultType={movementModalType}
        onMovementAdded={() => {
          loadCurrentSession()
        }}
      />

      {/* Modal de Fechamento */}
      <CloseCashSessionModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        session={currentSession}
        companyId={companyId}
        onSessionClosed={(closed) => {
          setCurrentSession(null)
          setLiveSummary(null)
          setSelectedSessionForReport(closed)
          loadHistory()
        }}
      />

      {/* Modal de Relatório */}
      <CashReportModal
        isOpen={!!selectedSessionForReport}
        onClose={() => setSelectedSessionForReport(null)}
        session={selectedSessionForReport}
        company={activeCompany}
      />

      {/* Modal de Auditoria Gerencial */}
      <CashAuditModal
        isOpen={!!selectedSessionForAudit}
        onClose={() => setSelectedSessionForAudit(null)}
        session={selectedSessionForAudit}
        companyId={companyId}
        onVerified={() => {
          loadHistory()
        }}
      />
    </div>
  )
}
