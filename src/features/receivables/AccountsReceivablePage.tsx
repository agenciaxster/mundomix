import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Search,
  Plus,
  RotateCcw,
  Eye,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'
import { receivableService } from '@/lib/services/receivable.service'
import type { ReceivableInstallment, ReceivableStatus } from '@/types/receivable'

// Modais
import { ReceivePaymentModal } from './modals/ReceivePaymentModal'
import { ReceivableDetailsModal } from './modals/ReceivableDetailsModal'
import { CreateReceivableModal } from './modals/CreateReceivableModal'

export function AccountsReceivablePage() {
  const { activeCompany, activeBranch, user } = useAuth()
  const companyId = activeCompany?.id || ''
  const branchId = activeBranch?.id || ''

  // Dados
  const [installments, setInstallments] = useState<ReceivableInstallment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [metrics, setMetrics] = useState({
    totalOpen: 0,
    totalOverdue: 0,
    totalDueToday: 0,
    countOverdue: 0,
    totalCount: 0,
  })

  // Filtros
  const [statusTab, setStatusTab] = useState<ReceivableStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [onlyOverdue, setOnlyOverdue] = useState(false)

  // Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedForReceive, setSelectedForReceive] = useState<ReceivableInstallment | null>(null)
  const [selectedForDetails, setSelectedForDetails] = useState<ReceivableInstallment | null>(null)

  // Carrega listagem de parcelas
  const loadData = useCallback(async () => {
    if (!companyId) return
    setIsLoading(true)
    try {
      const [list, sum] = await Promise.all([
        receivableService.listInstallments({
          companyId,
          branchId: branchId || undefined,
          status: statusTab !== 'all' ? statusTab : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          searchQuery: searchQuery || undefined,
          onlyOverdue: onlyOverdue || undefined,
        }),
        receivableService.getSummaryMetrics(companyId, branchId || undefined),
      ])

      setInstallments(list)
      setMetrics(sum)
    } catch (err) {
      console.warn('Aviso ao carregar contas a receber:', err)
    } finally {
      setIsLoading(false)
    }
  }, [companyId, branchId, statusTab, startDate, endDate, searchQuery, onlyOverdue])

  useEffect(() => {
    loadData()
  }, [loadData])

  const [isClearing, setIsClearing] = useState(false)

  async function handleDeleteReceivable(inst: ReceivableInstallment) {
    const cust = inst.customer?.name || 'Cliente'
    const doc = inst.receivable?.document_number ? ` (Doc: ${inst.receivable.document_number})` : ''
    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir permanentemente o título a receber de "${cust}"${doc}?\n\nEsta ação removerá todas as parcelas deste título. Não pode ser desfeita.`
    )
    if (!confirmDelete) return

    try {
      await receivableService.deleteReceivable(companyId, inst.receivable_id)
      toast.success('Conta a receber excluída com sucesso!')
      loadData()
    } catch (err: any) {
      console.error('Erro ao excluir conta a receber:', err)
      toast.error(err.message || 'Falha ao excluir conta a receber.')
    }
  }

  async function handleClearAllReceivables() {
    if (!companyId) return
    const totalCount = metrics.totalCount || installments.length

    if (totalCount === 0) {
      toast.info('Não há lançamentos de contas a receber para limpar.')
      return
    }

    const confirmClear = window.confirm(
      `⚠️ ATENÇÃO: Deseja realmente LIMPAR TODOS os títulos e parcelas de contas a receber já lançados?\n\nEsta ação apagará permanentemente todos os ${totalCount} lançamentos da empresa/filial atual e não pode ser revertida.\n\nDeseja prosseguir?`
    )
    if (!confirmClear) return

    setIsClearing(true)
    try {
      const res = await receivableService.clearAllReceivables(companyId, branchId || undefined)
      toast.success(`Contas a receber limpas com sucesso! ${res.deletedCount} títulos removidos.`)
      await loadData()
    } catch (err: any) {
      console.error('Erro ao limpar contas a receber:', err)
      toast.error(err.message || 'Falha ao limpar lançamentos de contas a receber.')
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── CABEÇALHO DA PÁGINA ─────────────────────────────────────────── */}
      <PageHeader
        title="Contas a Receber"
        description="Gestão de vendas a prazo, crediário, parcelas e liquidações financeiras"
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearAllReceivables}
              disabled={isClearing || isLoading || (metrics.totalCount === 0 && installments.length === 0)}
              className="text-xs border-rose-500/30 bg-rose-950/20 text-rose-300 hover:bg-rose-900/40 hover:text-white transition flex items-center gap-1.5"
              title="Limpar todos os títulos e parcelas lançados"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              {isClearing ? 'Limpando...' : 'Limpar Lançamentos'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="text-xs border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            >
              <RotateCcw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/30"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Lançamento Avulso
            </Button>
          </div>
        }
      />

      {/* ─── CARDS DE INDICADORES (KPIS) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total em Aberto */}
        <div className="p-5 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total a Receber</span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            R$ {metrics.totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400">Saldo financiado em aberto</p>
        </div>

        {/* Total Vencido */}
        <div className="p-5 rounded-3xl border border-rose-500/20 bg-rose-950/10 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Vencidos em Atraso</span>
            <div className="h-8 w-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">
            R$ {metrics.totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-rose-400/80">
            {metrics.countOverdue} {metrics.countOverdue === 1 ? 'parcela vencida' : 'parcelas vencidas'}
          </p>
        </div>

        {/* A Vencer Hoje */}
        <div className="p-5 rounded-3xl border border-amber-500/20 bg-amber-950/10 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Vencimento Hoje</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            R$ {metrics.totalDueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-amber-400/80">Previsão de recebimento para o dia</p>
        </div>

        {/* Total Geral de Parcelas */}
        <div className="p-5 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total de Títulos</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {metrics.totalCount}
          </div>
          <p className="text-[11px] text-slate-400">Títulos cadastrados no sistema</p>
        </div>
      </div>

      {/* ─── FILTROS E PESQUISA ─────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-4">
        {/* Abas de Status */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          {[
            { id: 'all', label: 'Todas as Parcelas' },
            { id: 'open', label: 'Em Aberto' },
            { id: 'partially_paid', label: 'Parcialmente Pagas' },
            { id: 'overdue', label: 'Vencidas' },
            { id: 'paid', label: 'Quitadas' },
          ].map((tab) => {
            const isSelected = statusTab === tab.id && !onlyOverdue
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setOnlyOverdue(false)
                  setStatusTab(tab.id as any)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setOnlyOverdue(!onlyOverdue)}
            className={`ml-auto px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              onlyOverdue
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'border-slate-800 bg-slate-850 text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
            Apenas Vencidas
          </button>
        </div>

        {/* Barra de Pesquisa e Período */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, documento, CPF ou título..."
              className="pl-9 bg-slate-800 border-slate-700 text-white text-xs h-10"
            />
          </div>

          <div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white text-xs h-10"
              placeholder="Vencimento De"
            />
          </div>

          <div>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white text-xs h-10"
              placeholder="Vencimento Até"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setStartDate('')
                setEndDate('')
                setStatusTab('all')
                setOnlyOverdue(false)
              }}
              className="w-full text-xs border-slate-700 bg-slate-800 text-slate-400 hover:text-white h-10"
            >
              Limpar Filtros
            </Button>
          </div>
        </div>
      </div>

      {/* ─── TABELA DE PARCELAS ─────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            Parcelas ({installments.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Documento / Título</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4 text-center">Parcela</th>
                <th className="py-3 px-4 text-right">Valor Original</th>
                <th className="py-3 px-4 text-right">Valor Pago</th>
                <th className="py-3 px-4 text-right">Saldo Devedor</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Carregando contas a receber...
                  </td>
                </tr>
              ) : installments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Nenhuma parcela localizada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                installments.map((inst) => {
                  const isPaid = inst.status === 'paid'
                  const isOverdue = inst.status === 'overdue'

                  return (
                    <tr
                      key={inst.id}
                      className="hover:bg-slate-850/50 transition duration-150"
                    >
                      {/* Vencimento */}
                      <td className="py-3 px-4 font-mono font-bold">
                        <span
                          className={
                            isPaid
                              ? 'text-slate-400'
                              : isOverdue
                              ? 'text-rose-400 underline decoration-rose-500/50'
                              : 'text-slate-200'
                          }
                        >
                          {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                        </span>
                      </td>

                      {/* Documento / Título */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-white block">
                          {inst.receivable?.document_number || '-'}
                        </span>
                        {inst.receivable?.description && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                            {inst.receivable.description}
                          </span>
                        )}
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-200 block truncate max-w-[200px]">
                          {inst.customer?.name || 'Cliente'}
                        </span>
                        {inst.customer?.document && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {inst.customer.document}
                          </span>
                        )}
                      </td>

                      {/* Parcela # */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-blue-400">
                        {inst.installment_number}
                      </td>

                      {/* Valor Original */}
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        R$ {inst.original_amount.toFixed(2)}
                      </td>

                      {/* Valor Pago */}
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        {inst.paid_amount > 0 ? `R$ ${inst.paid_amount.toFixed(2)}` : '-'}
                      </td>

                      {/* Saldo Devedor */}
                      <td className="py-3 px-4 text-right font-mono font-black text-white text-sm">
                        R$ {inst.balance_amount.toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : isOverdue
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : inst.status === 'partially_paid'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {isPaid
                            ? 'Quitada'
                            : isOverdue
                            ? 'Vencida'
                            : inst.status === 'partially_paid'
                            ? 'Parcial'
                            : 'Em Aberto'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedForDetails(inst)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                            title="Ver Detalhes do Título e Histórico"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteReceivable(inst)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                            title="Excluir Conta a Receber"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>

                          {!isPaid && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setSelectedForReceive(inst)}
                              className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 flex items-center gap-1"
                              title="Registrar Recebimento"
                            >
                              <DollarSign className="h-3 w-3" />
                              Receber
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAIS ──────────────────────────────────────────────────────── */}

      {/* Modal de Recebimento de Parcela */}
      <ReceivePaymentModal
        isOpen={!!selectedForReceive}
        onClose={() => setSelectedForReceive(null)}
        installment={selectedForReceive}
        companyId={companyId}
        branchId={branchId}
        userId={user?.id}
        onSuccess={loadData}
      />

      {/* Modal de Detalhes da Parcela */}
      <ReceivableDetailsModal
        isOpen={!!selectedForDetails}
        onClose={() => setSelectedForDetails(null)}
        installment={selectedForDetails}
        onOpenReceive={(inst) => setSelectedForReceive(inst)}
      />

      {/* Modal de Criação Manual de Título */}
      <CreateReceivableModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        companyId={companyId}
        branchId={branchId}
        onSuccess={loadData}
      />
    </div>
  )
}
