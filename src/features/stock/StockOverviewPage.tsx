import { useState, useEffect, useCallback } from 'react'
import {
  Boxes,
  PackagePlus,
  PackageMinus,
  Split,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
  RefreshCw,
  SlidersHorizontal,
  Barcode,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { stockService } from '@/lib/services/stock.service'
import type { BranchStockItem, StockKpis } from '@/types/stock'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import { StockEntryModal } from './modals/StockEntryModal'
import { StockExitAdjustmentModal } from './modals/StockExitAdjustmentModal'
import { NewTransferModal } from './modals/NewTransferModal'

type FilterTab = 'all' | 'low_stock' | 'zero_stock'

export function StockOverviewPage() {
  const { activeCompany, activeBranch, hasPermission } = useAuth()

  const [stockItems, setStockItems] = useState<BranchStockItem[]>([])
  const [kpis, setKpis] = useState<StockKpis>({
    totalProductsWithStock: 0,
    lowStockCount: 0,
    zeroStockCount: 0,
    monthlyEntries: 0,
    monthlyExits: 0,
    pendingTransfersCount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  // Modais
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
  const [isExitModalOpen, setIsExitModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [selectedStockItem, setSelectedStockItem] = useState<BranchStockItem | null>(null)
  const [exitModalMode, setExitModalMode] = useState<'exit' | 'adjustment'>('exit')

  const canCreateStock = hasPermission('stock', 'create')
  const canEditStock = hasPermission('stock', 'edit')

  const loadData = useCallback(
    async (refresh = false) => {
      if (!activeCompany?.id || !activeBranch?.id) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const [items, kpiData] = await Promise.all([
          stockService.fetchBranchStock(activeCompany.id, activeBranch.id, {
            search: searchTerm,
            onlyLowStock: activeTab === 'low_stock',
            onlyZeroStock: activeTab === 'zero_stock',
          }),
          stockService.fetchStockKpis(activeCompany.id, activeBranch.id),
        ])

        setStockItems(items)
        setKpis(kpiData)
      } catch (err) {
        console.error('Erro ao carregar dados de estoque:', err)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [activeCompany, activeBranch, searchTerm, activeTab]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  function handleQuickEntry(item: BranchStockItem) {
    setSelectedStockItem(item)
    setIsEntryModalOpen(true)
  }

  function handleQuickExit(item: BranchStockItem, mode: 'exit' | 'adjustment') {
    setSelectedStockItem(item)
    setExitModalMode(mode)
    setIsExitModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Controle de Estoque por Filial
            </h1>
            {activeBranch && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                <Building2 className="h-3.5 w-3.5" />
                {activeBranch.name} ({activeBranch.code})
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Gestão operacional de saldos, disponibilidade, estoque mínimo e movimentações
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            title="Atualizar saldos"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          {canCreateStock && (
            <>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedStockItem(null)
                  setIsEntryModalOpen(true)
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-medium"
              >
                <PackagePlus className="h-4 w-4" />
                Nova Entrada
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setSelectedStockItem(null)
                  setExitModalMode('exit')
                  setIsExitModalOpen(true)
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white gap-2 font-medium"
              >
                <PackageMinus className="h-4 w-4" />
                Saída / Ajuste
              </Button>

              <Button
                size="sm"
                onClick={() => setIsTransferModalOpen(true)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2 font-medium"
              >
                <Split className="h-4 w-4" />
                Transferência
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Itens com saldo */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Produtos com Saldo
            </span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {kpis.totalProductsWithStock}
            </span>
            <span className="text-xs text-slate-400">itens ativos</span>
          </div>
          <div className="mt-2 text-xs text-emerald-400/90 flex items-center gap-1 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Disponibilidade operacional
          </div>
        </div>

        {/* Abaixo do Mínimo */}
        <div
          onClick={() => setActiveTab('low_stock')}
          className={`cursor-pointer rounded-2xl border p-5 shadow-sm transition hover:border-amber-500/50 ${
            activeTab === 'low_stock'
              ? 'border-amber-500/60 bg-amber-500/5'
              : 'border-slate-800 bg-slate-900/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Abaixo do Mínimo
            </span>
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold ${
                kpis.lowStockCount > 0 ? 'text-amber-400' : 'text-white'
              }`}
            >
              {kpis.lowStockCount}
            </span>
            <span className="text-xs text-slate-400">necessitam reposição</span>
          </div>
          <div className="mt-2 text-xs text-amber-400/90 font-medium">
            Clique para filtrar produtos críticos
          </div>
        </div>

        {/* Sem Saldo (Zerados) */}
        <div
          onClick={() => setActiveTab('zero_stock')}
          className={`cursor-pointer rounded-2xl border p-5 shadow-sm transition hover:border-rose-500/50 ${
            activeTab === 'zero_stock'
              ? 'border-rose-500/60 bg-rose-500/5'
              : 'border-slate-800 bg-slate-900/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Produtos Zerados
            </span>
            <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400 border border-rose-500/20">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold ${
                kpis.zeroStockCount > 0 ? 'text-rose-400' : 'text-white'
              }`}
            >
              {kpis.zeroStockCount}
            </span>
            <span className="text-xs text-slate-400">sem estoque físico</span>
          </div>
          <div className="mt-2 text-xs text-rose-400/90 font-medium">
            Clique para filtrar produtos sem saldo
          </div>
        </div>

        {/* Transferências a Receber */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Transferências a Receber
            </span>
            <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-400 border border-cyan-500/20">
              <Split className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-cyan-400">
              {kpis.pendingTransfersCount}
            </span>
            <span className="text-xs text-slate-400">em trânsito para a filial</span>
          </div>
          <div className="mt-2 text-xs text-cyan-400/90 font-medium">
            {kpis.pendingTransfersCount > 0
              ? 'Aguardando conferência física'
              : 'Nenhuma carga pendente'}
          </div>
        </div>
      </div>

      {/* Filtros e Barra de Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        {/* Tabs de Filtro */}
        <div className="flex rounded-xl bg-slate-850 p-1 border border-slate-800 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex-1 sm:flex-none rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === 'all'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos os Produtos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('low_stock')}
            className={`flex-1 sm:flex-none rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === 'low_stock'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Estoque Baixo ({kpis.lowStockCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('zero_stock')}
            className={`flex-1 sm:flex-none rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === 'zero_stock'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sem Saldo ({kpis.zeroStockCount})
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Buscar por nome, SKU ou barras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-850 border-slate-800 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Tabela de Produtos e Saldos */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12">
            <LoadingState message="Carregando posição de estoque da filial..." />
          </div>
        ) : stockItems.length === 0 ? (
          <div className="p-16 text-center">
            <Boxes className="mx-auto h-12 w-12 text-slate-600" />
            <h3 className="mt-3 text-lg font-semibold text-white">Nenhum registro de estoque</h3>
            <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
              {searchTerm || activeTab !== 'all'
                ? 'Nenhum produto corresponde aos filtros aplicados.'
                : 'Ainda não há produtos movimentados nesta filial. Registre a primeira entrada para iniciar o saldo físico.'}
            </p>
            {canCreateStock && (
              <Button
                onClick={() => setIsEntryModalOpen(true)}
                className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-medium"
              >
                <PackagePlus className="h-4 w-4" />
                Registrar Primeira Entrada
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-850 text-xs font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-4">Produto</th>
                  <th className="p-4">Categoria</th>
                  <th className="p-4 text-center">Estoque Físico</th>
                  <th className="p-4 text-center">Reservado</th>
                  <th className="p-4 text-center">Disponível</th>
                  <th className="p-4 text-center">Estoque Mínimo</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {stockItems.map((item) => {
                  const available = item.quantity - item.reserved_quantity
                  const isLow = item.quantity <= item.min_stock && item.quantity > 0
                  const isZero = item.quantity <= 0

                  return (
                    <tr key={item.id} className="hover:bg-slate-850/50 transition">
                      {/* Produto */}
                      <td className="p-4">
                        <div className="font-medium text-white">{item.product?.name}</div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          {item.product?.sku && <span>SKU: {item.product.sku}</span>}
                          {item.product?.barcode && (
                            <span className="flex items-center gap-1">
                              <Barcode className="h-3 w-3" /> {item.product.barcode}
                            </span>
                          )}
                          <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[11px] text-slate-300">
                            {item.product?.unit || 'UN'}
                          </span>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="p-4 text-slate-300">
                        {item.product?.category || '—'}
                      </td>

                      {/* Estoque Físico */}
                      <td className="p-4 text-center font-bold text-white">
                        {item.quantity} {item.product?.unit}
                      </td>

                      {/* Reservado */}
                      <td className="p-4 text-center text-slate-400">
                        {item.reserved_quantity} {item.product?.unit}
                      </td>

                      {/* Disponível */}
                      <td className="p-4 text-center font-bold text-emerald-400">
                        {available} {item.product?.unit}
                      </td>

                      {/* Estoque Mínimo */}
                      <td className="p-4 text-center text-slate-400">
                        {item.min_stock} {item.product?.unit}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        {isZero ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
                            Zerado
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
                            Abaixo do Mín.
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                            Normal
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canCreateStock && (
                            <button
                              type="button"
                              onClick={() => handleQuickEntry(item)}
                              className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/10 transition"
                              title="Adicionar Entrada"
                            >
                              <PackagePlus className="h-4 w-4" />
                            </button>
                          )}
                          {canEditStock && (
                            <button
                              type="button"
                              onClick={() => handleQuickExit(item, 'exit')}
                              className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10 transition"
                              title="Registrar Saída"
                            >
                              <PackageMinus className="h-4 w-4" />
                            </button>
                          )}
                          {canEditStock && (
                            <button
                              type="button"
                              onClick={() => handleQuickExit(item, 'adjustment')}
                              className="rounded-lg p-1.5 text-indigo-400 hover:bg-indigo-500/10 transition"
                              title="Ajuste de Saldo"
                            >
                              <SlidersHorizontal className="h-4 w-4" />
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
        )}
      </div>

      {/* Modais */}
      <StockEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        onSuccess={() => loadData(true)}
        initialProductId={selectedStockItem?.product_id}
      />

      <StockExitAdjustmentModal
        isOpen={isExitModalOpen}
        onClose={() => setIsExitModalOpen(false)}
        onSuccess={() => loadData(true)}
        initialProductStock={selectedStockItem}
        defaultMode={exitModalMode}
      />

      <NewTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={() => loadData(true)}
      />
    </div>
  )
}
