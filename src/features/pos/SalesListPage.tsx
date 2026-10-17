import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  Search,
  RefreshCw,
  Eye,
  DollarSign,
  TrendingUp,
  CreditCard,
  Banknote,
  QrCode,
  Calculator,
  Printer,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { saleService } from '@/lib/services/sale.service'
import type { Sale, SaleKpis } from '@/types/sale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SaleDetailsModal } from './modals/SaleDetailsModal'
import { ReceiptPreviewModal } from './modals/ReceiptPreviewModal'

export function SalesListPage() {
  const navigate = useNavigate()
  const { activeCompany, companies } = useAuth()

  const currentCompanyData = companies.find((c) => c.company.id === activeCompany?.id)
  const availableBranches = currentCompanyData?.branches || []

  const [sales, setSales] = useState<Sale[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  // KPIs
  const [kpis, setKpis] = useState<SaleKpis>({
    todayTotal: 0,
    todayCount: 0,
    averageTicket: 0,
    cashTotal: 0,
    pixTotal: 0,
    cardTotal: 0,
  })

  // Modal de Detalhes
  const [selectedSaleForDetails, setSelectedSaleForDetails] = useState<Sale | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  // Modal de Impressão de Comprovante (Etapa 10)
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState<Sale | null>(null)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)

  const loadData = useCallback(
    async (refresh = false) => {
      if (!activeCompany?.id) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const [salesRes, kpisRes] = await Promise.all([
          saleService.listSales(activeCompany.id, {
            branchId: selectedBranchId,
            search: searchTerm,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            page,
            pageSize: 20,
          }),
          saleService.getSaleKpis(
            activeCompany.id,
            selectedBranchId !== 'all' ? selectedBranchId : undefined
          ),
        ])

        setSales(salesRes.data)
        setTotalCount(salesRes.totalCount)
        setKpis(kpisRes)
      } catch (err) {
        console.error('Erro ao carregar vendas:', err)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [activeCompany?.id, selectedBranchId, searchTerm, dateFrom, dateTo, page]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  function handleOpenDetails(sale: Sale) {
    setSelectedSaleForDetails(sale)
    setIsDetailsOpen(true)
  }

  async function handleOpenPrint(sale: Sale) {
    if (!activeCompany?.id) return
    try {
      // Carrega os itens e dados completos persistidos no Supabase
      const fullSale = await saleService.getSale(sale.id, activeCompany.id)
      setSelectedSaleForPrint(fullSale || sale)
    } catch {
      setSelectedSaleForPrint(sale)
    }
    setIsPrintModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* ─── Topo / Cabeçalho da Página ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Histórico de Vendas Faturadas</h1>
              <p className="text-xs text-slate-400">
                Auditoria e acompanhamento de transações realizadas no PDV
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            Atualizar
          </Button>

          <Button
            type="button"
            onClick={() => navigate('/comercial/pdv')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/50"
          >
            <Calculator className="h-4 w-4" />
            Abrir Frente de Caixa (PDV)
          </Button>
        </div>
      </div>

      {/* ─── Cards de KPIs do Dia ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Faturado Hoje */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Faturado Hoje
            </span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            R$ {kpis.todayTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Vendas concluídas hoje</p>
        </div>

        {/* Quantidade de Vendas */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total de Vendas
            </span>
            <ShoppingCart className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{kpis.todayCount}</div>
          <p className="text-[11px] text-slate-500 font-medium">Atendimentos no caixa</p>
        </div>

        {/* Ticket Médio */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ticket Médio
            </span>
            <TrendingUp className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono">
            R$ {kpis.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Valor médio por cliente</p>
        </div>

        {/* Formas de Pagamento Hoje */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
          <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block">
            Distribuição de Pagamentos Hoje
          </span>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Banknote className="h-3 w-3 text-emerald-400" /> Dinheiro:
              </span>
              <span className="font-mono font-bold text-slate-200">
                R$ {kpis.cashTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <QrCode className="h-3 w-3 text-teal-400" /> Pix:
              </span>
              <span className="font-mono font-bold text-slate-200">
                R$ {kpis.pixTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <CreditCard className="h-3 w-3 text-blue-400" /> Cartões:
              </span>
              <span className="font-mono font-bold text-slate-200">
                R$ {kpis.cardTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Barra de Filtros ─────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca Textual */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código VND, cliente ou CPF..."
              className="pl-9 bg-slate-800 border-slate-700 text-white text-xs h-9"
            />
          </div>

          {/* Filial */}
          <div>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none h-9 font-medium"
            >
              <option value="all">Todas as Filiais</option>
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Data De */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0">De:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white text-xs h-9"
            />
          </div>

          {/* Data Até */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0">Até:</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white text-xs h-9"
            />
          </div>
        </div>
      </div>

      {/* ─── Tabela de Vendas Faturadas ───────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-850/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Código / Venda</th>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Filial</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Pagamento(s)</th>
                <th className="py-3 px-4 text-right">Total Faturado</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    Carregando histórico de vendas...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 space-y-2">
                    <p className="font-semibold text-sm">Nenhuma venda faturada encontrada.</p>
                    <p className="text-xs text-slate-500">
                      Realize uma venda na frente de caixa (PDV) para registrar transações.
                    </p>
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-850/50 transition">
                    {/* Código / Número */}
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      <span className="text-emerald-400">{s.code}</span>
                      {s.quote_id && (
                        <span className="block text-[10px] text-blue-400 font-sans">
                          via Orçamento
                        </span>
                      )}
                    </td>

                    {/* Data / Hora */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {new Date(s.created_at).toLocaleString('pt-BR')}
                    </td>

                    {/* Filial */}
                    <td className="py-3.5 px-4 font-medium text-slate-300">
                      {s.branch?.name || 'Filial'}
                    </td>

                    {/* Cliente */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white truncate max-w-[180px]">
                        {s.customer_name || 'Consumidor Final'}
                      </div>
                      {s.customer_document && (
                        <div className="text-[10px] text-slate-500 font-mono truncate">
                          {s.customer_document}
                        </div>
                      )}
                    </td>

                    {/* Formas de Pagamento */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1">
                        {s.payments && s.payments.length > 0 ? (
                          s.payments.map((p, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300 capitalize border border-slate-700"
                            >
                              {p.payment_method === 'cash'
                                ? 'Dinheiro'
                                : p.payment_method === 'pix'
                                ? 'Pix'
                                : p.payment_method === 'credit_card'
                                ? 'Crédito'
                                : p.payment_method === 'debit_card'
                                ? 'Débito'
                                : p.payment_method}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-[10px]">-</span>
                        )}
                      </div>
                    </td>

                    {/* Total Faturado */}
                    <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-emerald-400 whitespace-nowrap">
                      R$ {s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenPrint(s)}
                          className="text-slate-400 hover:text-blue-400 hover:bg-slate-800 p-1.5 rounded-lg"
                          title="Imprimir comprovante não fiscal"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDetails(s)}
                          className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg"
                          title="Ver detalhes da venda"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 bg-slate-850/60 text-xs text-slate-400">
          <span>
            Mostrando <strong className="text-white">{sales.length}</strong> de{' '}
            <strong className="text-white">{totalCount}</strong> vendas registradas
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
            >
              Anterior
            </Button>
            <span className="font-mono font-bold text-white px-2">Página {page}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page * 20 >= totalCount}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Detalhes da Venda */}
      <SaleDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false)
          setSelectedSaleForDetails(null)
        }}
        sale={selectedSaleForDetails}
        onPrint={(saleToPrint) => {
          setIsDetailsOpen(false)
          handleOpenPrint(saleToPrint)
        }}
      />

      {/* Modal de Impressão / Reimpressão de Comprovante Não Fiscal */}
      <ReceiptPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false)
          setSelectedSaleForPrint(null)
        }}
        sale={selectedSaleForPrint}
        company={activeCompany}
        isReprint={true}
      />
    </div>
  )
}
