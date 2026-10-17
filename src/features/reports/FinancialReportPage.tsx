import { useState, useEffect, useCallback } from 'react'
import {
  FileSpreadsheet,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { reportService } from '@/lib/services/report.service'
import type { ReportFilterState, FinancialReportData } from '@/types/report'
import { ReportFilterBar } from './components/ReportFilterBar'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { exportToExcel, triggerPrint } from '@/lib/utils/report-export'

export function FinancialReportPage() {
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

  const [financialData, setFinancialData] = useState<FinancialReportData | null>(null)
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
        const data = await reportService.getFinancialReport(filters)
        setFinancialData(data)
      } catch (err) {
        console.error('Erro ao carregar Relatório Financeiro:', err)
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

  function handleExportExcel() {
    if (!financialData) return
    exportToExcel({
      filename: `relatorio_financeiro_${filters.dateFrom}_a_${filters.dateTo}`,
      title: 'Relatório Financeiro Consolidado - ERP MundoMix',
      filters: {
        Empresa: activeCompany?.trade_name || 'Matriz',
        Período: `${filters.dateFrom} até ${filters.dateTo}`,
      },
      columns: [
        { header: 'Natureza / Indicador', key: 'indicator' },
        { header: 'Valor (R$)', key: 'amount' },
        { header: 'Status Financeiro', key: 'type' },
      ],
      data: [
        {
          indicator: 'Recebimentos Efetivos no Período',
          amount: financialData.summary.effectiveReceivedPeriod.toFixed(2),
          type: 'Realizado (Entrada em Conta/Caixa)',
        },
        {
          indicator: 'Pagamentos Efetivos no Período',
          amount: financialData.summary.effectivePaidPeriod.toFixed(2),
          type: 'Realizado (Saída)',
        },
        {
          indicator: 'Títulos a Receber em Aberto',
          amount: financialData.summary.openReceivablesTotal.toFixed(2),
          type: 'Previsto a Receber',
        },
        {
          indicator: 'Títulos a Receber Vencidos',
          amount: financialData.summary.overdueReceivablesTotal.toFixed(2),
          type: 'Em Atraso / Cobrança',
        },
        {
          indicator: 'Despesas a Pagar em Aberto',
          amount: financialData.summary.openPayablesTotal.toFixed(2),
          type: 'Previsto a Pagar',
        },
        {
          indicator: 'Despesas a Pagar Vencidas',
          amount: financialData.summary.overduePayablesTotal.toFixed(2),
          type: 'Vencido a Regularizar',
        },
      ],
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Relatório Financeiro</h1>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              Previsto vs Realizado
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Liquidações de títulos, vencimentos futuros, conciliação e auditoria de caixas (sobras/faltas).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={!financialData}
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

      {isLoading ? (
        <LoadingState message="Apurando conciliações financeiras e histórico de caixas..." />
      ) : !financialData ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
          Nenhum dado financeiro disponível.
        </div>
      ) : (
        <>
          {/* Cards de Previsto vs Realizado */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400">Recebido Efetivamente</span>
                <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-xl font-bold text-white font-mono mt-2">
                R$ {financialData.summary.effectiveReceivedPeriod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-emerald-300/80 mt-1">Liquidações de contas no período</p>
            </div>

            <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-400">Pago Efetivamente</span>
                <ArrowUpRight className="h-4 w-4 text-rose-400" />
              </div>
              <p className="text-xl font-bold text-white font-mono mt-2">
                R$ {financialData.summary.effectivePaidPeriod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-rose-300/80 mt-1">Despesas e fornecedores quitados</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400">A Receber em Aberto</span>
              <p className="text-xl font-bold text-slate-200 font-mono mt-2">
                R$ {financialData.summary.openReceivablesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-amber-400 mt-1">
                Vencido: R$ {financialData.summary.overdueReceivablesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400">A Pagar em Aberto</span>
              <p className="text-xl font-bold text-slate-200 font-mono mt-2">
                R$ {financialData.summary.openPayablesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-rose-400 mt-1">
                Vencido: R$ {financialData.summary.overduePayablesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Histórico de Fechamento de Caixas & Sobras/Faltas */}
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base text-white">Auditoria de Fechamentos de Caixa</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Conferência de gaveta, valores apurados e registro de sobras (+) ou faltas (-).
                </CardDescription>
              </div>
              <Wallet className="h-5 w-5 text-blue-400" />
            </CardHeader>
            <CardContent>
              {financialData.cashSessionsHistory.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  Nenhuma sessão de caixa registrada.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 bg-slate-800/40 text-[11px] font-semibold text-slate-400 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Terminal</th>
                        <th className="py-2.5 px-3">Operador</th>
                        <th className="py-2.5 px-3">Abertura</th>
                        <th className="py-2.5 px-3">Fechamento</th>
                        <th className="py-2.5 px-3 text-right">Esp. em Dinheiro</th>
                        <th className="py-2.5 px-3 text-right">Contado</th>
                        <th className="py-2.5 px-3 text-right">Diferença</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-normal text-slate-300">
                      {financialData.cashSessionsHistory.map((cs) => {
                        const diff = cs.differenceCash
                        const hasDiff = diff !== null && diff !== 0
                        const isSurplus = diff !== null && diff > 0

                        return (
                          <tr key={cs.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-2.5 px-3 font-medium text-white">{cs.terminalName}</td>
                            <td className="py-2.5 px-3 text-slate-300">{cs.openedByName}</td>
                            <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                              {new Date(cs.openedAt).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                              {cs.closedAt ? new Date(cs.closedAt).toLocaleString('pt-BR') : 'Em Aberto'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {cs.expectedCash !== null
                                ? `R$ ${cs.expectedCash.toFixed(2)}`
                                : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium text-white">
                              {cs.countedCash !== null
                                ? `R$ ${cs.countedCash.toFixed(2)}`
                                : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              {diff !== null ? (
                                <span
                                  className={
                                    !hasDiff
                                      ? 'text-emerald-400'
                                      : isSurplus
                                      ? 'text-cyan-400'
                                      : 'text-rose-400'
                                  }
                                >
                                  {diff > 0 ? `+R$ ${diff.toFixed(2)} (Sobra)` : diff < 0 ? `-R$ ${Math.abs(diff).toFixed(2)} (Falta)` : 'R$ 0,00'}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {cs.status === 'open' ? (
                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                                  Aberto
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px]">
                                  Fechado
                                </Badge>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
