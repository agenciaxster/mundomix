import { useState, useEffect, useCallback } from 'react'
import {
  FileSpreadsheet,
  Printer,
  Building2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Search,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { reportService } from '@/lib/services/report.service'
import type { StockReportItem } from '@/types/report'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { exportToExcel, triggerPrint } from '@/lib/utils/report-export'
import { ReportPrintHeader } from './components/ReportPrintHeader'
import { ReportPrintFooter } from './components/ReportPrintFooter'

export function StockReportPage() {
  const { activeCompany, companies, activeBranch, profile, user } = useAuth()

  const currentCompanyData = companies.find((c) => c.company.id === activeCompany?.id)
  const availableBranches = currentCompanyData?.branches || []

  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || 'all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'zero'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const [stockItems, setStockItems] = useState<StockReportItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadData = useCallback(
    async (refresh = false) => {
      if (!activeCompany?.id) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const data = await reportService.getStockReport({
          companyId: activeCompany.id,
          branchId: selectedBranchId,
          statusFilter,
        })
        setStockItems(data)
      } catch (err) {
        console.error('Erro ao carregar Relatório de Estoque:', err)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [activeCompany?.id, selectedBranchId, statusFilter]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filtro de busca local
  const filteredItems = stockItems.filter((item) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      item.productName.toLowerCase().includes(term) ||
      item.sku.toLowerCase().includes(term) ||
      item.barcode.toLowerCase().includes(term)
    )
  })

  // Totais
  const totalPhysicalQty = filteredItems.reduce((acc, curr) => acc + curr.quantity, 0)
  const totalAvailableQty = filteredItems.reduce((acc, curr) => acc + curr.availableQuantity, 0)
  const totalEstimatedCost = filteredItems.reduce((acc, curr) => acc + curr.estimatedStockValue, 0)
  const itemsWithoutCostCount = filteredItems.filter((i) => !i.hasValidCost).length

  function handleExportExcel() {
    const branchName =
      selectedBranchId === 'all'
        ? 'Todas as Filiais'
        : availableBranches.find((b) => b.id === selectedBranchId)?.name || 'Filial'

    exportToExcel({
      filename: `posicao_estoque_${new Date().toISOString().split('T')[0]}`,
      title: 'Posição e Valoração de Estoque - ERP MundoMix',
      filters: {
        Empresa: activeCompany?.trade_name || 'Matriz',
        Filial: branchName,
        FiltroStatus:
          statusFilter === 'all'
            ? 'Todos'
            : statusFilter === 'low'
            ? 'Abaixo do Mínimo'
            : 'Estoque Zerado',
      },
      columns: [
        { header: 'Produto', key: 'productName' },
        { header: 'SKU', key: 'sku' },
        { header: 'Cód. Barras', key: 'barcode' },
        { header: 'Filial', key: 'branchName' },
        { header: 'Unidade', key: 'unit' },
        { header: 'Qtd Física', key: 'quantity' },
        { header: 'Qtd Reservada', key: 'reservedQuantity' },
        { header: 'Qtd Disponível', key: 'availableQuantity' },
        { header: 'Estoque Mínimo', key: 'minStock' },
        {
          header: 'Custo Unitário (R$)',
          key: 'costPrice',
          formatter: (v) => (Number(v) > 0 ? Number(v).toFixed(2) : 'Não informado'),
        },
        {
          header: 'Valor Total Estimado (R$)',
          key: 'estimatedStockValue',
          formatter: (v) => Number(v).toFixed(2),
        },
      ],
      data: filteredItems,
    })
  }

  const activeBranchName =
    selectedBranchId === 'all'
      ? 'Todas as Filiais'
      : availableBranches.find((b) => b.id === selectedBranchId)?.name || activeBranch?.name || 'Filial'

  const userDisplayName = profile?.full_name || user?.email || 'Usuário Autenticado'

  return (
    <div className="space-y-6">
      {/* ─── CABEÇALHO INSTITUCIONAL DE IMPRESSÃO ─── */}
      <ReportPrintHeader
        title="Posição & Valoração de Estoque"
        subtitle="Saldos físicos, disponíveis, estoque mínimo e valoração estimada a custo"
        company={activeCompany}
        branch={activeBranch}
        userName={userDisplayName}
        filtersSummary={{
          Filial: activeBranchName,
          'Nível de Estoque':
            statusFilter === 'all' ? 'Todos' : statusFilter === 'low' ? 'Abaixo do Mínimo' : 'Estoque Zerado',
          Busca: searchTerm ? `"${searchTerm}"` : undefined,
        }}
      />

      {/* Header na Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Relatório de Estoque</h1>
            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
              Posição & Valoração
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Saldos físicos, disponíveis, produtos abaixo do estoque mínimo e valoração estimada de custo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={filteredItems.length === 0}
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

      {/* Controles de Filtros */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl print:hidden">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {/* Busca por Nome/SKU */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-400">Buscar Produto</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <Input
                type="text"
                placeholder="Nome, SKU ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 text-xs bg-slate-800/80 border-slate-700 text-white h-9"
              />
            </div>
          </div>

          {/* Seletor de Filial */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-400">Filial</label>
            <div className="relative">
              <Building2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-8 pr-2.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="all">Todas as Filiais</option>
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filtro de Status de Estoque */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-400">Nível de Estoque</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">Todos os Níveis</option>
              <option value="low">Abaixo do Mínimo</option>
              <option value="zero">Estoque Zerado</option>
            </select>
          </div>

          {/* Botão de Atualizar */}
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="w-full border-slate-700 bg-slate-800/90 text-xs text-slate-200 hover:bg-slate-700 h-9"
            >
              {isRefreshing ? 'Atualizando...' : 'Recarregar Estoque'}
            </Button>
          </div>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total Físico em Estoque</p>
          <p className="text-xl font-bold text-white font-mono mt-1">
            {totalPhysicalQty.toLocaleString('pt-BR')} itens
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Soma de saldos nas filiais</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total Disponível para Venda</p>
          <p className="text-xl font-bold text-cyan-400 font-mono mt-1">
            {totalAvailableQty.toLocaleString('pt-BR')} itens
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Deduzindo reservas ativas</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Valor Estimado do Estoque</p>
          <p className="text-xl font-bold text-emerald-400 font-mono mt-1">
            R$ {totalEstimatedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Com base no custo cadastrado</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Produtos sem Custo Válido</p>
          <p className="text-xl font-bold text-amber-400 font-mono mt-1">
            {itemsWithoutCostCount} produto(s)
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Custo unitário zerado ou ausente</p>
        </div>
      </div>

      {/* Tabela de Estoque */}
      {isLoading ? (
        <LoadingState message="Consultando posição do estoque nas filiais..." />
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
          Nenhum registro de estoque encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-800/50 text-[11px] font-semibold text-slate-400 uppercase">
                <tr>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4">SKU / Cód.</th>
                  <th className="py-3 px-4">Filial</th>
                  <th className="py-3 px-4 text-center">Unidade</th>
                  <th className="py-3 px-4 text-right">Físico</th>
                  <th className="py-3 px-4 text-right">Disponível</th>
                  <th className="py-3 px-4 text-right">Estoque Mínimo</th>
                  <th className="py-3 px-4 text-right">Custo Unit.</th>
                  <th className="py-3 px-4 text-right">Valoração Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-normal text-slate-300">
                {filteredItems.map((item) => (
                  <tr key={`${item.branchId}-${item.productId}`} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-medium text-white">{item.productName}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{item.sku}</td>
                    <td className="py-3 px-4 text-slate-300">{item.branchName}</td>
                    <td className="py-3 px-4 text-center text-slate-400">{item.unit}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                      {item.quantity.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-cyan-400">
                      {item.availableQuantity.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {item.minStock.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {item.hasValidCost ? (
                        `R$ ${item.costPrice.toFixed(2)}`
                      ) : (
                        <span className="text-[10px] text-amber-400">Sem Custo</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      R$ {item.estimatedStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.isZero ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                          <AlertTriangle className="h-3 w-3" /> Zerado
                        </span>
                      ) : item.isBelowMin ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
                          <AlertCircle className="h-3 w-3" /> Abaixo Mín.
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Regular
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-700 bg-slate-850 font-bold text-xs">
                <tr className="print-totals-row">
                  <td colSpan={3} className="py-3 px-4 text-right uppercase text-slate-300">
                    Totais ({filteredItems.length} registros):
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                    {totalPhysicalQty.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-cyan-400">
                    {totalAvailableQty.toLocaleString('pt-BR')}
                  </td>
                  <td colSpan={2} className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-right font-mono font-black text-white text-sm">
                    R$ {totalEstimatedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
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
