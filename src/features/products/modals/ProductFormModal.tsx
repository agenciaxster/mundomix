import { useState, useEffect, useId } from 'react'
import {
  X,
  Package,
  Barcode,
  Camera,
  Layers,
  Tag,
  DollarSign,
  Boxes,
  Loader2,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  Percent,
  Pencil,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePricingSettings } from '@/hooks/usePricingSettings'
import { productService, type ProductWithBranchStock } from '@/lib/services/product.service'
import { categoryService } from '@/lib/services/category.service'
import type { Category } from '@/types/category'
import { CategoryFormModal } from '@/features/categories/modals/CategoryFormModal'
import { brandService } from '@/lib/services/brand.service'
import type { Brand } from '@/types/brand'
import { BrandFormModal } from '@/features/brands/modals/BrandFormModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'
import { QrCameraScannerModal } from '@/components/shared/QrCameraScannerModal'

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  existingCategories?: string[]
  existingBrands?: string[]
  productToEdit?: ProductWithBranchStock | null
}

const COMMON_UNITS = ['UN', 'CX', 'KG', 'PC', 'LT', 'PAR', 'MT', 'M2', 'FD', 'KIT', 'DZ']

export function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  existingCategories = [],
  existingBrands = [],
  productToEdit = null,
}: ProductFormModalProps) {
  const { activeCompany, activeBranch } = useAuth()
  const { pricingSettings, getMarkupPrice } = usePricingSettings()
  const catListId = useId()
  const brandListId = useId()

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [unit, setUnit] = useState('UN')
  const [costPrice, setCostPrice] = useState<string>('')
  const [salePrice, setSalePrice] = useState<string>('')
  const [wholesalePrice, setWholesalePrice] = useState<string>('')
  const [wholesaleMinQty, setWholesaleMinQty] = useState<string>('')
  const [maxDiscountPercentage, setMaxDiscountPercentage] = useState<string>('')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [minStock, setMinStock] = useState<string>('0')
  const [initialStock, setInitialStock] = useState<string>('0')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isBarcodeCameraOpen, setIsBarcodeCameraOpen] = useState(false)

  // Categorias registradas no banco de dados e modal rápido
  const [dbCategories, setDbCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  // Marcas registradas no banco de dados e modal rápido
  const [dbBrands, setDbBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState<string>('')
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false)

  useEffect(() => {
    if (isOpen && activeCompany?.id) {
      categoryService
        .listCategories(activeCompany.id, { status: 'active' })
        .then((cats) => setDbCategories(cats))
        .catch((err) => console.error('Erro ao carregar categorias para o modal:', err))

      brandService
        .listBrands(activeCompany.id, { status: 'active' })
        .then((brs) => setDbBrands(brs))
        .catch((err) => console.error('Erro ao carregar marcas para o modal:', err))
    }
  }, [isOpen, activeCompany?.id])

  // Preenche dados ao editar ou reseta ao abrir novo
  useEffect(() => {
    if (isOpen) {
      if (productToEdit) {
        setName(productToEdit.name || '')
        setSku(productToEdit.sku || '')
        setBarcode(productToEdit.barcode || '')
        setCategory(productToEdit.category || '')
        setSelectedCategoryId((productToEdit as any).category_id || '')
        setBrand(productToEdit.brand || '')
        setSelectedBrandId((productToEdit as any).brand_id || '')
        setUnit(productToEdit.unit || 'UN')
        setCostPrice(productToEdit.cost_price ? String(productToEdit.cost_price) : '')
        setSalePrice(productToEdit.sale_price ? String(productToEdit.sale_price) : '')
        setWholesalePrice(
          productToEdit.wholesale_price ? String(productToEdit.wholesale_price) : ''
        )
        setWholesaleMinQty(
          productToEdit.wholesale_min_qty ? String(productToEdit.wholesale_min_qty) : ''
        )
        setMaxDiscountPercentage(
          productToEdit.max_discount_percentage
            ? String(productToEdit.max_discount_percentage)
            : ''
        )
        setImageUrl(productToEdit.image_url || '')
        setMinStock(String(productToEdit.min_stock || 0))
        setInitialStock(
          String(productToEdit.available_stock ?? productToEdit.current_stock ?? 0)
        )
      } else {
        resetForm()
      }
    }
  }, [isOpen, productToEdit])

  function resetForm() {
    setName('')
    setSku('')
    setBarcode('')
    setCategory('')
    setSelectedCategoryId('')
    setBrand('')
    setSelectedBrandId('')
    setUnit('UN')
    setCostPrice('')
    setSalePrice('')
    setWholesalePrice('')
    setWholesaleMinQty('')
    setMaxDiscountPercentage('')
    setImageUrl('')
    setMinStock('0')
    setInitialStock('0')
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleGenerateSku() {
    const prefix = (category || 'PRD').slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'PRD')
    const random = Math.floor(1000 + Math.random() * 9000)
    setSku(`${prefix}-${random}`)
  }

  function handleCameraScan(code: string) {
    setBarcode(code)
    setIsBarcodeCameraOpen(false)
    toast.success(`Código escaneado: ${code}`)
  }

  // Margem de lucro em tempo real
  const cost = parseFloat(costPrice) || 0
  const sale = parseFloat(salePrice) || 0
  const profit = sale - cost
  const marginPct = cost > 0 ? (profit / cost) * 100 : null

  // Desconto máximo e menor preço de venda permitido
  const maxDiscountNum = parseFloat(maxDiscountPercentage) || 0
  const minSalePrice =
    sale > 0 && maxDiscountNum > 0 ? sale * (1 - maxDiscountNum / 100) : sale

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!activeCompany?.id || !activeBranch?.id) {
      toast.error('Empresa ou filial não selecionada.')
      return
    }

    if (!name.trim()) {
      toast.error('O nome do produto é obrigatório.')
      return
    }

    const saleNum = parseFloat(salePrice)
    if (isNaN(saleNum) || saleNum <= 0) {
      toast.error('Informe um preço de venda válido maior que zero.')
      return
    }

    setIsSubmitting(true)
    try {
      if (productToEdit) {
        await productService.updateProduct(activeCompany.id, productToEdit.id, activeBranch.id, {
          name: name.trim(),
          sku: sku.trim() || null,
          barcode: barcode.trim() || null,
          category: category.trim() || null,
          category_id: selectedCategoryId || null,
          brand: brand.trim() || null,
          brand_id: selectedBrandId || null,
          image_url: imageUrl.trim() || null,
          unit: unit.trim().toUpperCase() || 'UN',
          cost_price: parseFloat(costPrice) || 0,
          sale_price: saleNum,
          wholesale_price: parseFloat(wholesalePrice) || null,
          wholesale_min_qty: parseFloat(wholesaleMinQty) || null,
          max_discount_percentage: maxDiscountNum > 0 ? maxDiscountNum : 0,
          min_stock: parseFloat(minStock) || 0,
          current_stock: parseFloat(initialStock) || 0,
        })
        toast.success(`Produto "${name}" atualizado com sucesso!`)
      } else {
        await productService.createProduct(activeCompany.id, activeBranch.id, {
          name: name.trim(),
          sku: sku.trim() || null,
          barcode: barcode.trim() || null,
          category: category.trim() || null,
          category_id: selectedCategoryId || null,
          brand: brand.trim() || null,
          brand_id: selectedBrandId || null,
          image_url: imageUrl.trim() || null,
          unit: unit.trim().toUpperCase() || 'UN',
          cost_price: parseFloat(costPrice) || 0,
          sale_price: saleNum,
          wholesale_price: parseFloat(wholesalePrice) || null,
          wholesale_min_qty: parseFloat(wholesaleMinQty) || null,
          max_discount_percentage: maxDiscountNum > 0 ? maxDiscountNum : 0,
          min_stock: parseFloat(minStock) || 0,
          initial_stock: parseFloat(initialStock) || 0,
        })
        toast.success(`Produto "${name}" cadastrado com sucesso!`)
      }

      handleClose()
      onSuccess()
    } catch (err: any) {
      console.error('Erro ao salvar produto:', err)
      toast.error(err.message || 'Erro ao salvar produto.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
        <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-8">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/60">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  productToEdit
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : 'bg-blue-600/20 text-blue-400'
                }`}
              >
                {productToEdit ? <Pencil className="h-5 w-5" /> : <Package className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {productToEdit ? 'Editar Dados do Produto' : 'Cadastrar Produto Real'}
                </h2>
                <p className="text-xs text-slate-400">
                  Unidade:{' '}
                  <span className="text-slate-200 font-medium">
                    {activeBranch?.name || 'Filial Ativa'}
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Nome do Produto */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nome do Produto <span className="text-rose-400">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Parafuso Sextavado 1/4 x 2, Cabo HDMI 2.0, Smartphone X..."
                required
                className="bg-slate-800/80 border-slate-700 text-white text-sm focus:border-blue-500"
              />
            </div>

            {/* Código de Barras e SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    <Barcode className="h-3.5 w-3.5 text-emerald-400" />
                    Código de Barras / EAN
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsBarcodeCameraOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition"
                  >
                    <Camera className="h-3 w-3" />
                    Escanear
                  </button>
                </div>
                <div className="relative">
                  <Input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="789... ou bipe com leitor"
                    className="bg-slate-800/80 border-slate-700 text-white font-mono text-sm pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setIsBarcodeCameraOpen(true)}
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-purple-400"
                    title="Abrir câmera para escanear"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    SKU / Código Interno
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateSku}
                    className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition"
                  >
                    <Sparkles className="h-3 w-3" />
                    Gerar SKU
                  </button>
                </div>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Ex: ELE-1002"
                  className="bg-slate-800/80 border-slate-700 text-white font-mono text-sm"
                />
              </div>
            </div>

            {/* Categoria, Marca e Unidade */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    <Layers className="h-3.5 w-3.5 text-blue-400" />
                    Categoria
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition"
                    title="Cadastrar nova categoria no catálogo"
                  >
                    + Nova
                  </button>
                </div>
                <Input
                  list={catListId}
                  value={category}
                  onChange={(e) => {
                    const val = e.target.value
                    setCategory(val)
                    const matched = dbCategories.find(
                      (c) => c.name.toLowerCase() === val.trim().toLowerCase()
                    )
                    setSelectedCategoryId(matched ? matched.id : '')
                  }}
                  placeholder="Selecione ou digite..."
                  className="bg-slate-800/80 border-slate-700 text-white text-xs"
                />
                <datalist id={catListId}>
                  {dbCategories.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                  {existingCategories
                    .filter(
                      (c) =>
                        !dbCategories.some((dc) => dc.name.toLowerCase() === c.toLowerCase())
                    )
                    .map((c) => (
                      <option key={c} value={c} />
                    ))}
                </datalist>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    <Tag className="h-3.5 w-3.5 text-amber-400" />
                    Marca / Fabricante
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsBrandModalOpen(true)}
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition"
                    title="Cadastrar nova marca no catálogo"
                  >
                    + Nova
                  </button>
                </div>
                <Input
                  list={brandListId}
                  value={brand}
                  onChange={(e) => {
                    const val = e.target.value
                    setBrand(val)
                    const matched = dbBrands.find(
                      (b) => b.name.toLowerCase() === val.trim().toLowerCase()
                    )
                    setSelectedBrandId(matched ? matched.id : '')
                  }}
                  placeholder="Selecione ou digite..."
                  className="bg-slate-800/80 border-slate-700 text-white text-xs"
                />
                <datalist id={brandListId}>
                  {dbBrands.map((b) => (
                    <option key={b.id} value={b.name} />
                  ))}
                  {existingBrands
                    .filter(
                      (b) =>
                        !dbBrands.some((db) => db.name.toLowerCase() === b.toLowerCase())
                    )
                    .map((b) => (
                      <option key={b} value={b} />
                    ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Unidade
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none h-9"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* URL da Foto do Produto */}
            <div className="rounded-2xl border border-slate-800 bg-slate-850/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  <ImageIcon className="h-3.5 w-3.5 text-purple-400" />
                  Foto do Produto (URL da Imagem)
                </label>
                <span className="text-[10px] text-slate-400">
                  Aparece no leitor e no catálogo móvel
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://exemplo.com/fotos/produto.jpg"
                  className="bg-slate-900 border-slate-700 text-white text-xs flex-1"
                />
                {imageUrl && (
                  <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt="Prévia"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        ;(e.target as any).style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Preços: Custo, Venda e Margem */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                  Precificação & Margens
                </span>
                {marginPct !== null && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      profit >= 0
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    Lucro: R$ {profit.toFixed(2)} ({marginPct.toFixed(1)}%)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Preço de Custo (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0,00"
                    className="bg-slate-900 border-slate-700 text-white font-mono text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">
                      Preço de Venda Varejo (R$) <span className="text-rose-400">*</span>
                    </label>
                    {pricingSettings && pricingSettings.default_markup_percentage > 0 && cost > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const suggested = getMarkupPrice(cost)
                          setSalePrice(suggested.toFixed(2))
                          toast.success(`Preço calculado com ${pricingSettings.default_markup_percentage}% de markup: R$ ${suggested.toFixed(2)}`)
                        }}
                        className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition underline underline-offset-2"
                        title={`Aplicar markup padrão de ${pricingSettings.default_markup_percentage}%`}
                      >
                        + Aplicar Markup ({pricingSettings.default_markup_percentage}%)
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="0,00"
                    required
                    className="bg-slate-900 border-emerald-500/50 text-white font-mono text-sm focus:border-emerald-400 font-bold"
                  />
                </div>
              </div>

              {/* Desconto Máximo Autorizado ao Vendedor */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 uppercase tracking-wider">
                    <Percent className="h-3.5 w-3.5 text-amber-400" />
                    Desconto Máximo Autorizado (%)
                  </label>
                  {maxDiscountNum > 0 && sale > 0 && (
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                      Preço Mínimo: R$ {minSalePrice.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={maxDiscountPercentage}
                    onChange={(e) => setMaxDiscountPercentage(e.target.value)}
                    placeholder="Ex: 10% (deixe 0 se não permitir)"
                    className="bg-slate-900 border-amber-500/30 text-white font-mono text-xs focus:border-amber-400"
                  />
                  <p className="text-[11px] text-slate-400">
                    Limite máximo que o vendedor pode ceder na leitura do QR Code / PDV.
                  </p>
                </div>
              </div>

              {/* Preço de Atacado Opcional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                <div>
                  <label className="block text-xs font-medium text-emerald-400 mb-1">
                    Preço de Atacado (R$ - opcional)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)}
                    placeholder="Ex: 85,00"
                    className="bg-slate-900 border-slate-700 text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-emerald-400 mb-1">
                    Qtd Mínima p/ Atacado
                  </label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={wholesaleMinQty}
                    onChange={(e) => setWholesaleMinQty(e.target.value)}
                    placeholder="Ex: 5"
                    className="bg-slate-900 border-slate-700 text-white font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Estoque Inicial da Filial e Mínimo */}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5" />
                Estoque da Unidade ({activeBranch?.name})
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Estoque Inicial Nesta Filial ({unit})
                  </label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    placeholder="0"
                    className="bg-slate-900 border-blue-500/40 text-white font-mono text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Saldo disponível imediatamente nesta filial.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Estoque Mínimo de Alerta
                  </label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    placeholder="0"
                    className="bg-slate-900 border-slate-700 text-white font-mono text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Gera aviso quando o saldo atingir este valor.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting}
                className={`${
                  productToEdit
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                } text-white text-xs font-semibold gap-2 shadow-lg px-5`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {productToEdit ? 'Salvar Alterações' : 'Cadastrar Produto'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Scanner Câmera para Código de Barras */}
      <QrCameraScannerModal
        isOpen={isBarcodeCameraOpen}
        onClose={() => setIsBarcodeCameraOpen(false)}
        onScan={handleCameraScan}
        title="Escanear Código de Barras do Produto"
      />

      {/* Modal Rápido de Cadastro de Categoria */}
      <CategoryFormModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSuccess={(newCat) => {
          if (newCat) {
            setDbCategories((prev) => [newCat, ...prev.filter((c) => c.id !== newCat.id)])
            setCategory(newCat.name)
            setSelectedCategoryId(newCat.id)
            toast.success(`Categoria "${newCat.name}" vinculada ao produto!`)
          }
        }}
      />

      {/* Modal Rápido de Cadastro de Marca */}
      <BrandFormModal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        onSuccess={(newBrand) => {
          if (newBrand) {
            setDbBrands((prev) => [newBrand, ...prev.filter((b) => b.id !== newBrand.id)])
            setBrand(newBrand.name)
            setSelectedBrandId(newBrand.id)
            toast.success(`Marca "${newBrand.name}" vinculada ao produto!`)
          }
        }}
      />
    </>
  )
}
