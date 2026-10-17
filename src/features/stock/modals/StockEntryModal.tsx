import { useState, useEffect } from 'react'
import {
  X,
  PackagePlus,
  Search,
  AlertCircle,
  CheckCircle2,
  Building2,
  Loader2,
  Barcode,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { stockService } from '@/lib/services/stock.service'
import type { Product } from '@/types/stock'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

interface StockEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialProductId?: string
}

const ENTRY_REASONS = [
  'Compra recebida',
  'Recebimento inicial',
  'Devolução de cliente',
  'Ajuste positivo de estoque',
  'Bonificação / Amostra',
  'Outro motivo',
]

export function StockEntryModal({
  isOpen,
  onClose,
  onSuccess,
  initialProductId,
}: StockEntryModalProps) {
  const { activeCompany, activeBranch, companies } = useAuth()

  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState<string>('1')
  const [reason, setReason] = useState<string>(ENTRY_REASONS[0])
  const [notes, setNotes] = useState<string>('')
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Obtém lista de filiais da empresa ativa
  const currentCompanyData = companies.find((c) => c.company.id === activeCompany?.id)
  const availableBranches = currentCompanyData?.branches || []

  useEffect(() => {
    if (isOpen) {
      setSelectedBranchId(activeBranch?.id || availableBranches[0]?.id || '')
      setSearchTerm('')
      setSearchResults([])
      setSelectedProduct(null)
      setQuantity('1')
      setReason(ENTRY_REASONS[0])
      setNotes('')
      setError(null)

      if (initialProductId && activeCompany?.id) {
        loadInitialProduct(initialProductId)
      }
    }
  }, [isOpen, activeBranch, initialProductId, activeCompany])

  async function loadInitialProduct(prodId: string) {
    if (!activeCompany) return
    setIsSearching(true)
    try {
      const prods = await stockService.searchProducts(activeCompany.id, '')
      const found = prods.find((p) => p.id === prodId)
      if (found) {
        setSelectedProduct(found)
        setSearchTerm(found.name)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }

  // Busca de produtos com debounce simples
  useEffect(() => {
    if (!activeCompany || !isOpen || selectedProduct) return

    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await stockService.searchProducts(activeCompany.id, searchTerm)
        setSearchResults(results)
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, activeCompany, isOpen, selectedProduct])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!activeCompany?.id) {
      setError('Nenhuma empresa ativa selecionada.')
      return
    }

    if (!selectedBranchId) {
      setError('Selecione a filial de destino da entrada.')
      return
    }

    if (!selectedProduct) {
      setError('Selecione o produto que deseja dar entrada.')
      return
    }

    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      setError('A quantidade deve ser um número maior que zero.')
      return
    }

    if (!reason.trim()) {
      setError('O motivo da entrada é obrigatório.')
      return
    }

    setIsSubmitting(true)
    try {
      await stockService.executeMovement({
        company_id: activeCompany.id,
        branch_id: selectedBranchId,
        product_id: selectedProduct.id,
        movement_type: 'entry',
        quantity: qty,
        reason,
        notes: notes.trim() || undefined,
        reference_type: 'manual_entry',
      })

      toast.success(
        `Entrada de ${qty} ${selectedProduct.unit} de "${selectedProduct.name}" registrada com sucesso!`
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Erro ao registrar entrada:', err)
      setError(err.message || 'Erro ao registrar entrada no estoque.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <PackagePlus className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Nova Entrada de Estoque</h2>
              <p className="text-xs text-slate-400">
                Adicione saldo físico na filial selecionada
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Filial de Destino */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Filial de Destino
            </label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-10 pr-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code}) {b.id === activeBranch?.id ? '— [Filial Ativa]' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Seleção de Produto */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Produto
            </label>

            {selectedProduct ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                <div className="space-y-0.5">
                  <div className="font-medium text-white flex items-center gap-2">
                    <span>{selectedProduct.name}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
                      {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {selectedProduct.sku && <span>SKU: {selectedProduct.sku}</span>}
                    {selectedProduct.barcode && (
                      <span className="flex items-center gap-1">
                        <Barcode className="h-3 w-3" /> {selectedProduct.barcode}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedProduct(null)
                    setSearchTerm('')
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Pesquise por nome, SKU ou leitor de código de barras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-emerald-400" />
                )}

                {/* Dropdown de Resultados */}
                {searchResults.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-850 p-1 shadow-2xl">
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => {
                          setSelectedProduct(product)
                          setSearchTerm(product.name)
                          setSearchResults([])
                        }}
                        className="w-full text-left rounded-lg p-2.5 transition hover:bg-slate-800/90 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{product.name}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            {product.sku && <span>SKU: {product.sku}</span>}
                            {product.barcode && <span>Barras: {product.barcode}</span>}
                          </div>
                        </div>
                        <span className="rounded bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                          {product.unit}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {searchTerm.trim().length > 1 && !isSearching && searchResults.length === 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-700 bg-slate-850 p-3 text-center text-xs text-slate-400 shadow-xl">
                    Nenhum produto ativo encontrado com &quot;{searchTerm}&quot;
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quantidade e Motivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Quantidade
              </label>
              <Input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-slate-800/80 border-slate-700 text-white font-semibold text-base"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Motivo da Entrada
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {ENTRY_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Observações (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Nota fiscal nº 1234, lote fornecedor, conferência física..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedProduct}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar Entrada
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
