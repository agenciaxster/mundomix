import { useState } from 'react'
import {
  X,
  Split,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  Send,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { stockService } from '@/lib/services/stock.service'
import type { StockTransfer } from '@/types/stock'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/useToast'

interface TransferDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  transfer: StockTransfer | null
  onUpdate: () => void
}

export function TransferDetailsModal({
  isOpen,
  onClose,
  transfer,
  onUpdate,
}: TransferDetailsModalProps) {
  const { activeBranch, activeRole } = useAuth()
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionNotes, setActionNotes] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  if (!isOpen || !transfer) return null

  const isOrigin = activeBranch?.id === transfer.origin_branch_id
  const isDestination = activeBranch?.id === transfer.destination_branch_id
  const isAdmin = activeRole === 'owner' || activeRole === 'admin'

  async function handleShip() {
    if (!transfer) return
    setIsProcessing(true)
    try {
      await stockService.shipTransfer(transfer.id, actionNotes.trim() || undefined)
      toast.success(`Transferência ${transfer.code} despachada com sucesso!`)
      onUpdate()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao despachar transferência.')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleReceive() {
    if (!transfer) return
    setIsProcessing(true)
    try {
      await stockService.receiveTransfer(transfer.id, actionNotes.trim() || undefined)
      toast.success(`Mercadoria da transferência ${transfer.code} recebida no estoque com sucesso!`)
      onUpdate()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao receber transferência.')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleCancel() {
    if (!transfer) return
    setIsProcessing(true)
    try {
      await stockService.cancelTransfer(transfer.id, actionNotes.trim() || undefined)
      toast.success(
        `Transferência ${transfer.code} cancelada. Caso estivesse em trânsito, o saldo foi estornado para a origem.`
      )
      onUpdate()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao cancelar transferência.')
    } finally {
      setIsProcessing(false)
      setShowCancelConfirm(false)
    }
  }

  function renderStatusBadge(status: string) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Split className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{transfer.code}</h2>
                {renderStatusBadge(transfer.status)}
              </div>
              <p className="text-xs text-slate-400">
                Criada em {new Date(transfer.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Origem e Destino */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-850 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Origem (Remetente)
              </span>
              <div className="flex items-center gap-2 text-white font-medium">
                <Building2 className="h-4 w-4 text-cyan-400" />
                <span>{transfer.origin_branch?.name || 'Filial de Origem'}</span>
                <span className="text-xs text-slate-400">({transfer.origin_branch?.code})</span>
              </div>
              {transfer.shipped_at && (
                <p className="text-xs text-slate-400 mt-1">
                  Despachado em: {new Date(transfer.shipped_at).toLocaleString('pt-BR')}
                </p>
              )}
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Destino (Recebedor)
              </span>
              <div className="flex items-center gap-2 text-white font-medium">
                <Building2 className="h-4 w-4 text-emerald-400" />
                <span>{transfer.destination_branch?.name || 'Filial de Destino'}</span>
                <span className="text-xs text-slate-400">({transfer.destination_branch?.code})</span>
              </div>
              {transfer.received_at && (
                <p className="text-xs text-slate-400 mt-1">
                  Recebido em: {new Date(transfer.received_at).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>

          {/* Lista de Itens */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Produtos Transportados ({transfer.items?.length || 0})
            </h3>
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-850 text-xs text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Produto</th>
                    <th className="p-3 text-center">Enviado</th>
                    <th className="p-3 text-center">Recebido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                  {(transfer.items || []).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40">
                      <td className="p-3">
                        <div className="font-medium text-white">{item.product?.name || 'Produto'}</div>
                        <div className="text-xs text-slate-400">
                          {item.product?.sku && `SKU: ${item.product.sku} | `}
                          Unidade: {item.product?.unit || 'UN'}
                        </div>
                      </td>
                      <td className="p-3 text-center font-semibold text-amber-400">
                        {item.quantity_sent} {item.product?.unit}
                      </td>
                      <td className="p-3 text-center font-semibold text-emerald-400">
                        {transfer.status === 'received' ? item.quantity_received : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observações da Transferência */}
          {transfer.notes && (
            <div className="rounded-xl bg-slate-850 p-4 border border-slate-800 text-xs text-slate-300">
              <strong className="block text-slate-400 mb-1">Observações:</strong>
              {transfer.notes}
            </div>
          )}

          {/* Campo de notas para a ação */}
          {(transfer.status === 'draft' || transfer.status === 'in_transit') && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Observações do Processamento (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Mercadoria conferida sem avarias, lacre intacto..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          )}

          {/* Confirmação de Cancelamento */}
          {showCancelConfirm && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Confirmar Cancelamento da Transferência?</span>
              </div>
              <p className="text-xs text-rose-300">
                Se a mercadoria já foi despachada (em trânsito), o saldo será devolvido e estornado
                automaticamente para a filial de origem.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-medium"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sim, Cancelar'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isProcessing}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Voltar
                </Button>
              </div>
            </div>
          )}

          {/* Rodapé de Ações */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <div>
              {(transfer.status === 'draft' || transfer.status === 'in_transit') &&
                !showCancelConfirm &&
                (isAdmin || isOrigin) && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={isProcessing}
                    className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    Cancelar Transferência
                  </Button>
                )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Fechar
              </Button>

              {/* Ação de Despacho (se draft) */}
              {transfer.status === 'draft' && (isAdmin || isOrigin) && (
                <Button
                  type="button"
                  onClick={handleShip}
                  disabled={isProcessing}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2 font-medium"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Despachar Remessa
                    </>
                  )}
                </Button>
              )}

              {/* Ação de Recebimento (se in_transit) */}
              {transfer.status === 'in_transit' && (isAdmin || isDestination) && (
                <Button
                  type="button"
                  onClick={handleReceive}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-medium"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar Recebimento no Destino
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
