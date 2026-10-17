import { useState, useEffect } from 'react'
import {
  X,
  PackageMinus,
  SlidersHorizontal,
  Search,
  AlertCircle,
  CheckCircle2,
  Building2,
  Loader2,
  Barcode,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { stockService } from '@/lib/services/stock.service'
import type { Product, BranchStockItem } from '@/types/stock'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

interface StockExitAdjustmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialProductStock?: BranchStockItem | null
  defaultMode?: 'exit' | 'adjustment'
}

const EXIT_REASONS = [
  'Perda / Avaria',
  'Consumo interno',
  'Correção de inventário',
  'Ajuste autorizado pela gerência',
  'Vencimento / Descarte',
  'Outro motivo',
]

export function StockExitAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  initialProductStock,
  defaultMode = 'exit',
}: StockExitAdjustmentModalProps) {
  const { activeCompany, activeBranch, companies } = useAuth()

  const [mode, setMode] = useState<'exit' | 'adjustment'>(defaultMode)
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [currentAvailableStock, setCurrentAvailableStock] = useState<number>(0)
  const [quantity, setQuantity] = useState<string>('1')
  const [adjustmentDirection, setAdjustmentDirection] = useState<'increase' | 'decrease'>('decrease')
  const [reason, setReason] = useState<string>(EXIT_REASONS[0])
  const [notes, setNotes] = useState<string>('')
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingStock, setIsLoadingStock] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentCompanyData = companies.find((c) => c.company.id === activeCompany?.id)
  const availableBranches = currentCompanyData?.branches || []

  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode)
      setSelectedBranchId(activeBranch?.id || availableBranches[0]?.id || '')
      setSearchTerm('')
      setSearchResults([])
      setQuantity('1')
      setAdjustmentDirection('decrease')
      setReason(EXIT_REASONS[0])
      setNotes('')
      setError(null)

      if (initialProductStock) {
        setSelectedBranchId(initialProductStock.branch_id)
        if (initialProductStock.product) {
          setSelectedProduct(initialProductStock.product)
          setSearchTerm(initialProductStock.product.name)
        }
        setCurrentAvailableStock(initialProductStock.quantity)
      } else {
        setSelectedProduct(null)
        setCurrentAvailableStock(0)
      }
    }
  }, [isOpen, activeBranch, initialProductStock, defaultMode])

  // Atualiza saldo disponível quando filial ou produto mudam
  useEffect(() => {
    async function loadStock() {
      if (!activeCompany?.id || !selectedBranchId || !selectedProduct?.id) return
      setIsLoadingStock(true)
      try {
        const stocks = await stockService.fetchBranchStock(activeCompany.id, selectedBranchId)
        const found = stocks.find((s) => s.product_id === selectedProduct.id)
        setCurrentAvailableStock(found ? found.quantity : 0)
      } catch (err) {
        console.error('Erro ao verificar saldo disponível:', err)
      } finally {
        setIsLoadingStock(false)
      }
    }

    if (isOpen && selectedProduct && selectedBranchId) {
      loadStock()
    }
  }, [isOpen, selectedBranchId, selectedProduct, activeCompany])

  // Busca de produtos
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
      setError('Selecione a filial.')
      return
    }

    if (!selectedProduct) {
      setError('Selecione o produto a ser movimentado.')
      return
    }

    const rawQty = parseFloat(quantity)
    if (isNaN(rawQty) || rawQty <= 0) {
      setError('A quantidade deve ser um número positivo maior que zero.')
      return
    }

    if (mode === 'exit') {
      if (rawQty > currentAvailableStock) {
        setError(
          `A saída (${rawQty}) não pode ser maior que o saldo disponível (${currentAvailableStock} ${selectedProduct.unit}).`
        )
        return
      }
    } else {
      // mode === 'adjustment'
      const delta = adjustmentDirection === 'increase' ? rawQty : -rawQty
      if (currentAvailableStock + delta < 0) {
        setError(
          `O ajuste negativo (${rawQty}) excede o saldo atual (${currentAvailableStock} ${selectedProduct.unit}).`
        )
        return
      }
    }

    if (!reason.trim()) {
      setError('O motivo da operação é obrigatório para manter a rastreabilidade.')
      return
    }

    setIsSubmitting(true)
    try {
      const movementType = mode === 'exit' ? 'exit' : 'adjustment'
      const finalQuantity =
        mode === 'exit'
          ? rawQty
          : adjustmentDirection === 'increase'
          ? rawQty
          : -rawQty

      await stockService.executeMovement({
        company_id: activeCompany.id,
        branch_id: selectedBranchId,
        product_id: selectedProduct.id,
        movement_type: movementType,
        quantity: finalQuantity,
        reason,
        notes: notes.trim() || undefined,
        reference_type: mode === 'exit' ? 'manual_exit' : 'manual_adjustment',
      })

      toast.success(
        `${mode === 'exit' ? 'Saída' : 'Ajuste'} de ${rawQty} ${selectedProduct.unit} de "${selectedProduct.name}" registrado com sucesso!`
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Erro na movimentação:', err)
      setError(err.message || 'Erro ao registrar operação no estoque.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl">
        {/* Header com seletor de Modo */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                mode === 'exit'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              }`}
            >
              {mode === 'exit' ? (
                <PackageMinus className="h-6 w-6" />
              ) : (
                <SlidersHorizontal className="h-6 w-6" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {mode === 'exit' ? 'Saída de Estoque' : 'Ajuste de Estoque'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'exit'
                  ? 'Baixa manual por perda, consumo ou avaria'
                  : 'Ajuste corretivo de inventário ou conferência'}
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

        {/* Alternador de Modo */}
        <div className="px-6 pt-4">
          <div className="flex rounded-xl bg-slate-800/80 p-1 border border-slate-700">
            <button
              type="button"
              onClick={() => setMode('exit')}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                mode === 'exit'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Registrar Saída (Baixa)
            </button>
            <button
              type="button"
              onClick={() => setMode('adjustment')}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                mode === 'adjustment'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Ajuste de Inventário
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Filial */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Filial Operacional
            </label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-10 pr-4 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code}) {b.id === activeBranch?.id ? '— [Filial Ativa]' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Seleção do Produto */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Produto
            </label>

            {selectedProduct ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/80 p-3.5">
                <div className="space-y-1">
                  <div className="font-medium text-white flex items-center gap-2">
                    <span>{selectedProduct.name}</span>
                    <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
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
                  <div className="pt-1 flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Saldo Atual na Unidade:</span>
                    {isLoadingStock ? (
                      <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                    ) : (
                      <span
                        className={`font-semibold ${
                          currentAvailableStock > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {currentAvailableStock} {selectedProduct.unit}
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
                    setCurrentAvailableStock(0)
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
                  <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                )}

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
              </div>
            )}
          </div>

          {/* Seletor de Direção do Ajuste (se mode === adjustment) */}
          {mode === 'adjustment' && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Tipo do Ajuste
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustmentDirection('decrease')}
                  className={`rounded-xl border p-3 text-center transition ${
                    adjustmentDirection === 'decrease'
                      ? 'border-rose-500 bg-rose-500/10 text-rose-400 font-semibold'
                      : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-white'
                  }`}
                >
                  - Reduzir Saldo
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentDirection('increase')}
                  className={`rounded-xl border p-3 text-center transition ${
                    adjustmentDirection === 'increase'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold'
                      : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-white'
                  }`}
                >
                  + Aumentar Saldo
                </button>
              </div>
            </div>
          )}

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
                Motivo
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                {EXIT_REASONS.map((r) => (
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
              Observações e Justificativa
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva detalhadamente a justificativa para auditoria..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-sm text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
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
              className={`gap-2 font-medium text-white ${
                mode === 'exit'
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {mode === 'exit' ? 'Confirmar Saída' : 'Aplicar Ajuste'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
