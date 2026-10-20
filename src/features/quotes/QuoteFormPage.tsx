import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  FileText,
  ArrowLeft,
  Save,
  Search,
  Barcode,
  Building2,
  User,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  Loader2,
  Layers,
  Camera,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { quoteService } from '@/lib/services/quote.service'
import { productService, type ProductWithBranchStock } from '@/lib/services/product.service'
import { customerService } from '@/lib/services/customer.service'
import type { Customer } from '@/types/customer'
import type { QuoteFormData, QuoteStatus, DiscountType } from '@/types/quote'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import { toast } from '@/hooks/useToast'
import { QrCameraScannerModal } from '@/components/shared/QrCameraScannerModal'
import { usePricingSettings } from '@/hooks/usePricingSettings'

interface CartItem {
  product: ProductWithBranchStock
  quantity: number
  unit_price: number
  price_type: 'retail' | 'wholesale' | 'custom'
  discount: number
  notes?: string
}

export function QuoteFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const [searchParams] = useSearchParams()
  const initialProductId = searchParams.get('add_product_id')

  const navigate = useNavigate()
  const { activeCompany, activeBranch, companies } = useAuth()
  const { pricingSettings, getMarkupPrice } = usePricingSettings()

  const currentCompanyData = companies.find((c) => c.company.id === activeCompany?.id)
  const availableBranches = currentCompanyData?.branches || []

  const [isLoading, setIsLoading] = useState(isEditing)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dados do Cabeçalho
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || '')
  const [validUntil, setValidUntil] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [status, setStatus] = useState<QuoteStatus>('draft')
  const [notes, setNotes] = useState<string>('')

  // Desconto Geral
  const [discountType, setDiscountType] = useState<DiscountType>('value')
  const [discountValue, setDiscountValue] = useState<number>(0)

  // Cliente
  const [customerMode, setCustomerMode] = useState<'registered' | 'custom'>('registered')
  const [customersList, setCustomersList] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customName, setCustomName] = useState('')
  const [customDoc, setCustomDoc] = useState('')
  const [customPhone, setCustomPhone] = useState('')
  const [customEmail, setCustomEmail] = useState('')

  // Carrinho de Produtos
  const [cart, setCart] = useState<CartItem[]>([])

  // Busca e Leitor USB de Código de Barras
  const [barcodeInput, setBarcodeInput] = useState('')
  const barcodeRef = useRef<HTMLInputElement>(null)

  // Scanner de Câmera (QR Code & Código de Barras)
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false)

  // Catálogo Rápido Modal / Busca
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogProducts, setCatalogProducts] = useState<ProductWithBranchStock[]>([])
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)

  // Carrega clientes da empresa
  useEffect(() => {
    async function loadCustomers() {
      if (!activeCompany?.id) return
      try {
        const res = await customerService.listCustomers(activeCompany.id, { pageSize: 100 })
        setCustomersList(res.data)
      } catch (err) {
        console.error('Erro ao buscar clientes:', err)
      }
    }
    loadCustomers()
  }, [activeCompany])

  // Se veio parâmetro add_product_id na URL
  useEffect(() => {
    async function addInitialProduct() {
      if (!initialProductId || !activeCompany?.id || !selectedBranchId) return
      try {
        const prods = await productService.fetchProductsWithBranchStock(
          activeCompany.id,
          selectedBranchId
        )
        const found = prods.find((p) => p.id === initialProductId)
        if (found) {
          addItemToCart(found, 1)
        }
      } catch (e) {
        console.error(e)
      }
    }
    addInitialProduct()
  }, [initialProductId, activeCompany, selectedBranchId])

  // Carrega orçamento para edição se houver ID
  useEffect(() => {
    async function loadQuote() {
      if (!isEditing || !id || !activeCompany?.id) return
      setIsLoading(true)
      try {
        const data = await quoteService.getQuote(id, activeCompany.id)
        if (data) {
          if (data.status === 'converted') {
            toast.error('Este orçamento já foi convertido em venda e não pode ser editado.')
            navigate('/comercial/orcamentos')
            return
          }

          setSelectedBranchId(data.branch_id)
          setValidUntil(data.valid_until)
          setStatus(data.status)
          setNotes(data.notes || '')
          setDiscountType(data.discount_type)
          setDiscountValue(data.discount_value)

          if (data.customer_id) {
            setCustomerMode('registered')
            setSelectedCustomer(data.customer || null)
          } else {
            setCustomerMode('custom')
            setCustomName(data.customer_name || '')
            setCustomDoc(data.customer_document || '')
            setCustomPhone(data.customer_phone || '')
            setCustomEmail(data.customer_email || '')
          }

          // Converte itens
          const branchProds = await productService.fetchProductsWithBranchStock(
            activeCompany.id,
            data.branch_id
          )
          const prodMap = new Map(branchProds.map((p) => [p.id, p]))

          const loadedCart: CartItem[] = (data.items || []).map((it) => {
            const prod = prodMap.get(it.product_id) || {
              id: it.product_id,
              company_id: data.company_id,
              name: it.product_name,
              sku: it.product_sku || null,
              barcode: it.product_barcode || null,
              category: null,
              unit: it.unit,
              cost_price: 0,
              sale_price: it.unit_price,
              min_stock: 0,
              status: 'active',
              created_at: '',
              updated_at: '',
              current_stock: 0,
              reserved_stock: 0,
              available_stock: 0,
            }

            return {
              product: prod,
              quantity: it.quantity,
              unit_price: it.unit_price,
              price_type: it.price_type,
              discount: it.discount,
              notes: it.notes || undefined,
            }
          })

          setCart(loadedCart)
        }
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Erro ao carregar dados do orçamento.')
      } finally {
        setIsLoading(false)
      }
    }

    loadQuote()
  }, [isEditing, id, activeCompany, navigate])

  // Função para adicionar item ao carrinho
  function addItemToCart(prod: ProductWithBranchStock, qtyToAdd = 1) {
    setCart((prev) => {
      const existingIdx = prev.findIndex((i) => i.product.id === prod.id)
      if (existingIdx >= 0) {
        const item = prev[existingIdx]
        const newQty = item.quantity + qtyToAdd

        // Recalcula preço unitário considerando regra de atacado
        let unitPrice = Number(prod.sale_price || 0)
        // Aplica markup se o preço de venda for zero e o toggle estiver ativo
        if (unitPrice === 0 && pricingSettings?.apply_markup_on_pdv && prod.cost_price > 0) {
          unitPrice = getMarkupPrice(prod.cost_price)
        }
        let priceType: 'retail' | 'wholesale' = 'retail'
        if (
          prod.wholesale_price &&
          prod.wholesale_min_qty &&
          newQty >= prod.wholesale_min_qty
        ) {
          unitPrice = prod.wholesale_price
          priceType = 'wholesale'
        }

        const updated = [...prev]
        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          unit_price: unitPrice,
          price_type: priceType,
        }
        return updated
      } else {
        // Novo item no carrinho
        let unitPrice = Number(prod.sale_price || 0)
        // Aplica markup se o preço de venda for zero e o toggle estiver ativo
        if (unitPrice === 0 && pricingSettings?.apply_markup_on_pdv && prod.cost_price > 0) {
          unitPrice = getMarkupPrice(prod.cost_price)
        }
        let priceType: 'retail' | 'wholesale' = 'retail'
        if (
          prod.wholesale_price &&
          prod.wholesale_min_qty &&
          qtyToAdd >= prod.wholesale_min_qty
        ) {
          unitPrice = prod.wholesale_price
          priceType = 'wholesale'
        }

        return [
          ...prev,
          {
            product: prod,
            quantity: qtyToAdd,
            unit_price: unitPrice,
            price_type: priceType,
            discount: 0,
          },
        ]
      }
    })

    toast.success(`Adicionado: ${prod.name}`)
  }

  // Atualiza quantidade de um item no carrinho
  function updateItemQuantity(prodId: string, newQty: number) {
    if (newQty <= 0) {
      removeItemFromCart(prodId)
      return
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== prodId) return item

        const prod = item.product
        let unitPrice = prod.sale_price
        let priceType: 'retail' | 'wholesale' = 'retail'

        if (
          prod.wholesale_price &&
          prod.wholesale_min_qty &&
          newQty >= prod.wholesale_min_qty
        ) {
          unitPrice = prod.wholesale_price
          priceType = 'wholesale'
        }

        return {
          ...item,
          quantity: newQty,
          unit_price: unitPrice,
          price_type: priceType,
        }
      })
    )
  }

  function removeItemFromCart(prodId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== prodId))
  }

  // Leitor USB de Código de Barras (KeyDown Enter)
  async function handleBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const code = barcodeInput.trim()
      if (!code || !activeCompany?.id || !selectedBranchId) return

      const found = await productService.findByBarcodeOrSku(
        activeCompany.id,
        selectedBranchId,
        code
      )
      if (found) {
        addItemToCart(found, 1)
        setBarcodeInput('')
      } else {
        toast.error(`Produto com código "${code}" não localizado.`)
      }
    }
  }

  // Leitor via Câmera do Smartphone / Webcam
  async function handleCameraScan(code: string) {
    if (!code || !activeCompany?.id || !selectedBranchId) return
    const found = await productService.findByBarcodeOrSku(
      activeCompany.id,
      selectedBranchId,
      code
    )
    if (found) {
      addItemToCart(found, 1)
      toast.success(`Adicionado via Câmera: ${found.name}`)
    } else {
      toast.error(`Produto com código "${code}" não localizado nesta filial.`)
    }
  }

  // Abertura do catálogo rápido
  async function handleOpenCatalog() {
    if (!activeCompany?.id || !selectedBranchId) return
    setIsCatalogOpen(true)
    setIsLoadingCatalog(true)
    try {
      const prods = await productService.fetchProductsWithBranchStock(
        activeCompany.id,
        selectedBranchId,
        { search: catalogSearch }
      )
      setCatalogProducts(prods)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingCatalog(false)
    }
  }

  // Recálculo em tempo real no cliente
  const calculations = useMemo(() => {
    let subtotal = 0
    for (const item of cart) {
      const itemSub = Math.round(item.unit_price * item.quantity * 100) / 100
      const itemTot = Math.max(0, Math.round((itemSub - item.discount) * 100) / 100)
      subtotal += itemTot
    }

    let generalDiscount = 0
    if (discountType === 'percentage') {
      generalDiscount = Math.round((subtotal * (discountValue / 100)) * 100) / 100
    } else {
      generalDiscount = Math.min(subtotal, Math.max(0, discountValue))
    }

    const total = Math.max(0, Math.round((subtotal - generalDiscount) * 100) / 100)

    return {
      subtotal,
      generalDiscount,
      total,
    }
  }, [cart, discountType, discountValue])

  // Submissão do Orçamento
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!activeCompany?.id) {
      setError('Empresa não selecionada.')
      return
    }

    if (!selectedBranchId) {
      setError('Selecione a filial emissora do orçamento.')
      return
    }

    if (cart.length === 0) {
      setError('O orçamento precisa conter pelo menos um produto adicionado.')
      toast.error('Adicione produtos ao orçamento antes de salvar.')
      return
    }

    setIsSaving(true)
    try {
      const payload: QuoteFormData = {
        id: isEditing ? id : undefined,
        company_id: activeCompany.id,
        branch_id: selectedBranchId,
        status,
        discount_type: discountType,
        discount_value: discountValue,
        notes,
        valid_until: validUntil,
        customer_id: customerMode === 'registered' ? selectedCustomer?.id || null : null,
        customer_name:
          customerMode === 'registered'
            ? selectedCustomer?.name || null
            : customName.trim() || null,
        customer_document:
          customerMode === 'registered'
            ? selectedCustomer?.document || null
            : customDoc.trim() || null,
        customer_phone:
          customerMode === 'registered'
            ? selectedCustomer?.phone || null
            : customPhone.trim() || null,
        customer_email:
          customerMode === 'registered'
            ? selectedCustomer?.email || null
            : customEmail.trim() || null,
        items: cart.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: i.discount,
          notes: i.notes,
        })),
      }

      const res = await quoteService.saveQuote(payload)
      toast.success(
        isEditing
          ? `Orçamento ${res.code} atualizado com sucesso!`
          : `Orçamento ${res.code} criado com sucesso!`
      )
      navigate('/comercial/orcamentos')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Falha ao salvar orçamento.')
      toast.error(err.message || 'Erro ao processar orçamento.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <LoadingState message="Carregando dados do orçamento..." />
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/comercial/orcamentos')}
            className="border-slate-800 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {isEditing ? 'Editar Orçamento' : 'Novo Orçamento Comercial'}
            </h1>
            <p className="text-xs text-slate-400">
              Cotação com cálculo automático de atacado, validação de regras comerciais e desconto
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => navigate('/comercial/orcamentos')}
          variant="outline"
          className="border-slate-800 text-slate-400 hover:text-white"
        >
          Cancelar
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seção 1: Filial Emissora & Prazos */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-slate-800 pb-3">
            <Building2 className="h-4 w-4 text-blue-400" />
            <span>Unidade Operacional e Prazos</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Filial Emissora *
              </label>
              <select
                required
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Validade da Proposta *
              </label>
              <Input
                type="date"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="bg-slate-800/80 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Status Inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as QuoteStatus)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="draft">Rascunho</option>
                <option value="sent">Enviado ao Cliente</option>
                <option value="approved">Aprovado pelo Cliente</option>
              </select>
            </div>
          </div>
        </div>

        {/* Seção 2: Identificação do Cliente */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <User className="h-4 w-4 text-emerald-400" />
              <span>Cliente do Orçamento</span>
            </div>

            {/* Alternador de Modo de Cliente */}
            <div className="flex rounded-xl bg-slate-850 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setCustomerMode('registered')}
                className={`rounded-lg px-3 py-1 font-semibold transition ${
                  customerMode === 'registered'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Cliente Cadastrado
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('custom')}
                className={`rounded-lg px-3 py-1 font-semibold transition ${
                  customerMode === 'custom'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Cliente Avulso
              </button>
            </div>
          </div>

          {customerMode === 'registered' ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Selecionar Cliente da Base
                </label>
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const found = customersList.find((c) => c.id === e.target.value)
                    setSelectedCustomer(found || null)
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Selecione um cliente cadastrado...</option>
                  {customersList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.document ? `(${c.document})` : ''} - Limite: R$ {c.credit_limit}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
                  <div>
                    <span className="font-bold text-white text-sm block">
                      {selectedCustomer.name}
                    </span>
                    <span className="text-slate-400">
                      Doc: {selectedCustomer.document || 'Não informado'} | Tel:{' '}
                      {selectedCustomer.phone || selectedCustomer.whatsapp || 'Não informado'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-slate-400 block">
                        Limite de Crédito
                      </span>
                      <span className="font-bold text-emerald-400">
                        R$ {selectedCustomer.credit_limit.toFixed(2)}
                      </span>
                    </div>

                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                        selectedCustomer.credit_status === 'available'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {selectedCustomer.credit_status === 'available' ? 'Liberado' : 'Bloqueado'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Nome do Cliente
                </label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="bg-slate-800/80 border-slate-700 text-white text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  CPF / CNPJ
                </label>
                <Input
                  value={customDoc}
                  onChange={(e) => setCustomDoc(e.target.value)}
                  placeholder="000.000.000-00"
                  className="bg-slate-800/80 border-slate-700 text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Telefone / WhatsApp
                </label>
                <Input
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="bg-slate-800/80 border-slate-700 text-white text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  E-mail
                </label>
                <Input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="bg-slate-800/80 border-slate-700 text-white text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Seção 3: Carrinho e Catálogo de Produtos */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Layers className="h-4 w-4 text-blue-400" />
              <span>Produtos e Itens da Cotação ({cart.length})</span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenCatalog}
              className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10 text-xs gap-1.5 h-8"
            >
              <Search className="h-3.5 w-3.5" />
              Pesquisar no Catálogo
            </Button>
          </div>

          {/* Bip USB Rápido & Scanner de Câmera */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 whitespace-nowrap">
              <Barcode className="h-4 w-4" />
              Leitor USB / Adição Rápida:
            </div>
            <div className="relative flex-1 w-full">
              <Input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Escaneie o código de barras ou digite o SKU e pressione Enter..."
                className="bg-slate-900 border-emerald-500/40 text-white text-xs font-mono pr-8 h-8"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCameraScannerOpen(true)}
              className="border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs font-semibold gap-1.5 h-8 shrink-0"
            >
              <Camera className="h-3.5 w-3.5 text-purple-400" />
              Câmera / Celular
            </Button>
          </div>

          {/* Tabela de Itens no Carrinho */}
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-10 text-center">
              <FileText className="h-10 w-10 text-slate-600 mb-2" />
              <p className="text-xs font-medium text-slate-300">Nenhum produto adicionado ainda</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Utilize o leitor USB acima ou o botão "Pesquisar no Catálogo" para incluir itens.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Produto</th>
                    <th className="p-3 text-center">Estoque Filial</th>
                    <th className="p-3 text-center w-32">Qtd</th>
                    <th className="p-3 text-right">Preço Unit.</th>
                    <th className="p-3 text-center">Regra</th>
                    <th className="p-3 text-right">Desc. Unit.</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {cart.map((item) => {
                    const itemSub = Math.round(item.unit_price * item.quantity * 100) / 100
                    const itemTot = Math.max(0, Math.round((itemSub - item.discount) * 100) / 100)
                    const isWholesale = item.price_type === 'wholesale'

                    return (
                      <tr key={item.product.id} className="hover:bg-slate-850/40">
                        <td className="p-3">
                          <div className="font-bold text-white">{item.product.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.product.sku && `SKU: ${item.product.sku} `}
                            {item.product.barcode && `| EAN: ${item.product.barcode}`}
                          </div>
                        </td>

                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold ${
                              item.product.available_stock > 0
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {item.product.available_stock} {item.product.unit}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateItemQuantity(item.product.id, item.quantity - 1)
                              }
                              className="h-6 w-6 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItemQuantity(
                                  item.product.id,
                                  Math.max(1, Number(e.target.value || 1))
                                )
                              }
                              className="w-14 text-center rounded bg-slate-800 border border-slate-700 py-1 text-xs text-white font-bold"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateItemQuantity(item.product.id, item.quantity + 1)
                              }
                              className="h-6 w-6 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="p-3 text-right font-medium text-slate-200">
                          {item.unit_price.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>

                        <td className="p-3 text-center">
                          {isWholesale ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                              <Sparkles className="h-2.5 w-2.5" />
                              Atacado
                            </span>
                          ) : (
                            <span className="inline-flex rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                              Varejo
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount || ''}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value || 0))
                              setCart((prev) =>
                                prev.map((it) =>
                                  it.product.id === item.product.id ? { ...it, discount: val } : it
                                )
                              )
                            }}
                            placeholder="0,00"
                            className="w-18 text-right rounded bg-slate-800 border border-slate-700 p-1 text-xs text-white font-mono"
                          />
                        </td>

                        <td className="p-3 text-right font-bold text-white">
                          {itemTot.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>

                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemFromCart(item.product.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                            title="Remover item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Seção 4: Totais e Desconto Geral */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Observações Comerciais & Condições de Pagamento
            </span>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Pagamento em 3x sem juros no cartão, entrega inclusa em até 48h, validade condicionada à disponibilidade..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-2">
              Resumo e Fechamento de Valores
            </span>

            <div className="flex justify-between text-xs text-slate-400">
              <span>Subtotal dos Itens:</span>
              <span className="font-semibold text-slate-200">
                {calculations.subtotal.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>
            </div>

            {/* Desconto Geral */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-400">Desconto Geral:</span>
              <div className="flex items-center gap-1.5">
                <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setDiscountType('value')}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      discountType === 'value'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    R$
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      discountType === 'percentage'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    %
                  </button>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value || 0)))}
                  placeholder="0,00"
                  className="w-24 text-right bg-slate-800 border-slate-700 text-white text-xs h-7"
                />
              </div>
            </div>

            {calculations.generalDiscount > 0 && (
              <div className="flex justify-between text-xs text-rose-400">
                <span>Desconto Aplicado:</span>
                <span className="font-semibold">
                  -
                  {calculations.generalDiscount.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
              </div>
            )}

            <div className="border-t border-slate-800 pt-3 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-200 uppercase">Total do Orçamento:</span>
              <span className="text-2xl font-black text-emerald-400">
                {calculations.total.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/comercial/orcamentos')}
            disabled={isSaving}
            className="border-slate-800 text-slate-400 hover:text-white"
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            disabled={isSaving || cart.length === 0}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium gap-2 shadow-lg shadow-blue-600/20"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Orçamento
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Modal / Gaveta de Catálogo Rápido */}
      {isCatalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-400" />
                <h3 className="text-base font-bold">Catálogo de Produtos da Filial</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <Input
                value={catalogSearch}
                onChange={(e) => {
                  setCatalogSearch(e.target.value)
                  if (activeCompany && selectedBranchId) {
                    productService
                      .fetchProductsWithBranchStock(activeCompany.id, selectedBranchId, {
                        search: e.target.value,
                      })
                      .then(setCatalogProducts)
                  }
                }}
                placeholder="Filtrar por nome, SKU, código de barras..."
                className="bg-slate-800 border-slate-700 text-white text-xs"
              />
            </div>

            {isLoadingCatalog ? (
              <LoadingState message="Buscando produtos..." />
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 scrollbar-thin">
                {catalogProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-800/60 transition"
                  >
                    <div>
                      <div className="font-semibold text-white text-xs">{p.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        SKU: {p.sku || '---'} | Estoque nesta filial:{' '}
                        <strong
                          className={p.available_stock > 0 ? 'text-emerald-400' : 'text-rose-400'}
                        >
                          {p.available_stock} {p.unit}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-bold text-white">
                          {p.sale_price.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </div>
                        {p.wholesale_price && (
                          <div className="text-[10px] text-emerald-400 font-medium">
                            Atacado: R$ {p.wholesale_price} (min. {p.wholesale_min_qty})
                          </div>
                        )}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          addItemToCart(p, 1)
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white h-7 px-2.5 text-xs gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal Leitor de Câmera */}
      <QrCameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={handleCameraScan}
        title="Escanear Código / QR para o Orçamento"
      />
    </div>
  )
}
