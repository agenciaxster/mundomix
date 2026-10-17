import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Eye,
  Pencil,
  Copy,
  Trash2,
  RefreshCw,
  Calculator,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { quoteService } from '@/lib/services/quote.service'
import type { Quote, QuoteKpis, QuoteStatus, QuoteFilters } from '@/types/quote'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import { QuoteDetailsModal } from './modals/QuoteDetailsModal'
import { toast } from '@/hooks/useToast'

type StatusFilter = QuoteStatus | 'all'

export function QuotesListPage() {
  const navigate = useNavigate()
  const { activeCompany, companies, hasPermission } = useAuth()

  const currentCompanyData = companies.find((c) => c.company.id === activeCompany?.id)
  const availableBranches = currentCompanyData?.branches || []

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [kpis, setKpis] = useState<QuoteKpis>({
    totalQuotes: 0,
    draftCount: 0,
    sentCount: 0,
    approvedCount: 0,
    convertedCount: 0,
    rejectedOrExpiredCount: 0,
    totalValue: 0,
    conversionRate: 0,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Modal de Detalhes
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const canCreateSales = hasPermission('sales', 'create')
  const canEditSales = hasPermission('sales', 'edit')
  const canDeleteSales = hasPermission('sales', 'delete')

  const loadData = useCallback(
    async (refresh = false) => {
      if (!activeCompany?.id) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const filters: QuoteFilters = {
          search: searchTerm,
          status: selectedStatus,
          branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page: currentPage,
          pageSize: 20,
        }

        const [listRes, kpisRes] = await Promise.all([
          quoteService.listQuotes(activeCompany.id, filters),
          quoteService.fetchQuoteKpis(
            activeCompany.id,
            selectedBranchId !== 'all' ? selectedBranchId : undefined
          ),
        ])

        setQuotes(listRes.data)
        setTotalCount(listRes.totalCount)
        setKpis(kpisRes)
      } catch (err: any) {
        console.error('Erro ao listar orçamentos:', err)
        toast.error(err.message || 'Falha ao buscar orçamentos.')
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [activeCompany, searchTerm, selectedStatus, selectedBranchId, dateFrom, dateTo, currentPage]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleDuplicate(quoteId: string) {
    if (!activeCompany) return
    try {
      const newId = await quoteService.duplicateQuote(quoteId, activeCompany.id)
      toast.success('Orçamento duplicado com sucesso!')
      navigate(`/comercial/orcamentos/${newId}/editar`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao duplicar orçamento.')
    }
  }

  async function handleDelete(quoteId: string, code: string) {
    if (!activeCompany) return
    if (!window.confirm(`Deseja realmente excluir o orçamento ${code}?`)) return

    try {
      await quoteService.deleteQuote(quoteId, activeCompany.id)
      toast.success(`Orçamento ${code} excluído com sucesso!`)
      loadData(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao excluir orçamento.')
    }
  }

  function getStatusBadge(status: QuoteStatus, validUntil: string) {
    const isExpired = new Date(validUntil + 'T23:59:59') < new Date() && status === 'sent'

    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-orange-400 border border-orange-500/30">
          <AlertCircle className="h-3 w-3" />
          Expirado
        </span>
      )
    }

    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300 border border-slate-700">
            <Clock className="h-3 w-3 text-slate-400" />
            Rascunho
          </span>
        )
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/30">
            <Send className="h-3 w-3 text-amber-400" />
            Enviado
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            Aprovado
          </span>
        )
      case 'converted':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-400 border border-blue-500/30">
            <CheckCircle2 className="h-3 w-3 text-blue-400" />
            Convertido
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-500/30">
            <XCircle className="h-3 w-3 text-rose-400" />
            Recusado
          </span>
        )
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-orange-400 border border-orange-500/30">
            <AlertCircle className="h-3 w-3 text-orange-400" />
            Expirado
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Orçamentos & Propostas Comerciais
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestão de atendimento, propostas de venda, condições de atacado e aprovação de clientes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="border-slate-800 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/cadastros/produtos')}
            className="border-slate-800 text-slate-300 hover:bg-slate-800"
          >
            Consultar Produtos
          </Button>

          {canCreateSales && (
            <Button
              onClick={() => navigate('/comercial/orcamentos/novo')}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-2 font-medium shadow-lg shadow-blue-600/20"
            >
              <Plus className="h-4 w-4" />
              Novo Orçamento
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
            Total Emitido
          </span>
          <div className="text-xl font-bold text-white mt-1">{kpis.totalQuotes}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Orçamentos</div>
        </div>

        {/* Rascunhos */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
            Em Rascunho
          </span>
          <div className="text-xl font-bold text-slate-300 mt-1">{kpis.draftCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Em elaboração</div>
        </div>

        {/* Enviados */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 block">
            Enviados
          </span>
          <div className="text-xl font-bold text-amber-300 mt-1">{kpis.sentCount}</div>
          <div className="text-[11px] text-amber-400/80 mt-0.5">Aguardando cliente</div>
        </div>

        {/* Aprovados */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 block">
            Aprovados
          </span>
          <div className="text-xl font-bold text-emerald-300 mt-1">{kpis.approvedCount}</div>
          <div className="text-[11px] text-emerald-400/80 mt-0.5">Prontos para faturar</div>
        </div>

        {/* Convertidos em Venda */}
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 block">
            Convertidos
          </span>
          <div className="text-xl font-bold text-blue-300 mt-1">{kpis.convertedCount}</div>
          <div className="text-[11px] text-blue-400/80 mt-0.5">
            {kpis.conversionRate}% conversão
          </div>
        </div>

        {/* Valor Total */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
            Volume em Negociação
          </span>
          <div className="text-lg font-bold text-emerald-400 mt-1">
            {kpis.totalValue.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Total acumulado</div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Busca por código ou cliente */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código (ORC-XXXX), nome do cliente ou documento..."
              className="pl-9 bg-slate-800/80 border-slate-700 text-white text-xs"
            />
          </div>

          {/* Filtro de Filial */}
          <div className="w-full md:w-56">
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Todas as Filiais</option>
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Datas */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-800/80 border-slate-700 text-white text-xs w-36"
              title="Data inicial"
            />
            <span className="text-slate-500 text-xs">até</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-800/80 border-slate-700 text-white text-xs w-36"
              title="Data final"
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800/60 pt-2 text-xs">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'draft', label: 'Rascunhos' },
            { id: 'sent', label: 'Enviados' },
            { id: 'approved', label: 'Aprovados' },
            { id: 'converted', label: 'Convertidos em Venda' },
            { id: 'rejected', label: 'Recusados' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedStatus(tab.id as StatusFilter)}
              className={`rounded-lg px-3 py-1 font-medium transition ${
                selectedStatus === tab.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Orçamentos */}
      {isLoading ? (
        <LoadingState message="Carregando orçamentos comerciais..." />
      ) : quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <FileText className="h-12 w-12 text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-white">Nenhum orçamento encontrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Não existem propostas cadastradas com os filtros aplicados.
          </p>
          {canCreateSales && (
            <Button
              onClick={() => navigate('/comercial/orcamentos/novo')}
              className="mt-4 bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar Primeiro Orçamento
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-850 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-4">Código / Data</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Filial</th>
                  <th className="p-4">Validade</th>
                  <th className="p-4 text-right">Valor Total</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {quotes.map((q) => {
                  const isConverted = q.status === 'converted'

                  return (
                    <tr key={q.id} className="hover:bg-slate-850/40 transition">
                      {/* Código e Data */}
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQuoteId(q.id)
                            setIsDetailsOpen(true)
                          }}
                          className="font-bold text-white hover:text-blue-400 font-mono text-sm block"
                        >
                          {q.code}
                        </button>
                        <span className="text-[11px] text-slate-400">
                          {new Date(q.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </td>

                      {/* Cliente */}
                      <td className="p-4">
                        <div className="font-semibold text-white">
                          {q.customer_name || 'Cliente Avulso'}
                        </div>
                        {q.customer_document && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {q.customer_document}
                          </div>
                        )}
                      </td>

                      {/* Filial */}
                      <td className="p-4 text-slate-300">
                        {q.branch?.name || 'Matriz'}
                      </td>

                      {/* Validade */}
                      <td className="p-4 text-slate-300">
                        {new Date(q.valid_until + 'T23:59:59').toLocaleDateString('pt-BR')}
                      </td>

                      {/* Valor Total */}
                      <td className="p-4 text-right">
                        <div className="font-black text-white text-sm">
                          {q.total.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </div>
                        {q.discount_amount > 0 && (
                          <div className="text-[10px] text-rose-400">
                            Desc: -R$ {q.discount_amount.toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        {getStatusBadge(q.status, q.valid_until)}
                      </td>

                      {/* Ações */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQuoteId(q.id)
                              setIsDetailsOpen(true)
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            title="Visualizar e Imprimir"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {!isConverted && (
                            <button
                              type="button"
                              onClick={() => navigate(`/comercial/pdv?quote_id=${q.id}`)}
                              className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                              title="Faturar no PDV (Frente de Caixa)"
                            >
                              <Calculator className="h-4 w-4" />
                            </button>
                          )}

                          {!isConverted && canEditSales && (
                            <button
                              type="button"
                              onClick={() => navigate(`/comercial/orcamentos/${q.id}/editar`)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                              title="Editar orçamento"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}

                          {canCreateSales && (
                            <button
                              type="button"
                              onClick={() => handleDuplicate(q.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                              title="Duplicar como novo orçamento"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          )}

                          {!isConverted && canDeleteSales && (
                            <button
                              type="button"
                              onClick={() => handleDelete(q.id, q.code)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                              title="Excluir orçamento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Página {currentPage} — Mostrando {quotes.length} de {totalCount} orçamentos
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-7 text-xs border-slate-700 text-slate-300"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage * 20 >= totalCount}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-7 text-xs border-slate-700 text-slate-300"
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes Completo */}
      <QuoteDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false)
          setSelectedQuoteId(null)
        }}
        quoteId={selectedQuoteId}
        onStatusChanged={() => loadData(true)}
      />
    </div>
  )
}
