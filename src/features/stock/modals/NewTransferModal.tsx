import { useState, useEffect } from 'react'
import {
  X,
  Split,
  Search,
  AlertCircle,
  Plus,
  Trash2,
  Send,
  Save,
  Building2,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { stockService } from '@/lib/services/stock.service'
import type { Product } from '@/types/stock'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

interface NewTransferModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface TransferItemDraft {
  product: Product
  availableStock: number
  quantity: number
}

export function NewTransferModal({
  isOpen,
  onClose,
  onSuccess,
}: NewTransferModalProps) {
  const { activeCompany, activeBranch, companies } = useAuth()

  const currentCompanyData = companies.find((c) => c.company.id === activeCompany?.id)
  const availableBranches = currentCompanyData?.branches || []

  const [originBranchId, setOriginBranchId] = useState<string>('')
  const [destBranchId, setDestBranchId] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  // Itens da transferência
  const [items, setItems] = useState<TransferItemDraft[]>([])

  // Busca de produto para inclusão
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [branchStocksMap, setBranchStocksMap] = useState<Map<string, number>>(new Map())

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      const defaultOrigin = activeBranch?.id || availableBranches[0]?.id || ''
      setOriginBranchId(defaultOrigin)

      const defaultDest = availableBranches.find((b) => b.id !== defaultOrigin)?.id || ''
      setDestBranchId(defaultDest)

      setItems([])
      setNotes('')
      setSearchTerm('')
      setSearchResults([])
      setError(null)
    }
  }, [isOpen, activeBranch, availableBranches])

  // Carrega saldos da filial de origem para validação
  useEffect(() => {
    async function loadOriginStocks() {
      if (!activeCompany?.id || !originBranchId) return
      try {
        const stocks = await stockService.fetchBranchStock(activeCompany.id, originBranchId)
        const map = new Map<string, number>()
        stocks.forEach((s) => map.set(s.product_id, s.quantity))
        setBranchStocksMap(map)
      } catch (err) {
        console.error('Erro ao carregar saldos da origem:', err)
      }
    }

    if (isOpen && originBranchId) {
      loadOriginStocks()
    }
  }, [isOpen, originBranchId, activeCompany])

  // Busca de produtos para adicionar
  useEffect(() => {
    if (!activeCompany || !isOpen) return
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await stockService.searchProducts(activeCompany.id, searchTerm)
        // Filtra os que já estão na lista de itens
        const filtered = results.filter((p) => !items.some((i) => i.product.id === p.id))
        setSearchResults(filtered)
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, activeCompany, isOpen, items])

  function handleAddItem(product: Product) {
    const available = branchStocksMap.get(product.id) || 0
    if (available <= 0) {
      toast.error(`O produto "${product.name}" não possui saldo disponível na filial de origem.`)
      return
    }

    setItems((prev) => [
      ...prev,
      {
        product,
        availableStock: available,
        quantity: 1,
      },
    ])
    setSearchTerm('')
    setSearchResults([])
  }

  function handleUpdateQuantity(productId: string, qty: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: qty } : item
      )
    )
  }

  function handleRemoveItem(productId: string) {
    setItems((prev) => prev.filter((item) => item.product.id !== productId))
  }

  async function handleSaveTransfer(shouldShipImmediately: boolean) {
    setError(null)

    if (!activeCompany?.id) {
      setError('Empresa ativa não identificada.')
      return
    }

    if (!originBranchId || !destBranchId) {
      setError('Selecione as filiais de origem e destino.')
      return
    }

    if (originBranchId === destBranchId) {
      setError('A filial de origem e a de destino devem ser diferentes.')
      return
    }

    if (items.length === 0) {
      setError('Adicione pelo menos um produto para transferir.')
      return
    }

    // Valida quantidades
    for (const item of items) {
      if (item.quantity <= 0) {
        setError(`A quantidade para "${item.product.name}" deve ser maior que zero.`)
        return
      }
      if (item.quantity > item.availableStock) {
        setError(
          `A quantidade solicitada para "${item.product.name}" (${item.quantity}) excede o saldo na origem (${item.availableStock}).`
        )
        return
      }
    }

    setIsSubmitting(true)
    try {
      // 1. Cria a transferência em rascunho
      const transfer = await stockService.createTransfer({
        company_id: activeCompany.id,
        origin_branch_id: originBranchId,
        destination_branch_id: destBranchId,
        notes: notes.trim() || undefined,
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
      })

      // 2. Se optou por despachar imediatamente, executa a RPC de envio
      if (shouldShipImmediately) {
        await stockService.shipTransfer(transfer.id, notes.trim() || undefined)
        toast.success(
          `Transferência ${transfer.code} criada e despachada! Mercadoria em trânsito.`
        )
      } else {
        toast.success(`Transferência ${transfer.code} salva como rascunho.`)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Erro ao processar transferência:', err)
      setError(err.message || 'Falha ao processar a transferência.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

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
              <h2 className="text-xl font-bold text-white">Nova Transferência entre Filiais</h2>
              <p className="text-xs text-slate-400">
                Remessa controlada entre unidades da mesma empresa
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
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Seleção de Filiais (Origem -> Destino) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-850 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Filial de Origem (Saída)
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <select
                  value={originBranchId}
                  onChange={(e) => {
                    setOriginBranchId(e.target.value)
                    setItems([]) // Limpa itens pois o saldo depende da origem
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {availableBranches.map((b) => (
                    <option key={b.id} value={b.id} disabled={b.id === destBranchId}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Filial de Destino (Entrada)
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <select
                  value={destBranchId}
                  onChange={(e) => setDestBranchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {availableBranches.map((b) => (
                    <option key={b.id} value={b.id} disabled={b.id === originBranchId}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Adicionar Produtos */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Adicionar Produtos à Transferência
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                type="text"
                placeholder="Pesquise produto por nome, SKU ou leitor de código de barras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500"
              />
              {isSearching && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-cyan-400" />
              )}

              {searchResults.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-850 p-1 shadow-2xl">
                  {searchResults.map((product) => {
                    const available = branchStocksMap.get(product.id) || 0
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleAddItem(product)}
                        className="w-full text-left rounded-lg p-2.5 transition hover:bg-slate-800/90 flex items-center justify-between group"
                      >
                        <div>
                          <p className="text-sm font-medium text-white group-hover:text-cyan-400">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            {product.sku && <span>SKU: {product.sku}</span>}
                            <span>
                              Disponível na Origem:{' '}
                              <strong className={available > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {available} {product.unit}
                              </strong>
                            </span>
                          </div>
                        </div>
                        <Plus className="h-4 w-4 text-slate-400 group-hover:text-cyan-400" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tabela de Itens Selecionados */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Itens da Remessa ({items.length})
              </span>
              {items.length > 0 && (
                <span className="text-xs text-slate-400">
                  Total de volumes:{' '}
                  <strong className="text-white">
                    {items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)}
                  </strong>
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
                Nenhum produto adicionado. Use o campo acima para pesquisar e incluir itens.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2">
                {items.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between gap-4 rounded-lg bg-slate-800/70 p-3 border border-slate-700/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        Disponível na origem: {item.availableStock} {item.product.unit}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          step="1"
                          min="0.001"
                          max={item.availableStock}
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(item.product.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-24 text-center bg-slate-900 border-slate-700 text-white font-semibold py-1 h-9"
                        />
                        <span className="text-xs text-slate-400 font-medium">
                          {item.product.unit}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.product.id)}
                        className="rounded-lg p-2 text-rose-400 transition hover:bg-rose-500/10"
                        title="Remover item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Observações da Transferência (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções de transporte, motorista, motivo do remanejamento..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSaveTransfer(false)}
              disabled={isSubmitting || items.length === 0}
              className="w-full sm:w-auto border-slate-700 text-slate-200 hover:bg-slate-800 gap-2"
            >
              <Save className="h-4 w-4" />
              Salvar como Rascunho
            </Button>
            <Button
              type="button"
              onClick={() => handleSaveTransfer(true)}
              disabled={isSubmitting || items.length === 0}
              className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white gap-2 font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Salvar e Despachar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
