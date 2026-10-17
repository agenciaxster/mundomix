import { useState, useEffect, useRef } from 'react'
import { X, Search, Package, Tag, Boxes } from 'lucide-react'
import { productService, type ProductWithBranchStock } from '@/lib/services/product.service'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ProductSearchModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  branchId: string
  onSelectProduct: (product: ProductWithBranchStock) => void
}

export function ProductSearchModal({
  isOpen,
  onClose,
  companyId,
  branchId,
  onSelectProduct,
}: ProductSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [products, setProducts] = useState<ProductWithBranchStock[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && companyId && branchId) {
      setSearchTerm('')
      loadProducts('')
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen, companyId, branchId])

  async function loadProducts(query: string) {
    setIsLoading(true)
    try {
      const data = await productService.fetchProductsWithBranchStock(companyId, branchId, {
        search: query,
      })
      setProducts(data)
      setSelectedIndex(0)
    } catch (err) {
      console.error('Erro ao buscar produtos no modal do PDV:', err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleSearchChange(val: string) {
    setSearchTerm(val)
    loadProducts(val)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < products.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (products[selectedIndex]) {
        onSelectProduct(products[selectedIndex])
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Catálogo de Produtos (PDV)</h2>
              <p className="text-xs text-slate-400">
                Pressione <span className="font-bold text-slate-200">F2</span> ou use as setas ↑ ↓ e Enter para selecionar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Input de Busca */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input
              ref={inputRef}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Digite o nome, SKU, código de barras ou marca do produto..."
              className="pl-10 bg-slate-800 border-slate-700 text-white text-sm focus:border-blue-500"
            />
          </div>
        </div>

        {/* Lista de Resultados */}
        <div className="p-4 max-h-[58vh] overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Carregando catálogo...</div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhum produto localizado com esse critério.
            </div>
          ) : (
            products.map((p, idx) => {
              const isSelected = idx === selectedIndex
              const inStock = (p.available_stock || 0) > 0
              const hasWholesale = Boolean(p.wholesale_price && p.wholesale_price > 0)

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectProduct(p)
                    onClose()
                  }}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50'
                      : 'border-slate-800 bg-slate-850/40 hover:bg-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center shrink-0 overflow-hidden">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-slate-500" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        {p.sku && (
                          <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                            SKU: {p.sku}
                          </span>
                        )}
                        {p.barcode && (
                          <span className="font-mono text-slate-400">EAN: {p.barcode}</span>
                        )}
                        {p.brand && (
                          <span className="flex items-center gap-1 text-amber-300">
                            <Tag className="h-2.5 w-2.5" />
                            {p.brand}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right space-y-1 shrink-0 ml-4">
                    <div className="text-base font-black text-white font-mono">
                      R$ {Number(p.sale_price).toFixed(2)}
                    </div>

                    {hasWholesale && (
                      <div className="text-[11px] font-bold text-amber-400">
                        Atacado: R$ {Number(p.wholesale_price).toFixed(2)}{' '}
                        <span className="text-[10px] text-slate-400">
                          (min {p.wholesale_min_qty || 5} un)
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1 text-[11px]">
                      <Boxes className="h-3 w-3 text-slate-400" />
                      <span className={inStock ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                        {inStock ? `${p.available_stock} ${p.unit} em estoque` : 'Sem estoque'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3 bg-slate-850/80 text-xs text-slate-400">
          <span>
            Use as setas <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono">↑</kbd>{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono">↓</kbd> e{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono">Enter</kbd> para selecionar
          </span>

          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Fechar (ESC)
          </Button>
        </div>
      </div>
    </div>
  )
}
