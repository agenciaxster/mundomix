import {
  X,
  Package,
  ShoppingCart,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Printer,
  Building2,
  Tag,
  ArrowRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { ProductWithBranchStock } from '@/lib/services/product.service'

interface ProductQuickScannedModalProps {
  isOpen: boolean
  onClose: () => void
  product: ProductWithBranchStock | null
  activeBranchName?: string
  onScanAnother?: () => void
  onOpenLabelModal?: (product: ProductWithBranchStock) => void
}

export function ProductQuickScannedModal({
  isOpen,
  onClose,
  product,
  activeBranchName,
  onScanAnother,
  onOpenLabelModal,
}: ProductQuickScannedModalProps) {
  const navigate = useNavigate()

  if (!isOpen || !product) return null

  const salePrice = Number(product.sale_price || 0)
  const maxDiscountPct = Number(product.max_discount_percentage || 0)
  const minPriceWithDiscount =
    maxDiscountPct > 0 ? salePrice * (1 - maxDiscountPct / 100) : salePrice
  const maxDiscountValue = salePrice - minPriceWithDiscount

  const availableStock = Number(product.available_stock || 0)
  const isOutOfStock = availableStock <= 0
  const isLowStock = !isOutOfStock && availableStock <= Number(product.min_stock || 2)

  const hasWholesale = Boolean(
    product.wholesale_price && Number(product.wholesale_price) > 0
  )

  function handleStartSale() {
    if (!product) return
    onClose()
    // Redireciona para o fluxo de venda/orçamento com o produto pré-selecionado
    navigate(`/comercial/orcamentos/novo?add_product_id=${product.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-6">
        {/* Header com identificação da filial */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-850/80">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
              <Building2 className="h-3.5 w-3.5 text-blue-400" />
              <span>{activeBranchName || 'Filial Operacional'}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Foto e Informações Principais */}
          <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
            {/* Foto do Produto */}
            <div className="relative h-36 w-36 sm:h-32 sm:w-32 shrink-0 rounded-2xl bg-slate-800/80 border border-slate-700/80 overflow-hidden flex items-center justify-center shadow-md">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                  <Package className="h-10 w-10 text-slate-600 mb-1" />
                  <span className="text-[10px] text-slate-400 font-medium">Sem foto</span>
                </div>
              )}

              {/* Tag de categoria flutuante */}
              {product.category && (
                <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[9px] font-semibold text-center bg-slate-950/80 backdrop-blur-xs text-slate-300 rounded-md py-0.5 truncate px-1">
                  {product.category}
                </span>
              )}
            </div>

            {/* Nome, SKU e Marca */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mb-1.5">
                {product.brand && (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {product.brand}
                  </span>
                )}
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
                  SKU: {product.sku || 'N/A'}
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                {product.name}
              </h2>

              {product.barcode && (
                <p className="text-[11px] font-mono text-slate-400 mt-1 flex items-center justify-center sm:justify-start gap-1">
                  <Tag className="h-3 w-3 text-slate-500" />
                  EAN: {product.barcode}
                </p>
              )}
            </div>
          </div>

          {/* Grid de Informações: Estoque e Preço */}
          <div className="grid grid-cols-2 gap-3">
            {/* Box: Estoque da Filial */}
            <div
              className={`rounded-2xl border p-3.5 flex flex-col justify-between ${
                isOutOfStock
                  ? 'border-rose-500/30 bg-rose-500/5'
                  : isLowStock
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-emerald-500/30 bg-emerald-500/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Estoque na Filial
                </span>
                {isOutOfStock ? (
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
              </div>

              <div className="mt-2">
                <div
                  className={`text-2xl font-black ${
                    isOutOfStock
                      ? 'text-rose-400'
                      : isLowStock
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {availableStock}
                  <span className="text-xs font-semibold text-slate-400 ml-1">
                    {product.unit || 'UN'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isOutOfStock
                    ? 'Indisponível nesta unidade'
                    : isLowStock
                    ? 'Estoque baixo'
                    : 'Pronta entrega'}
                </p>
              </div>
            </div>

            {/* Box: Preço de Venda Final */}
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                Preço de Venda
              </span>

              <div className="mt-2">
                <div className="text-2xl font-black text-white">
                  {salePrice.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </div>
                {hasWholesale ? (
                  <p className="text-[10px] text-emerald-400 font-medium mt-0.5 truncate">
                    Atacado: R$ {Number(product.wholesale_price).toFixed(2)} (a partir de{' '}
                    {product.wholesale_min_qty || 1} un)
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Preço final ao consumidor
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Destaque Comercial: Desconto Máximo do Vendedor */}
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                  <Percent className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold text-amber-200">
                  Desconto Máximo Permitido ao Vendedor
                </span>
              </div>
              <span className="text-sm font-black text-amber-300">
                {maxDiscountPct > 0 ? `${maxDiscountPct}%` : 'Sem desconto'}
              </span>
            </div>

            {maxDiscountPct > 0 ? (
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-amber-500/20">
                <div>
                  <span className="text-[10px] uppercase text-amber-300/80 font-medium">
                    Preço Mínimo Autorizado
                  </span>
                  <div className="text-base font-bold text-white">
                    {minPriceWithDiscount.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-amber-300/80 font-medium">
                    Margem de Negociação
                  </span>
                  <div className="text-sm font-semibold text-amber-400">
                    Até -
                    {maxDiscountValue.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                Este produto deve ser comercializado pelo valor de tabela sem aplicação de
                desconto direto.
              </p>
            )}
          </div>
        </div>

        {/* Footer com Ações de Venda Imediata */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 border-t border-slate-800 p-4 bg-slate-850/80">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onScanAnother && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose()
                  onScanAnother()
                }}
                className="flex-1 sm:flex-none border-slate-800 text-slate-300 hover:bg-slate-800 text-xs gap-1.5 h-10"
              >
                <Camera className="h-3.5 w-3.5 text-purple-400" />
                Escanear Próximo
              </Button>
            )}

            {onOpenLabelModal && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose()
                  onOpenLabelModal(product)
                }}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs h-10 px-3"
                title="Imprimir Etiqueta Térmica"
              >
                <Printer className="h-3.5 w-3.5 text-slate-400" />
              </Button>
            )}
          </div>

          <Button
            onClick={handleStartSale}
            className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-2 h-10 shadow-lg shadow-blue-600/25"
          >
            <ShoppingCart className="h-4 w-4" />
            Fazer Venda / Lançar Pedido
            <ArrowRight className="h-3.5 w-3.5 ml-auto sm:ml-0" />
          </Button>
        </div>
      </div>
    </div>
  )
}
