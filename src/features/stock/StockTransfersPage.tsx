import { useState, useEffect, useCallback } from 'react'
import {
  Split,
  Plus,
  RefreshCw,
  Building2,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { stockService } from '@/lib/services/stock.service'
import type { StockTransfer, StockTransferStatus } from '@/types/stock'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/shared/LoadingState'
import { NewTransferModal } from './modals/NewTransferModal'
import { TransferDetailsModal } from './modals/TransferDetailsModal'

type StatusTab = 'all' | StockTransferStatus

export function StockTransfersPage() {
  const { activeCompany, activeBranch, hasPermission, activeRole } = useAuth()

  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<StatusTab>('all')

  // Modais
  const [isNewTransferOpen, setIsNewTransferOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const canCreateStock = hasPermission('stock', 'create')
  const isAdmin = activeRole === 'owner' || activeRole === 'admin'

  const loadTransfers = useCallback(
    async (refresh = false) => {
      if (!activeCompany?.id) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const data = await stockService.fetchStockTransfers(
          activeCompany.id,
          activeBranch?.id,
          activeTab
        )
        setTransfers(data)
      } catch (err) {
        console.error('Erro ao buscar transferências:', err)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [activeCompany, activeBranch, activeTab]
  )

  useEffect(() => {
    loadTransfers()
  }, [loadTransfers])

  function handleOpenDetails(transfer: StockTransfer) {
    setSelectedTransfer(transfer)
    setIsDetailsOpen(true)
  }

  function renderStatusBadge(status: StockTransferStatus) {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700/60 px-2.5 py-1 text-xs font-semibold text-slate-300">
            <Clock className="h-3.5 w-3.5" /> Rascunho
          </span>
        )
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
            <Truck className="h-3.5 w-3.5" /> Em Trânsito
          </span>
        )
      case 'received':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" /> Recebida
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400 border border-rose-500/20">
            <XCircle className="h-3.5 w-3.5" /> Cancelada
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
              Transferências entre Filiais
            </h1>
            {activeBranch && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                <Building2 className="h-3.5 w-3.5" />
                {activeBranch.name} ({activeBranch.code})
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Controle seguro de remessas e recebimentos com custódia e rastreio de mercadorias em trânsito
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTransfers(true)}
            disabled={isRefreshing}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            title="Atualizar transferências"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          {canCreateStock && (
            <Button
              size="sm"
              onClick={() => setIsNewTransferOpen(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2 font-medium"
            >
              <Plus className="h-4 w-4" />
              Nova Transferência
            </Button>
          )}
        </div>
      </div>

      {/* Tabs por Status */}
      <div className="flex rounded-xl bg-slate-900/60 p-1.5 border border-slate-800 w-full sm:w-auto overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex-1 sm:flex-none whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'all'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Todas as Remessas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('in_transit')}
          className={`flex-1 sm:flex-none whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'in_transit'
              ? 'bg-amber-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Em Trânsito
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('draft')}
          className={`flex-1 sm:flex-none whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'draft'
              ? 'bg-slate-700 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Rascunhos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('received')}
          className={`flex-1 sm:flex-none whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'received'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Recebidas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cancelled')}
          className={`flex-1 sm:flex-none whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'cancelled'
              ? 'bg-rose-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Canceladas
        </button>
      </div>

      {/* Tabela de Transferências */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12">
            <LoadingState message="Carregando transferências entre filiais..." />
          </div>
        ) : transfers.length === 0 ? (
          <div className="p-16 text-center">
            <Split className="mx-auto h-12 w-12 text-slate-600" />
            <h3 className="mt-3 text-lg font-semibold text-white">Nenhuma transferência encontrada</h3>
            <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
              {activeTab !== 'all'
                ? 'Nenhuma remessa encontrada com este status.'
                : 'Não há transferências registradas entre filiais.'}
            </p>
            {canCreateStock && (
              <Button
                onClick={() => setIsNewTransferOpen(true)}
                className="mt-4 bg-cyan-600 hover:bg-cyan-500 text-white gap-2 font-medium"
              >
                <Plus className="h-4 w-4" />
                Criar Primeira Transferência
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-850 text-xs font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-4">Código / Data</th>
                  <th className="p-4">Origem ➔ Destino</th>
                  <th className="p-4 text-center">Itens / Volumes</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4">Datas Relevantes</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {transfers.map((t) => {
                  const totalUnits = (t.items || []).reduce(
                    (acc, i) => acc + (Number(i.quantity_sent) || 0),
                    0
                  )
                  const isDestination = activeBranch?.id === t.destination_branch_id
                  const isOrigin = activeBranch?.id === t.origin_branch_id

                  return (
                    <tr key={t.id} className="hover:bg-slate-850/50 transition">
                      {/* Código / Data */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-bold text-white font-mono">{t.code}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {new Date(t.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </td>

                      {/* Origem ➔ Destino */}
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-slate-300">
                            {t.origin_branch?.name || 'Origem'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-cyan-400" />
                          <span className="font-medium text-white">
                            {t.destination_branch?.name || 'Destino'}
                          </span>
                        </div>
                        {isDestination && (
                          <span className="inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400 mt-1 font-semibold">
                            Sua Filial é o Destino
                          </span>
                        )}
                        {isOrigin && (
                          <span className="inline-block rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-400 mt-1 font-semibold">
                            Sua Filial é a Origem
                          </span>
                        )}
                      </td>

                      {/* Itens / Volumes */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <div className="font-semibold text-white">
                          {t.items?.length || 0} produto(s)
                        </div>
                        <div className="text-xs text-slate-400">
                          {totalUnits} volume(s) total
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center whitespace-nowrap">
                        {renderStatusBadge(t.status)}
                      </td>

                      {/* Datas Relevantes */}
                      <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                        {t.shipped_at && (
                          <div>Envio: {new Date(t.shipped_at).toLocaleDateString('pt-BR')}</div>
                        )}
                        {t.received_at && (
                          <div className="text-emerald-400">
                            Rec.: {new Date(t.received_at).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                        {!t.shipped_at && !t.received_at && <div>Aguardando envio</div>}
                      </td>

                      {/* Ações */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Ação rápida de recebimento */}
                          {t.status === 'in_transit' && (isDestination || isAdmin) && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenDetails(t)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 gap-1.5"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Receber
                            </Button>
                          )}

                          {/* Ação rápida de envio */}
                          {t.status === 'draft' && (isOrigin || isAdmin) && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenDetails(t)}
                              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-8 gap-1.5"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Despachar
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDetails(t)}
                            className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-8 gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Detalhes
                          </Button>
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
      <NewTransferModal
        isOpen={isNewTransferOpen}
        onClose={() => setIsNewTransferOpen(false)}
        onSuccess={() => loadTransfers(true)}
      />

      <TransferDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false)
          setSelectedTransfer(null)
        }}
        transfer={selectedTransfer}
        onUpdate={() => loadTransfers(true)}
      />
    </div>
  )
}
