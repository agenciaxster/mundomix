import { useState, useEffect, useCallback } from 'react'
import {
  FileSpreadsheet,
  Printer,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { reportService } from '@/lib/services/report.service'
import type { ReportFilterState, ProductRankingItem } from '@/types/report'
import { ReportFilterBar } from './components/ReportFilterBar'
import { ReportPrintHeader } from './components/ReportPrintHeader'
import { ReportPrintFooter } from './components/ReportPrintFooter'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { exportToExcel, triggerPrint } from '@/lib/utils/report-export'

export function ProductsReportPage() {
  const { activeCompany, companies, activeBranch, profile, user } = useAuth()

  const currentCompanyData = companies.find((c) => c.company.id === activeCompany?.id)
  const availableBranches = currentCompanyData?.branches || []

  const today = new Date()
  const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const [filters, setFilters] = useState<ReportFilterState>({
    companyId: activeCompany?.id || '',
    branchId: activeBranch?.id || 'all',
    periodPreset: 'thisMonth',
    dateFrom: firstDayMonth,
    dateTo: todayStr,
  })

  const [products, setProducts] = useState<ProductRankingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

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
        const data = await reportService.getProductsRankingReport(filters)
        setProducts(data)
      } catch (err) {
        console.error('Erro ao carregar Relatório de Produtos Mais Vendidos:', err)
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

  const totalSoldQty = products.reduce((acc, curr) => acc + curr.quantitySold, 0)
  const totalRevenue = products.reduce((acc, curr) => acc + curr.totalRevenue, 0)

  function handleExportExcel() {
    exportToExcel({
      filename: `curva_abc_produtos_${filters.dateFrom}_a_${filters.dateTo}`,
      title: 'Produtos Mais Vendidos e Curva ABC - ERP MundoMix',
      filters: {
        Empresa: activeCompany?.trade_name || 'Matriz',
        Período: `${filters.dateFrom} até ${filters.dateTo}`,
      },
      columns: [
        { header: 'Produto', key: 'productName' },
        { header: 'SKU', key: 'sku' },
        { header: 'Unidade', key: 'unit' },
        { header: 'Qtd Vendida', key: 'quantitySold' },
        {
          header: 'Receita Total (R$)',
          key: 'totalRevenue',
          formatter: (v) => Number(v).toFixed(2),
        },
        {
          header: 'Custo Médio Unit. (R$)',
          key: 'costPrice',
          formatter: (v) => (Number(v) > 0 ? Number(v).toFixed(2) : 'Não informado'),
        },
        {
          header: 'Custo Total Estimado (R$)',
          key: 'estimatedCostTotal',
          formatter: (v) => (Number(v) > 0 ? Number(v).toFixed(2) : '-'),
        },
      ],
      data: products,
    })
  }

  const activeBranchName =
    filters.branchId === 'all'
      ? 'Todas as Filiais'
      : availableBranches.find((b) => b.id === filters.branchId)?.name || activeBranch?.name || 'Filial'

  const userDisplayName = profile?.full_name || user?.email || 'Usuário Autenticado'

  return (
    <div className="space-y-6">
      {/* ─── CABEÇALHO INSTITUCIONAL DE IMPRESSÃO ─── */}
      <ReportPrintHeader
        title="Ranking de Produtos & Curva ABC"
        subtitle="Relação de itens com maior giro, faturamento bruto e valoração de saída"
        company={activeCompany}
        branch={activeBranch}
        userName={userDisplayName}
        filtersSummary={{
          Filial: activeBranchName,
          Período: `${new Date(filters.dateFrom).toLocaleDateString('pt-BR')} até ${new Date(filters.dateTo).toLocaleDateString('pt-BR')}`,
        }}
      />

      {/* Header na Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Produtos Mais Vendidos & Curva ABC
            </h1>
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
              Ranking de Saídas
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Giro de produtos faturados em vendas válidas e comparativo de receita gerada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={products.length === 0}
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
          onRefresh={() => loadData(true)}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Cards de Resumo da Tela */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 print:hidden">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total de Itens Vendidos</p>
          <p className="text-xl font-bold text-white font-mono mt-1">
            {totalSoldQty.toLocaleString('pt-BR')} unidades
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Volume acumulado no período</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Receita Total de Produtos</p>
          <p className="text-xl font-bold text-emerald-400 font-mono mt-1">
            R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Soma faturada nos itens</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Mix de Produtos Ativos</p>
          <p className="text-xl font-bold text-purple-400 font-mono mt-1">
            {products.length} produtos
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Com saídas faturadas</p>
        </div>
      </div>

      {/* Tabela de Ranking */}
      {isLoading ? (
        <LoadingState message="Calculando ranking de produtos..." />
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
          Nenhum produto faturado no período selecionado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-800/50 text-[11px] font-semibold text-slate-400 uppercase">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4 text-center">Unidade</th>
                  <th className="py-3 px-4 text-right">Qtd Vendida</th>
                  <th className="py-3 px-4 text-right">Faturamento Total</th>
                  <th className="py-3 px-4 text-right">Custo Unitário</th>
                  <th className="py-3 px-4 text-right">Custo Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-normal text-slate-300">
                {products.map((item, index) => (
                  <tr key={item.productId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-500">
                      {index + 1}º
                    </td>
                    <td className="py-3 px-4 font-medium text-white">{item.productName}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{item.sku}</td>
                    <td className="py-3 px-4 text-center text-slate-400">{item.unit}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                      {item.quantitySold.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      R$ {item.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {item.hasValidCost ? (
                        `R$ ${item.costPrice.toFixed(2)}`
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] text-amber-400"
                          title="Sem custo cadastrado"
                        >
                          <AlertCircle className="h-3 w-3" /> N/I
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      {item.hasValidCost ? (
                        `R$ ${item.estimatedCostTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-700 bg-slate-850 font-bold text-xs">
                <tr className="print-totals-row">
                  <td colSpan={4} className="py-3 px-4 text-right uppercase text-slate-300">
                    Totais Consolidados ({products.length} itens):
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                    {totalSoldQty.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-white text-sm">
                    R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Rodapé Padronizado de Impressão */}
      <ReportPrintFooter />
    </div>
  )
}
