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
import { payableService } from '@/lib/services/payable.service'
import type { PayableInstallment, PayableStatus, FinancialCategory, PayableKpis } from '@/types/payable'
import { PayInstallmentModal } from './modals/PayInstallmentModal'
import { CreatePayableModal } from './modals/CreatePayableModal'
import { PayableDetailsModal } from './modals/PayableDetailsModal'

export function AccountsPayablePage() {
  const { activeCompany, activeBranch, user } = useAuth()
  const companyId = activeCompany?.id || ''
  const branchId = activeBranch?.id || ''

  // Estado dos filtros
  const [statusTab, setStatusTab] = useState<'all' | PayableStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Dados
  const [installments, setInstallments] = useState<PayableInstallment[]>([])
  const [categories, setCategories] = useState<FinancialCategory[]>([])
  const [kpis, setKpis] = useState<PayableKpis>({
    totalOpen: 0,
    totalOverdue: 0,
    totalDueToday: 0,
    totalDueUpcoming: 0,
    totalPaidPeriod: 0,
    countDueSoon: 0,
    totalCount: 0,
  })
  const [isLoading, setIsLoading] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]

  // Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedInstForPay, setSelectedInstForPay] = useState<PayableInstallment | null>(null)
  const [selectedInstForDetails, setSelectedInstForDetails] = useState<PayableInstallment | null>(null)

  // Carrega categorias
  useEffect(() => {
    if (companyId) {
      payableService
        .listCategories(companyId)
        .then((cats) => setCategories(cats))
        .catch((err) => console.warn('Erro ao carregar categorias:', err))
    }
  }, [companyId])

  // Carrega parcelas e KPIs
  const loadData = useCallback(async () => {
    if (!companyId) return
    setIsLoading(true)
    try {
      // Sincroniza silenciosamente em segundo plano eventuais registros órfãos
      payableService.cleanupOrphanedPayables(companyId).catch(() => {})

      const [list, metrics] = await Promise.all([
        payableService.listInstallments({
          companyId,
          branchId: branchId || undefined,
          status: statusTab,
          categoryId: categoryId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          searchQuery: searchQuery || undefined,
        }),
        payableService.getPayableKpis(companyId, branchId || undefined),
      ])

      setInstallments(list)
      setKpis(metrics)
    } catch (err) {
      console.warn('Erro ao carregar contas a pagar:', err)
    } finally {
      setIsLoading(false)
    }
  }, [companyId, branchId, statusTab, categoryId, startDate, endDate, searchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Escuta atualizações no módulo financeiro (baixa, exclusão, etc.)
  useEffect(() => {
    function handleUpdate() {
      loadData()
    }

    window.addEventListener('financial-records-changed', handleUpdate)
    window.addEventListener('focus', handleUpdate)

    return () => {
      window.removeEventListener('financial-records-changed', handleUpdate)
      window.removeEventListener('focus', handleUpdate)
    }
  }, [loadData])

  async function handleDeletePayable(inst: PayableInstallment) {
    const desc = inst.payable?.description || 'esta conta a pagar'
    const doc = inst.payable?.document_number ? ` (Doc: ${inst.payable.document_number})` : ''
    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir permanentemente a conta a pagar "${desc}"${doc}?\n\nEsta ação removerá todas as parcelas vinculadas. Não pode ser desfeita.`
    )
    if (!confirmDelete) return

    try {
      await payableService.deletePayable(companyId, inst.payable_id)
      toast.success('Conta a pagar excluída com sucesso!')
      await loadData()
    } catch (err: any) {
      console.error('Erro ao excluir conta a pagar:', err)
      toast.error(err.message || 'Falha ao excluir conta a pagar.')
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── CABEÇALHO DA PÁGINA ─────────────────────────────────────────── */}
      <PageHeader
        title="Contas a Pagar"
        description="Gestão de despesas, fornecedores, boletos operacionais e liquidações financeiras"
        actions={
          <div className="flex items-center gap-2">
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
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-blue-900/30"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nova Conta a Pagar
            </Button>
          </div>
        }
      />

      {/* ─── CARDS DE INDICADORES (KPIS) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total em Aberto */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total em Aberto
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            R$ {kpis.totalOpen.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Saldo pendente de pagamento
          </span>
        </div>

        {/* Total Vencido */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-rose-900/30 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
              Total Vencido
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">
            R$ {kpis.totalOverdue.toFixed(2)}
          </div>
          <span className="text-[11px] text-rose-400/80 mt-1 block">
            Obrigações em atraso
          </span>
        </div>

        {/* Vence Hoje */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-amber-900/30 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Vence Hoje
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            R$ {kpis.totalDueToday.toFixed(2)}
          </div>
          <span className="text-[11px] text-amber-400/80 mt-1 block">
            Vencimentos do dia
          </span>
        </div>

        {/* Próximos 7 Dias */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              A Vencer (7 Dias)
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-300 font-mono">
            {kpis.countDueSoon} contas
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Exigem atenção na semana
          </span>
        </div>

        {/* Total Pago */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-900/30 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Total Pago
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            R$ {kpis.totalPaidPeriod.toFixed(2)}
          </div>
          <span className="text-[11px] text-emerald-400/80 mt-1 block">
            Baixas acumuladas
          </span>
        </div>
      </div>

      {/* ─── FILTROS E ABAS DE STATUS ────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        {/* Abas de Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800">
          {[
            { id: 'all', label: 'Todas as Contas' },
            { id: 'pending', label: 'Pendentes' },
            { id: 'partially_paid', label: 'Parcialmente Pagas' },
            { id: 'overdue', label: 'Vencidas' },
            { id: 'paid', label: 'Pagas' },
            { id: 'cancelled', label: 'Canceladas' },
          ].map((tab) => {
            const isSelected = statusTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Barra de Busca e Filtros de Data e Categoria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca Textual */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar descrição, fornecedor, documento..."
              className="pl-9 bg-slate-800 border-slate-700 text-white text-xs h-9"
            />
          </div>

          {/* Categoria */}
          <div>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none h-9"
            >
              <option value="">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vencimento De */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 whitespace-nowrap">De:</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white text-xs h-9"
            />
          </div>

          {/* Vencimento Até */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 whitespace-nowrap">Até:</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white text-xs h-9"
            />
          </div>
        </div>
      </div>

      {/* ─── TABELA DE PARCELAS / OBRIGAÇÕES ──────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 font-bold">
              <tr>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Descrição / Obrigação</th>
                <th className="py-3 px-4">Fornecedor</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4 text-center">Parc.</th>
                <th className="py-3 px-4 text-right">Valor Nominal</th>
                <th className="py-3 px-4 text-right">Valor Pago</th>
                <th className="py-3 px-4 text-right">Saldo Devedor</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
                      <span>Carregando contas a pagar...</span>
                    </div>
                  </td>
                </tr>
              ) : installments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Nenhuma conta a pagar encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                installments.map((inst) => {
                  const payable = inst.payable
                  const isOverdue =
                    ['pending', 'partially_paid'].includes(inst.status) && inst.due_date < todayStr
                  const isDueToday =
                    ['pending', 'partially_paid'].includes(inst.status) && inst.due_date === todayStr
                  const isPending = ['pending', 'partially_paid', 'overdue'].includes(inst.status)

                  return (
                    <tr
                      key={inst.id}
                      className="hover:bg-slate-850/50 transition duration-150"
                    >
                      {/* Vencimento */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono font-bold">
                          {isOverdue && (
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                          )}
                          <span
                            className={
                              isOverdue
                                ? 'text-rose-400'
                                : isDueToday
                                ? 'text-amber-400'
                                : 'text-slate-200'
                            }
                          >
                            {new Date(inst.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </td>

                      {/* Descrição */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white max-w-xs truncate">
                          {payable?.description || 'Despesa'}
                        </div>
                        {payable?.document_number && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Doc: {payable.document_number}
                          </span>
                        )}
                      </td>

                      {/* Fornecedor */}
                      <td className="py-3 px-4 text-slate-300">
                        {inst.supplier ? (
                          <div className="font-medium text-white max-w-[180px] truncate">
                            {inst.supplier.name}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Despesa Geral</span>
                        )}
                      </td>

                      {/* Categoria */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                          {payable?.category?.name || 'Geral'}
                        </span>
                      </td>

                      {/* Parcela */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                        {inst.installment_number}/{payable?.installments_count || 1}
                      </td>

                      {/* Valor Nominal */}
                      <td className="py-3 px-4 text-right font-mono text-slate-300 font-bold">
                        R$ {inst.amount.toFixed(2)}
                      </td>

                      {/* Valor Pago */}
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 font-semibold">
                        R$ {inst.paid_amount.toFixed(2)}
                      </td>

                      {/* Saldo Devedor */}
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={
                            inst.balance_amount > 0.009 ? 'text-rose-400' : 'text-slate-400'
                          }
                        >
                          R$ {inst.balance_amount.toFixed(2)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            inst.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : inst.status === 'partially_paid'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : isOverdue || inst.status === 'overdue'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : inst.status === 'cancelled'
                              ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {inst.status === 'paid' && 'Quitada'}
                          {inst.status === 'partially_paid' && 'Parcial'}
                          {(isOverdue || inst.status === 'overdue') && 'Vencida'}
                          {inst.status === 'pending' && !isOverdue && 'Pendente'}
                          {inst.status === 'cancelled' && 'Cancelada'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedInstForDetails(inst)}
                            title="Ver Detalhes e Auditoria"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePayable(inst)}
                            title="Excluir Conta a Pagar"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

                          {isPending && inst.balance_amount > 0.009 && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setSelectedInstForPay(inst)}
                              className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-8 px-3 rounded-xl shadow-md shadow-rose-900/20"
                            >
                              <DollarSign className="h-3.5 w-3.5 mr-1" />
                              Pagar
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
      {/* Modal de Pagamento / Baixa */}
      <PayInstallmentModal
        isOpen={Boolean(selectedInstForPay)}
        onClose={() => setSelectedInstForPay(null)}
        installment={selectedInstForPay}
        companyId={companyId}
        branchId={branchId}
        userId={user?.id}
        onSuccess={loadData}
      />

      {/* Modal de Criação de Conta */}
      <CreatePayableModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        companyId={companyId}
        branchId={branchId}
        onSuccess={loadData}
      />

      {/* Modal de Detalhes / Auditoria */}
      <PayableDetailsModal
        isOpen={Boolean(selectedInstForDetails)}
        onClose={() => setSelectedInstForDetails(null)}
        installment={selectedInstForDetails}
        companyId={companyId}
        onOpenPay={(inst) => setSelectedInstForPay(inst)}
        onSuccess={loadData}
      />
    </div>
  )
}
