import { useState, useEffect, useCallback } from 'react'
import {
  FileSpreadsheet,
  Printer,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { reportService } from '@/lib/services/report.service'
import type { ReportFilterState, SellerPerformanceItem } from '@/types/report'
import { ReportFilterBar } from './components/ReportFilterBar'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { exportToExcel, triggerPrint } from '@/lib/utils/report-export'

export function SellersPerformancePage() {
  const { activeCompany, companies, activeBranch } = useAuth()

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

  const [sellers, setSellers] = useState<SellerPerformanceItem[]>([])
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
        const data = await reportService.getSellersPerformanceReport(filters)
        setSellers(data)
      } catch (err) {
        console.error('Erro ao carregar Desempenho dos Vendedores:', err)
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

  const totalSold = sellers.reduce((acc, curr) => acc + curr.netTotal, 0)
  const totalSalesCount = sellers.reduce((acc, curr) => acc + curr.salesCount, 0)

  function handleExportExcel() {
    exportToExcel({
      filename: `desempenho_vendedores_${filters.dateFrom}_a_${filters.dateTo}`,
      title: 'Desempenho da Equipe Comercial e Operadores - ERP MundoMix',
      filters: {
        Empresa: activeCompany?.trade_name || 'Matriz',
        Período: `${filters.dateFrom} até ${filters.dateTo}`,
      },
      columns: [
        { header: 'Vendedor / Operador', key: 'userName' },
        { header: 'E-mail', key: 'userEmail' },
        { header: 'Filial Principal', key: 'branchName' },
        { header: 'Qtd Vendas', key: 'salesCount' },
        {
          header: 'Faturamento Bruto (R$)',
          key: 'grossTotal',
          formatter: (v) => Number(v).toFixed(2),
        },
        {
          header: 'Descontos Concedidos (R$)',
          key: 'discountTotal',
          formatter: (v) => Number(v).toFixed(2),
        },
        {
          header: 'Faturamento Líquido (R$)',
          key: 'netTotal',
          formatter: (v) => Number(v).toFixed(2),
        },
        {
          header: 'Ticket Médio (R$)',
          key: 'averageTicket',
          formatter: (v) => Number(v).toFixed(2),
        },
      ],
      data: sellers,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Desempenho dos Vendedores & Filiais
            </h1>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
              Performance Comercial
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Volume de vendas faturadas, faturamento líquido, descontos concedidos e ticket médio por operador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={sellers.length === 0}
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

      {/* Filtros */}
      <ReportFilterBar
        filters={filters}
        onChange={setFilters}
        branches={availableBranches}
        onRefresh={() => loadData(true)}
        isRefreshing={isRefreshing}
      />

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total Faturado pela Equipe</p>
          <p className="text-xl font-bold text-emerald-400 font-mono mt-1">
            R$ {totalSold.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Valor líquido das vendas concluídas</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total de Pedidos Faturados</p>
          <p className="text-xl font-bold text-white font-mono mt-1">
            {totalSalesCount} pedido(s)
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Emitidos por operadores autenticados</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Vendedores Ativos no Período</p>
          <p className="text-xl font-bold text-amber-400 font-mono mt-1">
            {sellers.length} vendedor(es)
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Com pelo menos 1 venda registrada</p>
        </div>
      </div>

      {/* Tabela de Desempenho */}
      {isLoading ? (
        <LoadingState message="Apurando métricas de performance comercial..." />
      ) : sellers.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
          Nenhuma venda atribuída a vendedores no período selecionado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-800/50 text-[11px] font-semibold text-slate-400 uppercase">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Vendedor / Operador</th>
                  <th className="py-3 px-4">Filial Principal</th>
                  <th className="py-3 px-4 text-center">Qtd Vendas</th>
                  <th className="py-3 px-4 text-right">Faturamento Bruto</th>
                  <th className="py-3 px-4 text-right">Descontos</th>
                  <th className="py-3 px-4 text-right">Faturamento Líquido</th>
                  <th className="py-3 px-4 text-right">Ticket Médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-normal text-slate-300">
                {sellers.map((s, index) => (
                  <tr key={s.userId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-500">
                      {index + 1}º
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-white">{s.userName}</p>
                      {s.userEmail && <p className="text-[11px] text-slate-400">{s.userEmail}</p>}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{s.branchName}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                      {s.salesCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      R$ {s.grossTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-400">
                      R$ {s.discountTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      R$ {s.netTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-cyan-400">
                      R$ {s.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
