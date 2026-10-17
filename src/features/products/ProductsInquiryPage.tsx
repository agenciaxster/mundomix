import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Package,
  Search,
  Barcode,
  Building2,
  Tag,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Plus,
  FileText,
  RefreshCw,
  Sparkles,
  Zap,
  Camera,
  FileSpreadsheet,
  Trash2,
  QrCode,
  LayoutGrid,
  List,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { productService, type ProductWithBranchStock } from '@/lib/services/product.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import { toast } from '@/hooks/useToast'
import { QrCameraScannerModal } from '@/components/shared/QrCameraScannerModal'
import { ProductXlsImporterModal } from './modals/ProductXlsImporterModal'
import { ProductFormModal } from './modals/ProductFormModal'
import { ProductThermalLabelModal } from './modals/ProductThermalLabelModal'
import { ProductQuickScannedModal } from './modals/ProductQuickScannedModal'
import { ProductDeleteAuthModal } from './modals/ProductDeleteAuthModal'

export function ProductsInquiryPage() {
  const navigate = useNavigate()
  const { activeCompany, activeBranch } = useAuth()

  const [products, setProducts] = useState<ProductWithBranchStock[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filtros
  const [searchParams] = useSearchParams()
  const categoryParam = searchParams.get('category')
  const brandParam = searchParams.get('brand')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam || 'all')
  const [selectedBrand, setSelectedBrand] = useState<string>(brandParam || 'all')
  const [onlyInStock, setOnlyInStock] = useState(false)

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam)
    }
  }, [categoryParam])

  useEffect(() => {
    if (brandParam) {
      setSelectedBrand(brandParam)
    }
  }, [brandParam])

  // Modo de visualização: 'table' (Lista compacta ERP) ou 'cards' (Cards compactos)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    const saved = localStorage.getItem('mundomix_products_view_mode')
    return saved === 'cards' ? 'cards' : 'table'
  })

  function handleToggleViewMode(mode: 'table' | 'cards') {
    setViewMode(mode)
    localStorage.setItem('mundomix_products_view_mode', mode)
  }

  // Modais de Leitura de Câmera, Importador XLS e Cadastro Manual
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false)
  const [isXlsImporterOpen, setIsXlsImporterOpen] = useState(false)
  const [isProductFormOpen, setIsProductFormOpen] = useState(false)
  const [productToEdit, setProductToEdit] = useState<ProductWithBranchStock | null>(null)

  // Paginação
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Modal de Etiqueta Térmica QR Code
  const [selectedProductForLabel, setSelectedProductForLabel] = useState<ProductWithBranchStock | null>(null)
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false)

  // Modal de Consulta Rápida do Vendedor (após scan de QR Code / Código de Barras)
  const [scannedProductForQuickView, setScannedProductForQuickView] = useState<ProductWithBranchStock | null>(null)
  const [isQuickViewModalOpen, setIsQuickViewModalOpen] = useState(false)

  // Modal de Exclusão Restrita de Produto com Autorização de Gerente / Admin
  const [productToDelete, setProductToDelete] = useState<ProductWithBranchStock | null>(null)
  const [isDeleteAuthModalOpen, setIsDeleteAuthModalOpen] = useState(false)

  // Campo dedicado ao Leitor de Código de Barras USB
  const [barcodeInput, setBarcodeInput] = useState('')
  const barcodeRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(
    async (refresh = false) => {
      if (!activeCompany?.id || !activeBranch?.id) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const [prods, catBrand] = await Promise.all([
          productService.fetchProductsWithBranchStock(activeCompany.id, activeBranch.id, {
            search: searchTerm,
            category: selectedCategory,
            brand: selectedBrand,
            onlyInStock,
          }),
          productService.getCategoriesAndBrands(activeCompany.id),
        ])

        setProducts(prods)
        setCategories(catBrand.categories)
        setBrands(catBrand.brands)
      } catch (err: any) {
        console.error('Erro ao carregar catálogo de produtos:', err)
        toast.error(err.message || 'Erro ao carregar produtos.')
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [activeCompany, activeBranch, searchTerm, selectedCategory, selectedBrand, onlyInStock]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  // Reset de página ao alterar filtros
  useEffect(() => {
    setPage(1)
  }, [searchTerm, selectedCategory, selectedBrand, onlyInStock])

  // Paginação calculada
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize
    return products.slice(start, start + pageSize)
  }, [products, page, pageSize])

  // Trata leitura via leitor USB de código de barras (teclado + enter)
  async function handleBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const code = barcodeInput.trim()
      if (!code || !activeCompany?.id || !activeBranch?.id) return

      const found = await productService.findByBarcodeOrSku(activeCompany.id, activeBranch.id, code)
      if (found) {
        toast.success(`Produto localizado: ${found.name}`)
        setSearchTerm(found.name)
        setBarcodeInput('')
        setScannedProductForQuickView(found)
        setIsQuickViewModalOpen(true)
      } else {
        toast.error(`Código "${code}" não localizado no catálogo desta empresa.`)
      }
    }
  }

  // Trata leitura via Câmera do dispositivo / celular
  async function handleCameraScan(scannedCode: string) {
    if (!scannedCode || !activeCompany?.id || !activeBranch?.id) return

    const found = await productService.findByBarcodeOrSku(
      activeCompany.id,
      activeBranch.id,
      scannedCode
    )
    if (found) {
      toast.success(`Produto escaneado: ${found.name}`)
      setSearchTerm(found.name)
      setIsCameraScannerOpen(false)
      setScannedProductForQuickView(found)
      setIsQuickViewModalOpen(true)
    } else {
      toast.warning(`Código escaneado "${scannedCode}" não cadastrado na base.`)
      setSearchTerm(scannedCode)
    }
  }

  function handleCreateQuoteWithProduct(product: ProductWithBranchStock) {
    navigate(`/comercial/orcamentos/novo?add_product_id=${product.id}`)
  }

  function handleRequestDeleteProduct(product: ProductWithBranchStock) {
    setProductToDelete(product)
    setIsDeleteAuthModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Consulta de Produtos & Catálogo
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
              <Zap className="h-3 w-3" />
              Terminal do Vendedor
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pesquisa ágil de preços, atacado, códigos de barras e estoque disponível em tempo real
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsXlsImporterOpen(true)}
            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold gap-1.5 shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            Importar XLS
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCameraScannerOpen(true)}
            className="border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Camera className="h-4 w-4 text-purple-400" />
            Escanear Câmera
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/cadastros/categorias')}
            className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs gap-1.5"
            title="Gerenciar categorias e departamentos do catálogo"
          >
            <Layers className="h-3.5 w-3.5 text-blue-400" />
            Categorias
          </Button>

          <Button
            onClick={() => {
              setProductToEdit(null)
              setIsProductFormOpen(true)
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2 font-medium shadow-lg shadow-blue-600/20 text-xs"
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>

          <Button
            onClick={() => navigate('/comercial/orcamentos/novo')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 gap-1.5 font-medium text-xs"
          >
            <FileText className="h-3.5 w-3.5 text-blue-400" />
            Novo Orçamento
          </Button>
        </div>
      </div>

      {/* Identificação de Filial Ativa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Unidade Operacional Ativa
            </div>
            <div className="text-sm font-bold text-white">
              {activeBranch?.name || 'Filial não selecionada'} ({activeBranch?.code || '---'})
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
          🔒 <strong className="text-slate-200">Isolamento Garantido:</strong> O estoque exibido
          nesta tela corresponde estritamente à filial selecionada.
        </div>
      </div>

      {/* Leitor de Código de Barras USB & Barra de Pesquisa Rápida */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Leitor USB + Câmera */}
        <div className="relative md:col-span-1 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <Barcode className="h-4 w-4" />
                Leitor de Código / QR
              </label>
              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(true)}
                className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition"
              >
                <Camera className="h-3.5 w-3.5" />
                Abrir Câmera
              </button>
            </div>
            <div className="relative">
              <Input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Bipe ou digite o código + Enter..."
                className="bg-slate-900 border-emerald-500/50 text-white font-mono text-sm placeholder:text-slate-500 pr-10 focus:border-emerald-400 focus:ring-emerald-500/30"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-emerald-400">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400">
            <span>Pistola USB ou Leitor Óptico</span>
            <button
              type="button"
              onClick={() => setIsCameraScannerOpen(true)}
              className="text-purple-400 hover:underline inline-flex items-center gap-1"
            >
              Usar câmera do celular &rarr;
            </button>
          </div>
        </div>

        {/* Busca Convencional e Filtros */}
        <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por nome do produto, SKU, marca ou categoria..."
              className="pl-9 bg-slate-800/80 border-slate-700 text-white text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Categoria */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Marca */}
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Todas as Marcas</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {/* Checkbox Apenas com estoque */}
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              Apenas com estoque nesta filial
            </label>
          </div>
        </div>
      </div>

      {/* Barra de Contagem e Alternador de Modo de Visualização (Tabela vs Cards) */}
      {!isLoading && products.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <span>
              Exibindo <strong className="text-white font-semibold">{products.length}</strong>{' '}
              {products.length === 1 ? 'produto cadastrado' : 'produtos cadastrados'}
            </span>
            {(searchTerm || selectedCategory !== 'all' || selectedBrand !== 'all' || onlyInStock) && (
              <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400 border border-blue-500/20">
                Filtros ativos
              </span>
            )}
          </div>

          {/* Toggle de Visualização */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1 self-start sm:self-auto shadow-inner">
            <button
              type="button"
              onClick={() => handleToggleViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Visualização em Lista / Tabela Compacta ERP"
            >
              <List className="h-3.5 w-3.5" />
              <span>Lista / Tabela</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'cards'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Visualização em Cards Compactos"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Cards Compactos</span>
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo Principal: Loading, Vazio ou Lista (Tabela / Cards) */}
      {isLoading ? (
        <LoadingState message="Carregando catálogo de produtos..." />
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-500 mb-4 border border-slate-700/60">
            <Package className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhum produto encontrado nesta filial</h3>
          <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
            Seu catálogo opera exclusivamente com <strong>dados reais</strong>. Você pode importar
            seus produtos reais com estoque via planilha Excel (.xlsx / .xls) ou cadastrá-los manualmente.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <Button
              type="button"
              onClick={() => setIsXlsImporterOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-2 shadow-lg shadow-emerald-600/20"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Importar Planilha Excel (.xlsx)
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setProductToEdit(null)
                setIsProductFormOpen(true)
              }}
              className="border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 text-xs gap-1.5 font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              Cadastrar Produto Manual
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCameraScannerOpen(true)}
              className="border-purple-500/40 bg-purple-500/5 text-purple-300 hover:bg-purple-500/15 text-xs gap-1.5"
            >
              <Camera className="h-3.5 w-3.5 text-purple-400" />
              Escanear com a Câmera
            </Button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* ================= MODO 1: TABELA / LISTA COMPACTA ERP ================= */
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-850 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-3">Categoria / Marca</th>
                  <th className="py-3 px-3 text-right">Preço Varejo</th>
                  <th className="py-3 px-3 text-right">Atacado / Desc.</th>
                  <th className="py-3 px-3 text-center">Estoque Filial</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {paginatedProducts.map((p) => {
                  const hasWholesale = Boolean(p.wholesale_price && p.wholesale_price > 0)
                  const inStock = p.available_stock > 0
                  const hasMaxDiscount = Boolean(
                    p.max_discount_percentage && p.max_discount_percentage > 0
                  )

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-850/50 transition group"
                    >
                      {/* Foto, Nome e Códigos */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => {
                              setScannedProductForQuickView(p)
                              setIsQuickViewModalOpen(true)
                            }}
                            className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700/80 overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition flex items-center justify-center text-slate-500"
                            title="Clique para ver a ficha completa de venda"
                          >
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  ;(e.target as any).style.display = 'none'
                                }}
                              />
                            ) : (
                              <Package className="h-4 w-4 text-slate-500" />
                            )}
                          </div>
                          <div className="min-w-0 max-w-xs sm:max-w-md">
                            <div
                              onClick={() => {
                                setScannedProductForQuickView(p)
                                setIsQuickViewModalOpen(true)
                              }}
                              className="font-bold text-white group-hover:text-blue-400 transition cursor-pointer truncate text-sm"
                              title={p.name}
                            >
                              {p.name}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
                              {p.sku && <span>SKU: {p.sku}</span>}
                              {p.barcode && (
                                <span className="flex items-center gap-1">
                                  <Barcode className="h-3 w-3 text-slate-500" />
                                  {p.barcode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Categoria / Marca */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          {p.category && (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-700/60 truncate max-w-[140px]">
                              <Layers className="h-2.5 w-2.5 text-blue-400 shrink-0" />
                              {p.category}
                            </span>
                          )}
                          {p.brand && (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-700/60 truncate max-w-[140px]">
                              <Tag className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                              {p.brand}
                            </span>
                          )}
                          {!p.category && !p.brand && <span className="text-slate-500">—</span>}
                        </div>
                      </td>

                      {/* Preço Varejo */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-bold text-white text-sm">
                          {p.sale_price.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400">por {p.unit}</div>
                      </td>

                      {/* Atacado / Desconto */}
                      <td className="py-2.5 px-3 text-right">
                        {hasWholesale && (
                          <div className="text-emerald-400 font-semibold text-xs">
                            {p.wholesale_price?.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                            <div className="text-[10px] text-emerald-500/80 font-normal">
                              min. {p.wholesale_min_qty || 1} {p.unit}
                            </div>
                          </div>
                        )}
                        {hasMaxDiscount && (
                          <div className="text-[10px] text-amber-300/90 font-mono mt-0.5">
                            Desc. máx: {p.max_discount_percentage}%
                          </div>
                        )}
                        {!hasWholesale && !hasMaxDiscount && (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Estoque Filial */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            inStock
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {inStock ? (
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                          )}
                          {p.available_stock} {p.unit}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            p.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {p.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      {/* Ações Rápidas */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setProductToEdit(p)
                              setIsProductFormOpen(true)
                            }}
                            title="Editar dados deste produto"
                            className="text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 h-7 w-7 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setScannedProductForQuickView(p)
                              setIsQuickViewModalOpen(true)
                            }}
                            title="Ver ficha de venda do produto"
                            className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 h-7 w-7 p-0"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedProductForLabel(p)
                              setIsLabelModalOpen(true)
                            }}
                            title="Gerar e imprimir etiqueta térmica com QR Code"
                            className="border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs gap-1 h-7 px-2 font-medium"
                          >
                            <QrCode className="h-3.5 w-3.5 text-purple-400" />
                            <span className="hidden sm:inline">Etiqueta</span>
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleCreateQuoteWithProduct(p)}
                            title="Iniciar novo orçamento com este produto"
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1 h-7 px-2.5 shadow-sm"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Orçar</span>
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRequestDeleteProduct(p)}
                            title="Excluir este produto (requer autorização de Gerente/Admin)"
                            className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 h-7 w-7 p-0 ml-0.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= MODO 2: CARDS COMPACTOS REDESENHADOS ================= */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {paginatedProducts.map((p) => {
            const hasWholesale = Boolean(p.wholesale_price && p.wholesale_price > 0)
            const inStock = p.available_stock > 0
            const hasMaxDiscount = Boolean(
              p.max_discount_percentage && p.max_discount_percentage > 0
            )

            return (
              <div
                key={p.id}
                className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/85 p-3.5 transition hover:border-slate-700 hover:bg-slate-850 hover:shadow-lg"
              >
                <div>
                  {/* Top Bar: Tags & Status */}
                  <div className="flex items-center justify-between gap-1 mb-2 text-[10px]">
                    <div className="flex items-center gap-1 truncate">
                      {p.category && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 font-medium text-slate-300 border border-slate-700/60 truncate max-w-[90px]">
                          <Layers className="h-2.5 w-2.5 text-blue-400 shrink-0" />
                          <span className="truncate">{p.category}</span>
                        </span>
                      )}
                      {p.brand && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 font-medium text-slate-300 border border-slate-700/60 truncate max-w-[80px]">
                          <Tag className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                          <span className="truncate">{p.brand}</span>
                        </span>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                        p.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {p.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {/* Foto e Título */}
                  <div className="flex items-start gap-2.5">
                    <div
                      onClick={() => {
                        setScannedProductForQuickView(p)
                        setIsQuickViewModalOpen(true)
                      }}
                      className="h-11 w-11 rounded-lg bg-slate-800 border border-slate-700/80 overflow-hidden shrink-0 cursor-pointer hover:opacity-85 transition flex items-center justify-center text-slate-500"
                      title="Ver ficha de venda"
                    >
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            ;(e.target as any).style.display = 'none'
                          }}
                        />
                      ) : (
                        <Package className="h-5 w-5 text-slate-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3
                        onClick={() => {
                          setScannedProductForQuickView(p)
                          setIsQuickViewModalOpen(true)
                        }}
                        className="text-xs font-bold text-white group-hover:text-blue-400 transition leading-snug cursor-pointer line-clamp-2"
                        title={p.name}
                      >
                        {p.name}
                      </h3>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                        {p.sku && <span>SKU: {p.sku}</span>}
                        {p.barcode && !p.sku && (
                          <span className="flex items-center gap-0.5 truncate">
                            <Barcode className="h-3 w-3 text-slate-500 shrink-0" />
                            {p.barcode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bloco de Preços e Estoque Compacto */}
                  <div className="mt-2.5 rounded-lg border border-slate-800/80 bg-slate-950/70 p-2.5 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] text-slate-400">Varejo:</span>
                      <span className="text-sm font-black text-white">
                        {p.sale_price.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                        <span className="text-[10px] font-normal text-slate-400 ml-0.5">
                          /{p.unit}
                        </span>
                      </span>
                    </div>

                    {hasWholesale && (
                      <div className="flex items-baseline justify-between border-t border-slate-800/60 pt-1 text-[11px]">
                        <span className="text-emerald-400 font-medium">
                          Atacado (min {p.wholesale_min_qty}):
                        </span>
                        <span className="font-bold text-emerald-400">
                          {p.wholesale_price?.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      </div>
                    )}

                    {hasMaxDiscount && (
                      <div className="flex items-center justify-between border-t border-slate-800/60 pt-1 text-[10px] text-amber-300/90 font-mono">
                        <span>Desc. Máx:</span>
                        <span className="font-bold">{p.max_discount_percentage}%</span>
                      </div>
                    )}

                    {/* Estoque na Filial em linha */}
                    <div className="flex items-center justify-between border-t border-slate-800/60 pt-1 text-[11px]">
                      <span className="text-slate-400 text-[10px]">Estoque filial:</span>
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          inStock ? 'text-emerald-300' : 'text-rose-400'
                        }`}
                      >
                        {inStock ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {p.available_stock} {p.unit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: Ações Rápidas */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setProductToEdit(p)
                        setIsProductFormOpen(true)
                      }}
                      title="Editar dados deste produto"
                      className="text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 h-7 w-7 p-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setScannedProductForQuickView(p)
                        setIsQuickViewModalOpen(true)
                      }}
                      title="Ver ficha completa de venda"
                      className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 h-7 w-7 p-0"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedProductForLabel(p)
                        setIsLabelModalOpen(true)
                      }}
                      title="Gerar etiqueta térmica com QR Code"
                      className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-7 w-7 p-0"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRequestDeleteProduct(p)}
                      title="Excluir do catálogo (requer autorização de Gerente/Admin)"
                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleCreateQuoteWithProduct(p)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1 h-7 px-2.5 shadow-sm font-medium"
                  >
                    <FileText className="h-3 w-3" />
                    <span>Orçar</span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Barra de Paginação Unificada */}
      {products.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Mostrando{' '}
              <strong className="text-white">
                {Math.min((page - 1) * pageSize + 1, products.length)}
              </strong>{' '}
              a{' '}
              <strong className="text-white">
                {Math.min(page * pageSize, products.length)}
              </strong>{' '}
              de <strong className="text-white">{products.length}</strong> produtos
            </span>

            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
              <span className="text-[11px]">Exibir:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value={10}>10 por página</option>
                <option value={20}>20 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="h-8 w-8 p-0 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
              title="Primeira Página"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 p-0 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
              title="Página Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="px-2 text-slate-300 font-medium text-xs">
              Página <strong className="text-white">{page}</strong> de{' '}
              <strong className="text-white">{totalPages}</strong>
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 p-0 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
              title="Próxima Página"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="h-8 w-8 p-0 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
              title="Última Página"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal Leitor de Câmera (QR Code & Código de Barras) */}
      <QrCameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={handleCameraScan}
        title="Escanear Código com a Câmera"
      />

      {/* Modal Ficha / Consulta Rápida do Vendedor (após bipe / scan de QR Code) */}
      <ProductQuickScannedModal
        isOpen={isQuickViewModalOpen}
        onClose={() => setIsQuickViewModalOpen(false)}
        product={scannedProductForQuickView}
        activeBranchName={activeBranch?.name}
        onScanAnother={() => setIsCameraScannerOpen(true)}
        onOpenLabelModal={(prod) => {
          setSelectedProductForLabel(prod)
          setIsLabelModalOpen(true)
        }}
      />

      {/* Modal Gerador e Impressor de Etiquetas Térmicas com QR Code */}
      <ProductThermalLabelModal
        isOpen={isLabelModalOpen}
        onClose={() => {
          setIsLabelModalOpen(false)
          setSelectedProductForLabel(null)
        }}
        product={selectedProductForLabel}
      />

      {/* Modal Importador de Produtos XLS / XLSX / CSV */}
      <ProductXlsImporterModal
        isOpen={isXlsImporterOpen}
        onClose={() => setIsXlsImporterOpen(false)}
        onImportSuccess={() => loadData(true)}
      />

      {/* Modal Cadastro Manual / Edição de Produto */}
      <ProductFormModal
        isOpen={isProductFormOpen}
        onClose={() => {
          setIsProductFormOpen(false)
          setProductToEdit(null)
        }}
        onSuccess={() => {
          setProductToEdit(null)
          loadData(true)
        }}
        productToEdit={productToEdit}
        existingCategories={categories}
        existingBrands={brands}
      />

      {/* Modal de Exclusão de Produto com Senha de Gerente ou Administrador */}
      <ProductDeleteAuthModal
        isOpen={isDeleteAuthModalOpen}
        onClose={() => {
          setIsDeleteAuthModalOpen(false)
          setProductToDelete(null)
        }}
        onSuccess={() => loadData(true)}
        product={productToDelete}
      />
    </div>
  )
}
