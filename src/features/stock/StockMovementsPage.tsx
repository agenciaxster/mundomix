import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeftRight,
  PackagePlus,
  PackageMinus,
  Search,
  RefreshCw,
  Building2,
  Barcode,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  Split,
  Undo2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { stockService } from '@/lib/services/stock.service'
import type { StockMovement, StockMovementType } from '@/types/stock'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import { StockEntryModal } from './modals/StockEntryModal'
import { StockExitAdjustmentModal } from './modals/StockExitAdjustmentModal'

export function StockMovementsPage() {
  const { activeCompany, activeBranch, hasPermission } = useAuth()

  const [movements, setMovements] = useState<StockMovement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filtros
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Modais
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
  const [isExitModalOpen, setIsExitModalOpen] = useState(false)
  const [exitModalMode, setExitModalMode] = useState<'exit' | 'adjustment'>('exit')

  const canCreateStock = hasPermission('stock', 'create')

  const loadMovements = useCallback(
    async (refresh = false) => {
      if (!activeCompany?.id || !activeBranch?.id) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const data = await stockService.fetchStockMovements(
          activeCompany.id,
          activeBranch.id,
          {
            type: typeFilter,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            search: searchTerm,
          }
        )
        setMovements(data)
      } catch (err) {
        console.error('Erro ao buscar movimentações:', err)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [activeCompany, activeBranch, typeFilter, startDate, endDate, searchTerm]
  )

  useEffect(() => {
    loadMovements()
  }, [loadMovements])

  function renderMovementBadge(type: StockMovementType) {
    switch (type) {
      case 'entry':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <ArrowDownLeft className="h-3 w-3" /> Entrada
          </span>
        )
      case 'exit':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
            <ArrowUpRight className="h-3 w-3" /> Saída
          </span>
        )
      case 'adjustment':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
            <SlidersHorizontal className="h-3 w-3" /> Ajuste
          </span>
        )
      case 'transfer_out':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
            <Split className="h-3 w-3" /> Transf. Saída
          </span>
        )
      case 'transfer_in':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
            <Split className="h-3 w-3" /> Transf. Entrada
          </span>
        )
      case 'reversal':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-semibold text-slate-300 border border-slate-500/20">
            <Undo2 className="h-3 w-3" /> Estorno
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Histórico de Movimentações
            </h1>
            {activeBranch && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                <Building2 className="h-3.5 w-3.5" />
                {activeBranch.name} ({activeBranch.code})
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Registro cronológico e imutável de todas as alterações físicas no estoque da unidade
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMovements(true)}
            disabled={isRefreshing}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            title="Atualizar histórico"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          {canCreateStock && (
            <>
              <Button
                size="sm"
                onClick={() => setIsEntryModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-medium"
              >
                <PackagePlus className="h-4 w-4" />
                Nova Entrada
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setExitModalMode('exit')
                  setIsExitModalOpen(true)
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white gap-2 font-medium"
              >
                <PackageMinus className="h-4 w-4" />
                Nova Saída / Ajuste
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Painel de Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        {/* Tipo */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tipo de Movimentação
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="all">Todos os Tipos</option>
            <option value="entry">Entradas (+)</option>
            <option value="exit">Saídas (-)</option>
            <option value="adjustment">Ajustes (+/-)</option>
            <option value="transfer_in">Transferência Recebida (+)</option>
            <option value="transfer_out">Transferência Enviada (-)</option>
            <option value="reversal">Estornos</option>
          </select>
        </div>

        {/* Data Inicial */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Data Inicial
          </label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-800/80 border-slate-700 text-white text-sm"
          />
        </div>

        {/* Data Final */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Data Final
          </label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-800/80 border-slate-700 text-white text-sm"
          />
        </div>

        {/* Busca por Produto ou Motivo */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Busca Rápida
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              type="text"
              placeholder="Produto, SKU ou motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-800/80 border-slate-700 text-white text-sm placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Movimentações */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12">
            <LoadingState message="Carregando histórico de movimentações..." />
          </div>
        ) : movements.length === 0 ? (
          <div className="p-16 text-center">
            <ArrowLeftRight className="mx-auto h-12 w-12 text-slate-600" />
            <h3 className="mt-3 text-lg font-semibold text-white">Nenhuma movimentação encontrada</h3>
            <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
              Nenhum evento registrado com os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-850 text-xs font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-4">Data / Hora</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Produto</th>
                  <th className="p-4 text-center">Qtd. Movimentada</th>
                  <th className="p-4 text-center">Saldo Anterior ➔ Posterior</th>
                  <th className="p-4">Motivo e Observações</th>
                  <th className="p-4">Documento / Ref.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {movements.map((m) => {
                  const isPositive = ['entry', 'transfer_in', 'reversal'].includes(m.movement_type)
                  const isNegative = ['exit', 'transfer_out'].includes(m.movement_type)

                  return (
                    <tr key={m.id} className="hover:bg-slate-850/50 transition">
                      {/* Data / Hora */}
                      <td className="p-4 whitespace-nowrap text-xs text-slate-300">
                        <div className="font-medium text-white">
                          {new Date(m.created_at).toLocaleDateString('pt-BR')}
                        </div>
                        <div className="text-slate-500">
                          {new Date(m.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="p-4 whitespace-nowrap">{renderMovementBadge(m.movement_type)}</td>

                      {/* Produto */}
                      <td className="p-4">
                        <div className="font-medium text-white">{m.product?.name || 'Produto'}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          {m.product?.sku && <span>SKU: {m.product.sku}</span>}
                          {m.product?.barcode && (
                            <span className="flex items-center gap-1">
                              <Barcode className="h-3 w-3" /> {m.product.barcode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Qtd Movimentada */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            isPositive
                              ? 'text-emerald-400'
                              : isNegative
                              ? 'text-rose-400'
                              : 'text-indigo-400'
                          }`}
                        >
                          {isPositive ? '+' : isNegative ? '-' : ''}
                          {m.quantity} {m.product?.unit || 'UN'}
                        </span>
                      </td>

                      {/* Saldo Anterior ➔ Posterior */}
                      <td className="p-4 text-center whitespace-nowrap text-xs">
                        <span className="text-slate-400 font-medium">{m.balance_before}</span>
                        <span className="mx-2 text-slate-600">➔</span>
                        <strong className="text-white font-bold">{m.balance_after}</strong>
                      </td>

                      {/* Motivo e Observações */}
                      <td className="p-4 max-w-xs">
                        <div className="font-medium text-slate-200">{m.reason}</div>
                        {m.notes && (
                          <div className="text-xs text-slate-400 truncate mt-0.5" title={m.notes}>
                            {m.notes}
                          </div>
                        )}
                      </td>

                      {/* Documento / Ref */}
                      <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                        {m.reference_type ? (
                          <span className="rounded bg-slate-800 px-2 py-1 text-slate-300 font-mono text-[11px]">
                            {m.reference_type}
                          </span>
                        ) : (
                          '—'
                        )}
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
        onSuccess={() => loadMovements(true)}
      />

      <StockExitAdjustmentModal
        isOpen={isExitModalOpen}
        onClose={() => setIsExitModalOpen(false)}
        onSuccess={() => loadMovements(true)}
        defaultMode={exitModalMode}
      />
    </div>
  )
}
