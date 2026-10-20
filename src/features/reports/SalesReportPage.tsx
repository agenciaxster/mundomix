import { useState, useEffect, useCallback } from 'react'
import {
  FileSpreadsheet,
  Printer,
  Eye,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { reportService } from '@/lib/services/report.service'
import type { ReportFilterState, SalesReportItem } from '@/types/report'
import { ReportFilterBar } from './components/ReportFilterBar'
import { ReportPrintHeader } from './components/ReportPrintHeader'
import { ReportPrintFooter } from './components/ReportPrintFooter'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { exportToExcel, triggerPrint } from '@/lib/utils/report-export'
import { SaleDetailsModal } from '@/features/pos/modals/SaleDetailsModal'
import { saleService } from '@/lib/services/sale.service'
import type { Sale } from '@/types/sale'

export function SalesReportPage() {
  const { activeCompany, companies, activeBranch, profile, user } = useAuth()

  const currentCompanyData = companies.find((c) => c.company.id === activeCompany?.id)
  const availableBranches = currentCompanyData?.branches || []

  const today = new Date()
  const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const [filters, setFilters] = useState<ReportFilterState>({
    companyId: activeCompany?.id || '',
    branchId: activeBranch?.id || 'all',
    sellerId: 'all',
    paymentMethod: 'all',
    periodPreset: 'thisMonth',
    dateFrom: firstDayMonth,
    dateTo: todayStr,
  })

  const [sales, setSales] = useState<SalesReportItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Modal de Detalhes da Venda
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [loadingSaleDetails, setLoadingSaleDetails] = useState(false)

  useEffect(() => {
    if (activeCompany?.id && activeCompany.id !== filters.companyId) {
      setFilters((prev) => ({ ...prev, companyId: activeCompany.id }))
    }
  }, [activeCompany?.id])

  const loadData = useCallback(
    async (refresh = false) => {
      if (!filters.companyId) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const data = await reportService.getSalesReport(filters)
        setSales(data)
      } catch (err) {
        console.error('Erro ao carregar Relatório de Vendas:', err)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [filters]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleOpenSaleDetails(saleId: string) {
    if (!activeCompany?.id) return
    setLoadingSaleDetails(true)
    try {
      const fullSale = await saleService.getSale(saleId, activeCompany.id)
      if (fullSale) {
        setSelectedSale(fullSale)
        setIsDetailsOpen(true)
      }
    } catch (err) {
      console.error('Erro ao abrir detalhes da venda:', err)
    } finally {
      setLoadingSaleDetails(false)
    }
  }

  // Totais do Relatório
  const completedSales = sales.filter((s) => s.status === 'completed')
  const totalNet = completedSales.reduce((acc, curr) => acc + curr.total, 0)
  const totalGross = completedSales.reduce((acc, curr) => acc + curr.subtotal, 0)
  const totalDiscount = completedSales.reduce((acc, curr) => acc + curr.discountAmount, 0)
  const avgTicket = completedSales.length > 0 ? totalNet / completedSales.length : 0

  function handleExportExcel() {
    exportToExcel({
      filename: `relatorio_vendas_${filters.dateFrom}_a_${filters.dateTo}`,
      title: 'Relatório Analítico de Vendas - ERP MundoMix',
      filters: {
        Empresa: activeCompany?.trade_name || 'Matriz',
        Período: `${filters.dateFrom} até ${filters.dateTo}`,
      },
      columns: [
        { header: 'Cód. Venda', key: 'code' },
        {
          header: 'Data/Hora',
          key: 'createdAt',
          formatter: (v) => new Date(v).toLocaleString('pt-BR'),
        },
        { header: 'Cliente', key: 'customerName' },
        { header: 'Vendedor/Operador', key: 'sellerName' },
        { header: 'Filial', key: 'branchName' },
        {
          header: 'Status',
          key: 'status',
          formatter: (v) => (v === 'completed' ? 'Concluída' : 'Cancelada'),
        },
        {
          header: 'Subtotal (R$)',
          key: 'subtotal',
          formatter: (v) => Number(v).toFixed(2),
        },
        {
          header: 'Desconto (R$)',
          key: 'discountAmount',
          formatter: (v) => Number(v).toFixed(2),
        },
        {
          header: 'Total Líquido (R$)',
          key: 'total',
          formatter: (v) => Number(v).toFixed(2),
        },
        { header: 'Formas de Pagamento', key: 'paymentMethods' },
      ],
      data: sales,
    })
  }

  const activeBranchName =
    filters.branchId === 'all'
      ? 'Todas as Filiais'
      : availableBranches.find((b) => b.id === filters.branchId)?.name || activeBranch?.name || 'Filial'

  const userDisplayName = profile?.full_name || user?.email || 'Usuário Autenticado'

  return (
    <div className="space-y-6">
      {/* ─── CABEÇALHO INSTITUCIONAL DE IMPRESSÃO (Visível apenas na impressão) ─── */}
      <ReportPrintHeader
        title="Relatório Analítico de Vendas"
        subtitle="Relação de faturamento por período, operador, formas de pagamento e descontos"
        company={activeCompany}
        branch={activeBranch}
        userName={userDisplayName}
        filtersSummary={{
          Filial: activeBranchName,
          Período: `${new Date(filters.dateFrom).toLocaleDateString('pt-BR')} até ${new Date(filters.dateTo).toLocaleDateString('pt-BR')}`,
          'Forma de Pgto': filters.paymentMethod !== 'all' ? filters.paymentMethod : undefined,
        }}
      />

      {/* Header na Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Relatório de Vendas</h1>
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
              Analítico & Itens
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Histórico completo de pedidos faturados, formas de recebimento e consulta detalhada de itens.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={sales.length === 0}
            className="border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            Exportar Excel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={triggerPrint}
            className="border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5 text-blue-400" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Filtros da Tela */}
      <div className="print:hidden">
        <ReportFilterBar
          filters={filters}
          onChange={setFilters}
          branches={availableBranches}
          showSellerFilter
          showPaymentMethodFilter
          onRefresh={() => loadData(true)}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Cards de Resumo da Tela */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total Líquido Concluído</p>
          <p className="text-xl font-bold text-white font-mono mt-1">
            R$ {totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{completedSales.length} venda(s) válida(s)</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Faturamento Bruto</p>
          <p className="text-xl font-bold text-slate-300 font-mono mt-1">
            R$ {totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Soma antes dos descontos</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total de Descontos</p>
          <p className="text-xl font-bold text-amber-400 font-mono mt-1">
            R$ {totalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Descontos aplicados no PDV</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Ticket Médio</p>
          <p className="text-xl font-bold text-emerald-400 font-mono mt-1">
            R$ {avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Média por transação</p>
        </div>
      </div>

      {/* Tabela de Vendas */}
      {isLoading ? (
        <LoadingState message="Buscando histórico analítico de vendas..." />
      ) : sales.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
          Nenhuma venda encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-800/50 text-[11px] font-semibold text-slate-400 uppercase">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Vendedor</th>
                  <th className="py-3 px-4">Filial</th>
                  <th className="py-3 px-4">Formas Pgto</th>
                  <th className="py-3 px-4 text-right">Líquido</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-normal text-slate-300">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-white">{sale.code}</td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(sale.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-200">{sale.customerName}</td>
                    <td className="py-3 px-4 text-slate-300">{sale.sellerName}</td>
                    <td className="py-3 px-4 text-slate-400">{sale.branchName}</td>
                    <td className="py-3 px-4 text-slate-300">{sale.paymentMethods}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {sale.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Concluída
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                          <XCircle className="h-3 w-3" /> Cancelada
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center print:hidden">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={loadingSaleDetails}
                        onClick={() => handleOpenSaleDetails(sale.id)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                        title="Ver detalhes da venda e itens"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-700 bg-slate-850 font-bold text-xs">
                <tr className="print-totals-row">
                  <td colSpan={6} className="py-3 px-4 text-right uppercase text-slate-300">
                    Total Faturado ({completedSales.length} vendas válidas):
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-white text-sm">
                    R$ {totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="py-3 px-4 print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Rodapé Padronizado de Impressão */}
      <ReportPrintFooter />

      {/* Modal de Detalhes da Venda Selecionada */}
      {selectedSale && (
        <SaleDetailsModal
          sale={selectedSale}
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  )
}
