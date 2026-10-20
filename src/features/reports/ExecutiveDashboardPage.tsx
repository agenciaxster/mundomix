import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Package,
  AlertTriangle,
  Printer,
  FileSpreadsheet,
  Percent,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { reportService } from '@/lib/services/report.service'
import { payableService } from '@/lib/services/payable.service'
import { receivableService } from '@/lib/services/receivable.service'
import { toast } from '@/hooks/useToast'
import type { ReportFilterState, ExecutiveDashboardData } from '@/types/report'
import { ReportFilterBar } from './components/ReportFilterBar'
import { ReportPrintHeader } from './components/ReportPrintHeader'
import { ReportPrintFooter } from './components/ReportPrintFooter'
import { StatCard } from '@/components/shared/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/shared/LoadingState'
import { exportToExcel, triggerPrint } from '@/lib/utils/report-export'

export function ExecutiveDashboardPage() {
  const navigate = useNavigate()
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

  const [dashboardData, setDashboardData] = useState<ExecutiveDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Atualiza companyId se mudar no useAuth
  useEffect(() => {
    if (activeCompany?.id && activeCompany.id !== filters.companyId) {
      setFilters((prev) => ({ ...prev, companyId: activeCompany.id }))
    }
  }, [activeCompany?.id])

  const loadDashboard = useCallback(
    async (refresh = false) => {
      if (!filters.companyId) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const data = await reportService.getExecutiveDashboard(filters)
        setDashboardData(data)
      } catch (err) {
        console.error('Erro ao carregar Dashboard Executivo:', err)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [filters]
  )

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Escuta atualizações no módulo financeiro (exclusão, cadastro, baixa) e foco da janela
  useEffect(() => {
    function handleFinancialUpdate() {
      loadDashboard(true)
    }

    window.addEventListener('financial-records-changed', handleFinancialUpdate)
    window.addEventListener('focus', handleFinancialUpdate)

    return () => {
      window.removeEventListener('financial-records-changed', handleFinancialUpdate)
      window.removeEventListener('focus', handleFinancialUpdate)
    }
  }, [loadDashboard])

  async function handleDeleteReceivableFromDashboard(id: string, customer: string, doc: string) {
    if (!filters.companyId) return
    const confirmDelete = window.confirm(
      `Deseja realmente excluir permanentemente do banco de dados o título a receber de "${customer}" (Doc: ${doc})?\n\nEsta ação removerá todas as parcelas vinculadas e não pode ser desfeita.`
    )
    if (!confirmDelete) return

    try {
      await receivableService.deleteReceivable(filters.companyId, id)
      toast.success('Título a receber excluído com sucesso do banco de dados!')
      await loadDashboard(true)
    } catch (err: any) {
      console.error('Erro ao excluir conta a receber:', err)
      toast.error(err.message || 'Falha ao excluir título a receber.')
    }
  }

  async function handleDeletePayableFromDashboard(id: string, supplier: string, category: string) {
    if (!filters.companyId) return
    const confirmDelete = window.confirm(
      `Deseja realmente excluir permanentemente do banco de dados a conta a pagar "${supplier} - ${category}"?\n\nEsta ação removerá todas as parcelas vinculadas e não pode ser desfeita.`
    )
    if (!confirmDelete) return

    try {
      await payableService.deletePayable(filters.companyId, id)
      toast.success('Conta a pagar excluída com sucesso do banco de dados!')
      await loadDashboard(true)
    } catch (err: any) {
      console.error('Erro ao excluir conta a pagar:', err)
      toast.error(err.message || 'Falha ao excluir conta a pagar.')
    }
  }

  function handleExportExcel() {
    if (!dashboardData) return
    const branchName =
      filters.branchId === 'all'
        ? 'Todas as Filiais'
        : availableBranches.find((b) => b.id === filters.branchId)?.name || 'Filial'

    exportToExcel({
      filename: `dashboard_executivo_${filters.dateFrom}_a_${filters.dateTo}`,
      title: 'Dashboard Executivo Consolidado - ERP MundoMix',
      filters: {
        Empresa: activeCompany?.trade_name || 'Matriz',
        Filial: branchName,
        Período: `${filters.dateFrom} até ${filters.dateTo}`,
      },
      columns: [
        { header: 'Indicador', key: 'indicator' },
        { header: 'Valor', key: 'value' },
        { header: 'Observação Técnica', key: 'notes' },
      ],
      data: [
        {
          indicator: 'Faturamento Líquido (Vendas Válidas)',
          value: `R$ ${dashboardData.salesSummary.netTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          notes: 'Exclui cancelamentos e devoluções',
        },
        {
          indicator: 'Faturamento Bruto',
          value: `R$ ${dashboardData.salesSummary.grossTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          notes: 'Soma total dos subitens faturados',
        },
        {
          indicator: 'Descontos Concedidos',
          value: `R$ ${dashboardData.salesSummary.discountTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          notes: 'Descontos de balcão e itens',
        },
        {
          indicator: 'Quantidade de Vendas Concluídas',
          value: dashboardData.salesSummary.completedCount,
          notes: 'Cupons e pedidos efetivados',
        },
        {
          indicator: 'Ticket Médio',
          value: `R$ ${dashboardData.salesSummary.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          notes: 'Faturamento líquido / Quantidade de vendas',
        },
        {
          indicator: 'Vendas Canceladas (Total)',
          value: `R$ ${dashboardData.salesSummary.cancelledTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          notes: `${dashboardData.salesSummary.cancelledCount} pedido(s) cancelado(s)`,
        },
        {
          indicator: 'Recebimentos Efetivos no Período',
          value: `R$ ${dashboardData.financialSummary.receivablesPaidPeriod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          notes: 'Liquidações de títulos a receber',
        },
        {
          indicator: 'Pagamentos Efetivos no Período',
          value: `R$ ${dashboardData.financialSummary.payablesPaidPeriod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          notes: 'Despesas e fornecedores pagos',
        },
      ],
    })
  }

  const branchName =
    filters.branchId === 'all'
      ? 'Todas as Filiais'
      : availableBranches.find((b) => b.id === filters.branchId)?.name || 'Filial'
  const currentBranch = availableBranches.find((b) => b.id === filters.branchId) || activeBranch

  return (
    <div className="space-y-6">
      {/* Cabeçalho Institucional de Impressão */}
      <ReportPrintHeader
        title="Relatório Gerencial - Dashboard Executivo"
        subtitle="Consolidação de Faturamento, Operações e Finanças"
        company={activeCompany}
        branch={filters.branchId === 'all' ? null : currentBranch}
        filtersSummary={{
          Filial: branchName,
          Período: `${filters.dateFrom.split('-').reverse().join('/')} a ${filters.dateTo.split('-').reverse().join('/')}`,
        }}
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Dashboard Executivo & Relatórios Gerenciais
            </h1>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              Dados em Tempo Real
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Indicadores consolidados de vendas, faturamento líquido, financeiro e alertas críticos.
          </p>
        </div>

        {/* Botões de Ação: Exportação e Impressão */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={!dashboardData || isLoading}
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
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Barra de Filtros Unificada */}
      <div className="no-print">
        <ReportFilterBar
          filters={filters}
          onChange={setFilters}
          branches={availableBranches}
          onRefresh={() => loadDashboard(true)}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Tabela Resumo Exclusiva para Documento de Impressão */}
      {dashboardData && (
        <div className="hidden print:block space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide border-b pb-1 text-slate-800">
            Resumo Consolidado de Indicadores
          </h2>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-slate-100">
                <th className="py-2 px-3 font-semibold text-slate-700">Indicador Gerencial</th>
                <th className="py-2 px-3 text-right font-semibold text-slate-700">Valor / Volume</th>
                <th className="py-2 px-3 font-semibold text-slate-700">Observações Técnicas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-1.5 px-3 font-medium">Faturamento Líquido (Vendas Válidas)</td>
                <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                  R$ {dashboardData.salesSummary.netTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-3 text-slate-600">Exclui pedidos cancelados e estornados</td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 font-medium">Faturamento Bruto Total</td>
                <td className="py-1.5 px-3 text-right font-mono text-slate-800">
                  R$ {dashboardData.salesSummary.grossTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-3 text-slate-600">Soma dos valores integrais faturados</td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 font-medium">Descontos Concedidos no Período</td>
                <td className="py-1.5 px-3 text-right font-mono text-slate-800">
                  R$ {dashboardData.salesSummary.discountTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-3 text-slate-600">Descontos comerciais aplicados em balcão/pedidos</td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 font-medium">Quantidade de Vendas Concluídas</td>
                <td className="py-1.5 px-3 text-right font-mono text-slate-800">
                  {dashboardData.salesSummary.completedCount} pedido(s)
                </td>
                <td className="py-1.5 px-3 text-slate-600">Cupons e transações com status finalizado</td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 font-medium">Ticket Médio por Venda</td>
                <td className="py-1.5 px-3 text-right font-mono text-slate-800">
                  R$ {dashboardData.salesSummary.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-3 text-slate-600">Média líquida apurada por atendimento</td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 font-medium">Vendas Canceladas</td>
                <td className="py-1.5 px-3 text-right font-mono text-rose-700">
                  R$ {dashboardData.salesSummary.cancelledTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-3 text-slate-600">{dashboardData.salesSummary.cancelledCount} pedido(s) cancelado(s)</td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 font-medium">Recebimentos Efetivados no Período</td>
                <td className="py-1.5 px-3 text-right font-mono text-emerald-700 font-bold">
                  R$ {dashboardData.financialSummary.receivablesPaidPeriod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-3 text-slate-600">Liquidações de títulos a receber</td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 font-medium">Pagamentos Efetivados no Período</td>
                <td className="py-1.5 px-3 text-right font-mono text-rose-700 font-bold">
                  R$ {dashboardData.financialSummary.payablesPaidPeriod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-3 text-slate-600">Liquidações de despesas e contas a pagar</td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 font-medium">Inadimplência (Títulos a Receber Vencidos)</td>
                <td className="py-1.5 px-3 text-right font-mono text-amber-700 font-bold">
                  R$ {dashboardData.financialSummary.receivablesOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-3 text-slate-600">{dashboardData.criticalAlerts.overdueReceivablesCount} título(s) em atraso</td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 font-medium">Obrigações Vencidas (Contas a Pagar em Atraso)</td>
                <td className="py-1.5 px-3 text-right font-mono text-rose-700 font-bold">
                  R$ {dashboardData.financialSummary.payablesOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-3 text-slate-600">{dashboardData.criticalAlerts.overduePayablesCount} conta(s) a regularizar</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {isLoading ? (
        <LoadingState message="Consolidando dados gerenciais no banco de dados..." />
      ) : !dashboardData ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
          Nenhum dado encontrado para os filtros selecionados.
        </div>
      ) : (
        <>
          {/* Alertas Críticos de Vencimento e Estoque */}
          {(dashboardData.criticalAlerts.lowStockCount > 0 ||
            dashboardData.criticalAlerts.zeroStockCount > 0 ||
            dashboardData.criticalAlerts.overdueReceivablesCount > 0 ||
            dashboardData.criticalAlerts.overduePayablesCount > 0) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {dashboardData.criticalAlerts.overdueReceivablesCount > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-200">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
                  <div className="text-xs">
                    <p className="font-semibold">
                      {dashboardData.criticalAlerts.overdueReceivablesCount} Título(s) a Receber Vencido(s)
                    </p>
                    <p className="text-[11px] text-amber-300/80">
                      R$ {dashboardData.financialSummary.receivablesOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em atraso
                    </p>
                  </div>
                </div>
              )}

              {dashboardData.criticalAlerts.overduePayablesCount > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-200">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
                  <div className="text-xs">
                    <p className="font-semibold">
                      {dashboardData.criticalAlerts.overduePayablesCount} Conta(s) a Pagar Vencida(s)
                    </p>
                    <p className="text-[11px] text-rose-300/80">
                      R$ {dashboardData.financialSummary.payablesOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a regularizar
                    </p>
                  </div>
                </div>
              )}

              {dashboardData.criticalAlerts.lowStockCount > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3.5 text-yellow-200">
                  <Package className="h-5 w-5 shrink-0 text-yellow-400" />
                  <div className="text-xs">
                    <p className="font-semibold">
                      {dashboardData.criticalAlerts.lowStockCount} Produto(s) com Estoque Baixo
                    </p>
                    <p className="text-[11px] text-yellow-300/80">Abaixo do estoque mínimo de reposição</p>
                  </div>
                </div>
              )}

              {dashboardData.criticalAlerts.zeroStockCount > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-red-200">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
                  <div className="text-xs">
                    <p className="font-semibold">
                      {dashboardData.criticalAlerts.zeroStockCount} Produto(s) com Estoque Zerado
                    </p>
                    <p className="text-[11px] text-red-300/80">Necessita de reposição urgente</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cards Principais: Vendas, Faturamento Líquido, Ticket Médio e Descontos */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Faturamento Líquido"
              value={`R$ ${dashboardData.salesSummary.netTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              description={`Bruto: R$ ${dashboardData.salesSummary.grossTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={DollarSign}
            />

            <StatCard
              title="Quantidade de Vendas"
              value={dashboardData.salesSummary.completedCount}
              description={
                dashboardData.salesSummary.cancelledCount > 0
                  ? `${dashboardData.salesSummary.cancelledCount} venda(s) cancelada(s)`
                  : 'Nenhum cancelamento no período'
              }
              icon={ShoppingCart}
            />

            <StatCard
              title="Ticket Médio"
              value={`R$ ${dashboardData.salesSummary.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              description="Média líquida por venda faturada"
              icon={TrendingUp}
            />

            <StatCard
              title="Descontos Concedidos"
              value={`R$ ${dashboardData.salesSummary.discountTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              description={
                dashboardData.comparisonPreviousPeriod.growthPercentage !== 0
                  ? `${dashboardData.comparisonPreviousPeriod.growthPercentage > 0 ? '+' : ''}${dashboardData.comparisonPreviousPeriod.growthPercentage}% vs período anterior`
                  : 'Comparativo de vendas'
              }
              icon={Percent}
            />
          </div>

          {/* Gráfico / Tabela de Evolução das Vendas e Distribuição de Meios de Pagamento */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Linha do Tempo de Vendas */}
            <Card className="lg:col-span-2 border-slate-800 bg-slate-900/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">Evolução Diária de Vendas</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Acompanhamento cronológico do faturamento líquido e volume de pedidos no período.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData.salesEvolutionTimeline.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">
                    Nenhuma venda registrada no intervalo selecionado.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* Barra visual simples e responsiva */}
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                      {dashboardData.salesEvolutionTimeline.map((item) => {
                        const maxNet = Math.max(
                          ...dashboardData.salesEvolutionTimeline.map((t) => t.netTotal),
                          1
                        )
                        const barWidth = Math.min(100, Math.round((item.netTotal / maxNet) * 100))

                        return (
                          <div key={item.date} className="flex items-center gap-3 text-xs">
                            <span className="w-14 shrink-0 font-mono text-slate-400">
                              {item.label}
                            </span>
                            <div className="h-6 flex-1 rounded-lg bg-slate-800/80 p-0.5">
                              <div
                                className="h-full rounded-md bg-emerald-500/30 border border-emerald-500/40 transition-all flex items-center px-2"
                                style={{ width: `${Math.max(barWidth, 8)}%` }}
                              >
                                <span className="text-[10px] font-semibold text-emerald-300">
                                  R$ {item.netTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                            <span className="w-16 text-right text-[11px] text-slate-400 font-mono">
                              {item.salesCount} ped.
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Distribuição por Forma de Pagamento */}
            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">Meios de Pagamento</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Participação percentual por forma de recebimento.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData.salesByPaymentMethod.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">Sem registros de pagamentos.</p>
                ) : (
                  <div className="space-y-3">
                    {dashboardData.salesByPaymentMethod.map((m) => (
                      <div key={m.paymentMethod} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-300">{m.paymentMethodLabel}</span>
                          <span className="font-mono text-slate-200">
                            R$ {m.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{' '}
                            <span className="text-emerald-400">({m.percentage}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${m.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Resumo Financeiro: Contas a Receber vs Contas a Pagar (Totalmente Integrado) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Contas a Receber */}
            <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base text-white">Contas a Receber</CardTitle>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                      Crediário & Títulos
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-400 mt-0.5">
                    Visão integrada dos recebimentos e cobranças de clientes
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/financeiro/contas-receber')}
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs h-8"
                >
                  Abrir Módulo
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-800/40 p-3 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Recebido</span>
                    <p className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                      R$ {dashboardData.financialSummary.receivablesPaidPeriod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Em Aberto</span>
                    <p className="text-sm font-bold text-slate-200 font-mono mt-0.5">
                      R$ {dashboardData.financialSummary.receivablesOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Vencidos</span>
                    <p className="text-sm font-bold text-rose-400 font-mono mt-0.5">
                      R$ {dashboardData.financialSummary.receivablesOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Tabela de Contas a Receber Pendentes para Ação Rápida */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">
                      Títulos a Receber Pendentes
                    </span>
                    <Link
                      to="/financeiro/contas-receber"
                      className="text-[11px] text-emerald-400 hover:underline"
                    >
                      Ver todas
                    </Link>
                  </div>

                  {dashboardData.pendingReceivables.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-center text-xs text-slate-500">
                      Nenhum título a receber pendente no momento.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-500 bg-slate-900/50">
                          <tr>
                            <th className="py-2 px-3">Cliente</th>
                            <th className="py-2 px-3">Doc</th>
                            <th className="py-2 px-3 text-right">Saldo</th>
                            <th className="py-2 px-3 text-center">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {dashboardData.pendingReceivables.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-800/30">
                              <td className="py-2 px-3 font-medium text-white truncate max-w-[130px]">
                                {r.customerName}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">
                                {r.documentNumber}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-white">
                                <span className={r.isOverdue ? 'text-rose-400' : 'text-emerald-400'}>
                                  R$ {r.balanceAmount.toFixed(2)}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => navigate('/financeiro/contas-receber')}
                                    className="h-6 px-2 text-[10px] text-emerald-400 hover:text-white hover:bg-emerald-600/20"
                                    title="Receber no módulo"
                                  >
                                    Receber
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteReceivableFromDashboard(r.id, r.customerName, r.documentNumber)}
                                    className="h-6 w-6 p-0 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                                    title="Excluir do banco e do card"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Contas a Pagar */}
            <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base text-white">Contas a Pagar</CardTitle>
                    <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px]">
                      Despesas & Fornecedores
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-400 mt-0.5">
                    Visão integrada dos compromissos e despesas da empresa
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/financeiro/contas-pagar')}
                  className="border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs h-8"
                >
                  Abrir Módulo
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-800/40 p-3 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Pago</span>
                    <p className="text-sm font-bold text-rose-400 font-mono mt-0.5">
                      R$ {dashboardData.financialSummary.payablesPaidPeriod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Em Aberto</span>
                    <p className="text-sm font-bold text-slate-200 font-mono mt-0.5">
                      R$ {dashboardData.financialSummary.payablesOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Vencidas</span>
                    <p className="text-sm font-bold text-rose-500 font-mono mt-0.5">
                      R$ {dashboardData.financialSummary.payablesOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Tabela de Contas a Pagar Próximas ou Vencidas para Pagamento Rápido */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">
                      Contas Próximas do Vencimento / Em Atraso
                    </span>
                    <Link
                      to="/financeiro/contas-pagar"
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      Ver todas
                    </Link>
                  </div>

                  {dashboardData.upcomingPayables.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-center text-xs text-slate-500">
                      Nenhuma conta a pagar pendente.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-500 bg-slate-900/50">
                          <tr>
                            <th className="py-2 px-3">Fornecedor / Categoria</th>
                            <th className="py-2 px-3">Vencimento</th>
                            <th className="py-2 px-3 text-right">Saldo</th>
                            <th className="py-2 px-3 text-center">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {dashboardData.upcomingPayables.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-800/30">
                              <td className="py-2 px-3 font-medium text-white truncate max-w-[130px]">
                                <p className="truncate">{p.supplierName}</p>
                                <span className="text-[10px] text-slate-400">{p.categoryName}</span>
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px]">
                                <span
                                  className={
                                    p.isOverdue
                                      ? 'text-rose-400 font-bold'
                                      : 'text-slate-300'
                                  }
                                >
                                  {p.dueDate.split('-').reverse().slice(0, 2).join('/')}
                                  {p.isOverdue && ' (Vencida)'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-white">
                                R$ {p.balanceAmount.toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => navigate('/financeiro/contas-pagar')}
                                    className="h-6 px-2 text-[10px] text-rose-400 hover:text-white hover:bg-rose-600/20"
                                    title="Pagar no módulo"
                                  >
                                    Pagar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeletePayableFromDashboard(p.id, p.supplierName, p.categoryName)}
                                    className="h-6 w-6 p-0 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                                    title="Excluir do banco e do card"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rodapé documental impresso */}
          <ReportPrintFooter />
        </>
      )}
    </div>
  )
}

