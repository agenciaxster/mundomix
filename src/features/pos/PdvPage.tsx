import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Calculator,
  Search,
  Barcode,
  Camera,
  Package,
  Trash2,
  Plus,
  Minus,
  User,
  AlertCircle,
  FileText,
  Clock,
  CreditCard,
  Maximize2,
  Minimize2,
  X,
  Unlock,
  Lock,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { productService, type ProductWithBranchStock } from '@/lib/services/product.service'
import { customerService } from '@/lib/services/customer.service'
import { quoteService } from '@/lib/services/quote.service'
import { saleService } from '@/lib/services/sale.service'
import { cashRegisterService } from '@/lib/services/cash-register.service'
import type { CashSession, CashMovementType } from '@/types/cash-register'
import type { Customer } from '@/types/customer'
import type { Quote } from '@/types/quote'
import type { DiscountType, PaymentMethod } from '@/types/sale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

// Modais do PDV
import { PaymentModal } from './modals/PaymentModal'
import { SaleSuccessModal } from './modals/SaleSuccessModal'
import { ImportQuoteModal } from './modals/ImportQuoteModal'
import { ProductSearchModal } from './modals/ProductSearchModal'
import { ClearCartConfirmModal } from './modals/ClearCartConfirmModal'
import { ReceiptPreviewModal } from './modals/ReceiptPreviewModal'
import { QrCameraScannerModal } from '@/components/shared/QrCameraScannerModal'
import { OpenCashSessionModal } from '@/features/cash-register/modals/OpenCashSessionModal'
import { CashMovementModal } from '@/features/cash-register/modals/CashMovementModal'
import { CloseCashSessionModal } from '@/features/cash-register/modals/CloseCashSessionModal'
import { CashReportModal } from '@/features/cash-register/modals/CashReportModal'
import type { Sale } from '@/types/sale'

export interface PosCartItem {
  product: ProductWithBranchStock
  quantity: number
  unit_price: number
  price_type: 'retail' | 'wholesale'
  discount: number
  notes?: string
}

export function PdvPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const quoteIdParam = searchParams.get('quote_id')

  const { activeCompany, activeBranch, user, profile, activeRole } = useAuth()

  // Estado do Carrinho
  const [cart, setCart] = useState<PosCartItem[]>([])

  // Cliente
  const [_customerMode, setCustomerMode] = useState<'unidentified' | 'registered'>('unidentified')
  const [customersList, setCustomersList] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customCustomerName, setCustomCustomerName] = useState('')
  const [customCustomerDoc, setCustomCustomerDoc] = useState('')
  const [isCustomerSelectorOpen, setIsCustomerSelectorOpen] = useState(false)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')

  // Desconto Geral da Venda
  const [discountType, setDiscountType] = useState<DiscountType>('value')
  const [discountValue, setDiscountValue] = useState<number>(0)

  // Orçamento Vinculado
  const [linkedQuoteId, setLinkedQuoteId] = useState<string | null>(null)
  const [linkedQuoteCode, setLinkedQuoteCode] = useState<string | null>(null)

  // Input de Código de Barras / SKU / Multiplicador (ex: 3*789...)
  const [barcodeInput, setBarcodeInput] = useState('')
  const barcodeRef = useRef<HTMLInputElement>(null)

  // Modais de Controle
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false)
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false)
  const [isImportQuoteOpen, setIsImportQuoteOpen] = useState(false)
  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isSubmittingSale, setIsSubmittingSale] = useState(false)

  // Modal de Venda Concluída
  const [isSaleSuccessOpen, setIsSaleSuccessOpen] = useState(false)
  const [lastSaleResult, setLastSaleResult] = useState<{
    saleId: string
    code: string
    total: number
    change: number
    methods: string[]
  } | null>(null)

  // Modal de Impressão do Comprovante Não Fiscal (Etapa 10)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false)

  // Controle de Caixa (Etapa 11)
  const [currentCashSession, setCurrentCashSession] = useState<CashSession | null>(null)
  const [isOpenCashModalOpen, setIsOpenCashModalOpen] = useState(false)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [movementModalType, setMovementModalType] = useState<CashMovementType>('supply')
  const [isCloseCashModalOpen, setIsCloseCashModalOpen] = useState(false)
  const [closedSessionForReport, setClosedSessionForReport] = useState<CashSession | null>(null)

  // Carrega sessão de caixa aberta para esta filial e operador
  const loadCashSession = useCallback(async () => {
    if (!activeCompany?.id || !activeBranch?.id) return
    try {
      const sess = await cashRegisterService.getCurrentOpenSession(
        activeCompany.id,
        activeBranch.id,
        user?.id
      )
      setCurrentCashSession(sess)
    } catch (err) {
      console.warn('Aviso ao consultar caixa no PDV:', err)
    }
  }, [activeCompany?.id, activeBranch?.id, user?.id])

  useEffect(() => {
    loadCashSession()
  }, [loadCashSession])

  // Modo tela cheia
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Relógio do Caixa
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Foco inicial no campo de código de barras
  useEffect(() => {
    barcodeRef.current?.focus()
  }, [])

  // Carrega clientes da empresa
  useEffect(() => {
    async function loadCustomers() {
      if (!activeCompany?.id) return
      try {
        const res = await customerService.listCustomers(activeCompany.id, { pageSize: 150 })
        setCustomersList(res.data)
      } catch (err) {
        console.error('Erro ao buscar clientes no PDV:', err)
      }
    }
    loadCustomers()
  }, [activeCompany?.id])

  // Se veio parâmetro ?quote_id=... na URL, carrega o orçamento no PDV
  useEffect(() => {
    async function loadInitialQuote() {
      if (!quoteIdParam || !activeCompany?.id) return
      try {
        const quote = await quoteService.getQuote(quoteIdParam, activeCompany.id)
        if (quote) {
          handleImportQuote(quote)
          toast.success(`Orçamento ${quote.code} carregado no PDV!`)
        }
      } catch (err) {
        console.error('Erro ao importar orçamento inicial:', err)
      }
    }
    loadInitialQuote()
  }, [quoteIdParam, activeCompany?.id])

  // Atalhos Globais de Teclado (F2, F4, F7, F8, F10)
  useEffect(() => {
    function handleGlobalKeys(e: KeyboardEvent) {
      // Se algum modal estiver aberto ou digitando em campo de texto comum (exceto o barcodeRef)
      if (isPaymentModalOpen || isSaleSuccessOpen || isClearCartConfirmOpen) return

      if (e.key === 'F2') {
        e.preventDefault()
        setIsProductSearchOpen(true)
      } else if (e.key === 'F4') {
        e.preventDefault()
        setIsCustomerSelectorOpen((prev) => !prev)
      } else if (e.key === 'F7') {
        e.preventDefault()
        if (cart.length > 0) setIsClearCartConfirmOpen(true)
      } else if (e.key === 'F8') {
        e.preventDefault()
        setIsImportQuoteOpen(true)
      } else if (e.key === 'F10') {
        e.preventDefault()
        if (cart.length > 0) {
          if (!currentCashSession) {
            toast.error('Caixa fechado! É obrigatório abrir o caixa para realizar vendas.')
            setIsOpenCashModalOpen(true)
          } else {
            setIsPaymentModalOpen(true)
          }
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeys)
    return () => window.removeEventListener('keydown', handleGlobalKeys)
  }, [isPaymentModalOpen, isSaleSuccessOpen, isClearCartConfirmOpen, cart.length, currentCashSession])

  // Função para adicionar produto ao carrinho com regra de atacado
  function addProductToCart(prod: ProductWithBranchStock, quantityToAdd = 1) {
    if (quantityToAdd <= 0) return

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === prod.id)

      if (existingIndex >= 0) {
        const existingItem = prevCart[existingIndex]
        const newQty = existingItem.quantity + quantityToAdd

        // Recalcula atacado vs varejo
        let unitPrice = Number(prod.sale_price || 0)
        let priceType: 'retail' | 'wholesale' = 'retail'

        if (
          prod.wholesale_price &&
          prod.wholesale_price > 0 &&
          ((prod.wholesale_min_qty && newQty >= prod.wholesale_min_qty) ||
           (!prod.wholesale_min_qty && newQty >= 5))
        ) {
          unitPrice = Number(prod.wholesale_price)
          priceType = 'wholesale'
        }

        const updated = [...prevCart]
        updated[existingIndex] = {
          ...existingItem,
          quantity: newQty,
          unit_price: unitPrice,
          price_type: priceType,
        }
        return updated
      } else {
        // Novo item
        let unitPrice = Number(prod.sale_price || 0)
        let priceType: 'retail' | 'wholesale' = 'retail'

        if (
          prod.wholesale_price &&
          prod.wholesale_price > 0 &&
          ((prod.wholesale_min_qty && quantityToAdd >= prod.wholesale_min_qty) ||
           (!prod.wholesale_min_qty && quantityToAdd >= 5))
        ) {
          unitPrice = Number(prod.wholesale_price)
          priceType = 'wholesale'
        }

        return [
          ...prevCart,
          {
            product: prod,
            quantity: quantityToAdd,
            unit_price: unitPrice,
            price_type: priceType,
            discount: 0,
          },
        ]
      }
    })

    // Feedback sonoro/visual
    toast.success(`+ ${quantityToAdd}x ${prod.name}`)
    barcodeRef.current?.focus()
  }

  // Alteração de quantidade de um item
  function updateItemQty(prodId: string, newQty: number) {
    if (newQty <= 0) {
      removeItem(prodId)
      return
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== prodId) return item

        const prod = item.product
        let unitPrice = Number(prod.sale_price || 0)
        let priceType: 'retail' | 'wholesale' = 'retail'

        if (
          prod.wholesale_price &&
          prod.wholesale_price > 0 &&
          ((prod.wholesale_min_qty && newQty >= prod.wholesale_min_qty) ||
           (!prod.wholesale_min_qty && newQty >= 5))
        ) {
          unitPrice = Number(prod.wholesale_price)
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

  // Remoção de item
  function removeItem(prodId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== prodId))
  }

  // Processa leitor de código de barras ou multiplicador (ex: 3*789... ou 789...)
  async function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input = barcodeInput.trim()
    if (!input || !activeCompany?.id || !activeBranch?.id) return

    let quantity = 1
    let queryCode = input

    // Verifica se possui sintaxe de multiplicador: QTD*CODIGO
    if (input.includes('*')) {
      const parts = input.split('*')
      const parsedQty = parseFloat(parts[0])
      if (!isNaN(parsedQty) && parsedQty > 0) {
        quantity = parsedQty
        queryCode = parts.slice(1).join('*').trim()
      }
    }

    try {
      const found = await productService.findByBarcodeOrSku(
        activeCompany.id,
        activeBranch.id,
        queryCode
      )

      if (found) {
        addProductToCart(found, quantity)
        setBarcodeInput('')
      } else {
        toast.error(`Produto com código "${queryCode}" não localizado nesta filial.`)
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao consultar código de barras.')
    }
  }

  // Importar Orçamento no PDV
  async function handleImportQuote(quote: Quote) {
    if (!activeCompany?.id || !activeBranch?.id) return

    // Preenche cliente
    if (quote.customer_id && quote.customer) {
      setCustomerMode('registered')
      setSelectedCustomer(quote.customer)
    } else if (quote.customer_name) {
      setCustomerMode('registered')
      setCustomCustomerName(quote.customer_name)
      setCustomCustomerDoc(quote.customer_document || '')
    }

    setLinkedQuoteId(quote.id)
    setLinkedQuoteCode(quote.code)

    // Desconto global do orçamento
    if (quote.discount_value > 0) {
      setDiscountType(quote.discount_type)
      setDiscountValue(quote.discount_value)
    }

    // Carrega itens e revalida estoque
    if (quote.items && quote.items.length > 0) {
      const branchProds = await productService.fetchProductsWithBranchStock(
        activeCompany.id,
        activeBranch.id
      )

      const importedItems: PosCartItem[] = []

      for (const qi of quote.items) {
        const prod = branchProds.find((p) => p.id === qi.product_id)
        if (prod) {
          const qty = Number(qi.quantity || 1)
          let unitPrice = Number(prod.sale_price || 0)
          let priceType: 'retail' | 'wholesale' = 'retail'

          if (
            prod.wholesale_price &&
            prod.wholesale_price > 0 &&
            ((prod.wholesale_min_qty && qty >= prod.wholesale_min_qty) ||
             (!prod.wholesale_min_qty && qty >= 5))
          ) {
            unitPrice = Number(prod.wholesale_price)
            priceType = 'wholesale'
          }

          importedItems.push({
            product: prod,
            quantity: qty,
            unit_price: unitPrice,
            price_type: priceType,
            discount: Number(qi.discount || 0),
          })
        }
      }

      setCart(importedItems)
      toast.success(`${importedItems.length} itens do orçamento ${quote.code} carregados!`)
    }
  }

  // Cálculos do Carrinho
  const totals = useMemo(() => {
    let subtotal = 0
    let totalItems = cart.length
    let totalUnits = 0

    for (const item of cart) {
      totalUnits += item.quantity
      const itemSub = Math.round(item.unit_price * item.quantity * 100) / 100
      const itemTot = Math.max(0, Math.round((itemSub - item.discount) * 100) / 100)
      subtotal += itemTot
    }

    let discountAmount = 0
    if (discountType === 'percentage') {
      discountAmount = Math.round(subtotal * (Math.min(100, Math.max(0, discountValue)) / 100) * 100) / 100
    } else {
      discountAmount = Math.min(subtotal, Math.max(0, discountValue))
    }

    const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100)

    return {
      subtotal,
      discountAmount,
      total,
      totalItems,
      totalUnits,
    }
  }, [cart, discountType, discountValue])

  // Finalização Atômica da Venda
  async function handleConfirmSale(payments: any[], receivableConfig?: any) {
    if (!activeCompany?.id || !activeBranch?.id) {
      toast.error('Empresa ou filial não selecionada.')
      return
    }

    if (cart.length === 0) {
      toast.error('O carrinho está vazio.')
      return
    }

    if (!currentCashSession) {
      toast.error('Caixa fechado! É obrigatório abrir o caixa para finalizar a venda.')
      setIsOpenCashModalOpen(true)
      return
    }

    setIsSubmittingSale(true)
    const idempotencyKey = crypto.randomUUID()

    try {
      const res = await saleService.finalizeSale({
        company_id: activeCompany.id,
        branch_id: activeBranch.id,
        cash_session_id: currentCashSession.id,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || customCustomerName || null,
        customer_document: selectedCustomer?.document || customCustomerDoc || null,
        discount_type: discountType,
        discount_value: discountValue,
        items: cart.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          discount: i.discount,
        })),
        payments: payments.map((p) => ({
          payment_method: p.payment_method as PaymentMethod,
          amount: p.amount,
          received_amount: p.received_amount,
          installments: p.installments,
        })),
        quote_id: linkedQuoteId || null,
        idempotency_key: idempotencyKey,
        notes: linkedQuoteCode ? `Venda originada do orçamento ${linkedQuoteCode}` : null,
        receivable_config: receivableConfig || null,
      })

      // Sucesso!
      const saleId = res.sale_id
      setIsPaymentModalOpen(false)
      setLastSaleResult({
        saleId,
        code: res.sale_code,
        total: res.total,
        change: res.change_amount || 0,
        methods: payments.map((p) => p.payment_method),
      })

      // Atualiza status do caixa
      loadCashSession()

      // Pré-carrega a venda completa persistida para emissão do comprovante térmico
      saleService
        .getSale(saleId, activeCompany.id)
        .then((fullSale) => {
          if (fullSale) setCompletedSale(fullSale)
        })
        .catch((e) => console.warn('Aviso ao carregar venda para comprovante:', e))

      setIsSaleSuccessOpen(true)
      resetPos()
    } catch (err: any) {
      console.error('Erro ao finalizar venda no PDV:', err)
      toast.error(err.message || 'Falha ao processar venda no PDV.')
    } finally {
      setIsSubmittingSale(false)
    }
  }

  function resetPos() {
    setCart([])
    setSelectedCustomer(null)
    setCustomerMode('unidentified')
    setCustomCustomerName('')
    setCustomCustomerDoc('')
    setDiscountValue(0)
    setLinkedQuoteId(null)
    setLinkedQuoteCode(null)
    setBarcodeInput('')
    setTimeout(() => {
      barcodeRef.current?.focus()
    }, 150)
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4.2rem)] -m-4 sm:-m-6 bg-slate-950 text-white select-none overflow-hidden">
      {/* ─── TOPO DO PDV: Barra de Informações do Caixa ───────────────────── */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-tight text-white uppercase">PDV Caixa</h1>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[10px] font-bold text-blue-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Operacional
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {activeCompany?.trade_name || activeCompany?.legal_name || 'MundoMix'} &bull;{' '}
                <span className="text-slate-200">{activeBranch?.name || 'Filial Principal'}</span>
              </p>
            </div>
          </div>

          {/* Status do Caixa e Ações Rápidas */}
          <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-4">
            {currentCashSession ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <div className="text-left text-xs leading-none">
                    <span className="font-bold font-mono">Caixa Aberto ({currentCashSession.terminal_name})</span>
                    <span className="text-[10px] text-emerald-400/80 block mt-0.5">
                      Fundo Inicial: R$ {currentCashSession.initial_amount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setMovementModalType('supply')
                      setIsMovementModalOpen(true)
                    }}
                    className="h-7 px-2 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20"
                    title="Suprimento de Dinheiro no Caixa"
                  >
                    <ArrowDownCircle className="h-3.5 w-3.5 mr-1" />
                    Suprimento
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setMovementModalType('bleed')
                      setIsMovementModalOpen(true)
                    }}
                    className="h-7 px-2 text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20"
                    title="Sangria de Dinheiro do Caixa"
                  >
                    <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
                    Sangria
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsCloseCashModalOpen(true)}
                    className="h-7 px-2 text-[11px] font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20"
                    title="Fechar Caixa do Turno"
                  >
                    <Lock className="h-3.5 w-3.5 mr-1" />
                    Fechar
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                  <span className="text-xs font-bold">Caixa Fechado</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsOpenCashModalOpen(true)}
                  className="h-7 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40"
                >
                  <Unlock className="h-3.5 w-3.5 mr-1.5" />
                  Abrir Caixa
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Informações do Operador e Horário */}
        <div className="flex items-center gap-4">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => navigate('/financeiro/caixa')}
            className="hidden lg:flex items-center gap-1.5 h-8 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-2.5"
            title="Acessar Gestão de Caixas e Histórico"
          >
            <Wallet className="h-3.5 w-3.5 text-blue-400" />
            Gestão do Caixa
          </Button>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="font-mono font-bold text-slate-200">
              {currentTime.toLocaleTimeString('pt-BR')}
            </span>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
            <div className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-blue-400">
              {profile?.full_name?.slice(0, 1) || 'O'}
            </div>
            <div className="text-left text-xs leading-tight">
              <span className="font-bold text-slate-200 block truncate max-w-[130px]">
                {profile?.full_name || user?.email?.split('@')[0] || 'Operador'}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                {activeRole || 'Caixa'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Alternar Tela Cheia"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* ─── BARRA DE ATALHOS RÁPIDOS DO TECLADO ───────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-1.5 bg-slate-850/80 border-b border-slate-800/80 text-[11px] font-semibold text-slate-400 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 hover:text-slate-200 cursor-pointer" onClick={() => setIsProductSearchOpen(true)}>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-400 font-mono text-[10px] border border-slate-700">F2</kbd> Catálogo
          </span>
          <span className="flex items-center gap-1 hover:text-slate-200 cursor-pointer" onClick={() => setIsCustomerSelectorOpen(true)}>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-400 font-mono text-[10px] border border-slate-700">F4</kbd> Cliente
          </span>
          <span className="flex items-center gap-1 hover:text-slate-200 cursor-pointer" onClick={() => { if (cart.length > 0) setIsClearCartConfirmOpen(true) }}>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-rose-400 font-mono text-[10px] border border-slate-700">F7</kbd> Cancelar Venda
          </span>
          <span className="flex items-center gap-1 hover:text-slate-200 cursor-pointer" onClick={() => setIsImportQuoteOpen(true)}>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-mono text-[10px] border border-slate-700">F8</kbd> Orçamentos
          </span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold hover:text-emerald-300 cursor-pointer" onClick={() => { if (cart.length > 0) setIsPaymentModalOpen(true) }}>
            <kbd className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-mono text-[10px]">F10</kbd> Pagar / Finalizar
          </span>
        </div>

        {linkedQuoteCode && (
          <span className="flex items-center gap-1.5 text-blue-400 text-xs font-bold">
            <FileText className="h-3.5 w-3.5" />
            Vinculado ao Orçamento: {linkedQuoteCode}
          </span>
        )}
      </div>

      {/* ─── CORPO PRINCIPAL DO PDV (Grid de 2 Colunas) ────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* COLUNA ESQUERDA (8/12): Input de Produtos + Tabela do Carrinho */}
        <div className="lg:col-span-8 flex flex-col border-r border-slate-800 overflow-hidden bg-slate-900/40">
          {/* BARRA DE ENTRADA DO LEITOR / CÓDIGO DE BARRAS */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
            <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400">
                  <Barcode className="h-5 w-5" />
                </div>
                <Input
                  ref={barcodeRef}
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Escaneie o código de barras, SKU ou digite QTD*CÓDIGO (ex: 3*789001)..."
                  className="pl-11 pr-24 h-12 bg-slate-950 border-slate-700 text-white font-mono text-base font-bold placeholder:text-slate-500 placeholder:text-xs placeholder:font-normal focus:border-emerald-500 rounded-2xl shadow-inner"
                  autoFocus
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-mono text-slate-500">
                  Enter ↵
                </span>
              </div>

              {/* Botão Câmera Scanner */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCameraScannerOpen(true)}
                className="h-12 px-3.5 rounded-2xl border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white"
                title="Escanear com Câmera"
              >
                <Camera className="h-5 w-5 text-purple-400" />
              </Button>

              {/* Botão Catálogo F2 */}
              <Button
                type="button"
                onClick={() => setIsProductSearchOpen(true)}
                className="h-12 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-900/40"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Catálogo (F2)</span>
              </Button>
            </form>
          </div>

          {/* LISTA / TABELA DE ITENS NO CARRINHO */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 p-8">
                <div className="h-20 w-20 rounded-3xl bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-600">
                  <Barcode className="h-10 w-10 stroke-[1.5]" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-base font-bold text-slate-300">Caixa Livre &bull; Carrinho Vazio</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Passe os produtos no leitor de código de barras ou pressione <strong className="text-slate-400">F2</strong> para buscar pelo catálogo.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {cart.map((item, index) => {
                  const isWholesale = item.price_type === 'wholesale'
                  const itemSub = Math.round(item.unit_price * item.quantity * 100) / 100
                  const itemTotal = Math.max(0, Math.round((itemSub - item.discount) * 100) / 100)
                  const hasStockAlert = item.quantity > (item.product.available_stock || 0)

                  return (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between p-3 rounded-2xl border border-slate-800 bg-slate-900 hover:bg-slate-850 hover:border-slate-700 transition gap-3"
                    >
                      {/* Seq # e Imagem */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-slate-400 font-mono text-xs font-bold shrink-0">
                          {index + 1}
                        </span>

                        <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0 overflow-hidden">
                          {item.product.image_url ? (
                            <img src={item.product.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-slate-500" />
                          )}
                        </div>

                        {/* Dados do Produto */}
                        <div className="min-w-0 space-y-0.5">
                          <h4 className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
                            {item.product.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            {item.product.sku && (
                              <span className="font-mono text-slate-300">SKU: {item.product.sku}</span>
                            )}
                            {item.product.barcode && (
                              <span className="font-mono text-slate-500">EAN: {item.product.barcode}</span>
                            )}
                            {isWholesale && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold uppercase text-[9px] border border-amber-500/30">
                                Preço Atacado
                              </span>
                            )}
                            {hasStockAlert && (
                              <span className="flex items-center gap-1 text-rose-400 font-bold text-[10px]">
                                <AlertCircle className="h-3 w-3" /> Saldo insuficiente ({item.product.available_stock || 0})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Controles de Quantidade e Preços */}
                      <div className="flex items-center gap-4 shrink-0">
                        {/* Preço Unitário */}
                        <div className="text-right hidden sm:block">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Unitário</span>
                          <span className="text-xs font-bold font-mono text-slate-200">
                            R$ {item.unit_price.toFixed(2)}
                          </span>
                        </div>

                        {/* Seletor de Quantidade (+ -) */}
                        <div className="flex items-center rounded-xl bg-slate-800 border border-slate-700 p-0.5">
                          <button
                            type="button"
                            onClick={() => updateItemQty(item.product.id, item.quantity - 1)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItemQty(item.product.id, parseFloat(e.target.value) || 0)}
                            className="w-11 text-center bg-transparent font-mono text-xs font-bold text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateItemQty(item.product.id, item.quantity + 1)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Subtotal do Item */}
                        <div className="text-right w-20">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Subtotal</span>
                          <span className="text-sm font-black font-mono text-white">
                            R$ {itemTotal.toFixed(2)}
                          </span>
                        </div>

                        {/* Botão Remover */}
                        <button
                          type="button"
                          onClick={() => removeItem(item.product.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Remover Item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA (4/12): Identificação do Cliente, Resumo e Ações */}
        <div className="lg:col-span-4 flex flex-col justify-between bg-slate-900 border-t lg:border-t-0 border-slate-800 p-5 space-y-4 overflow-y-auto">
          {/* Seção 1: Cliente da Venda */}
          <div className="p-4 rounded-2xl bg-slate-850/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-blue-400" />
                Cliente da Venda
              </span>
              <button
                type="button"
                onClick={() => setIsCustomerSelectorOpen(true)}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition"
              >
                {selectedCustomer || customCustomerName ? 'Alterar' : '+ Identificar (F4)'}
              </button>
            </div>

            {selectedCustomer ? (
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 space-y-1">
                <div className="text-xs font-bold text-white truncate">{selectedCustomer.name}</div>
                {selectedCustomer.document && (
                  <div className="text-[11px] font-mono text-slate-400">Doc: {selectedCustomer.document}</div>
                )}
                {selectedCustomer.credit_limit && (
                  <div className="text-[10px] text-emerald-400 font-semibold">
                    Limite: R$ {Number(selectedCustomer.credit_limit).toFixed(2)}
                  </div>
                )}
              </div>
            ) : customCustomerName ? (
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 space-y-0.5">
                <div className="text-xs font-bold text-white">{customCustomerName}</div>
                {customCustomerDoc && (
                  <div className="text-[11px] font-mono text-slate-400">{customCustomerDoc}</div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-800/40 p-2.5 rounded-xl border border-dashed border-slate-700/60">
                <span>Consumidor Final (Não Identificado)</span>
              </div>
            )}
          </div>

          {/* Seção 2: Resumo Financeiro */}
          <div className="p-4 rounded-2xl bg-slate-850/60 border border-slate-800 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Resumo dos Valores
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Itens ({totals.totalItems}) &bull; Quantidade:</span>
                <span className="font-mono font-bold text-slate-200">{totals.totalUnits} un</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span>Subtotal Bruto:</span>
                <span className="font-mono font-bold text-slate-200">R$ {totals.subtotal.toFixed(2)}</span>
              </div>

              {/* Linha de Desconto Geral */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Desconto Geral:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const val = prompt('Informe o desconto em R$ ou percentual (ex: 10 para R$10):', discountValue.toString())
                      if (val !== null) {
                        const parsed = parseFloat(val) || 0
                        setDiscountValue(parsed)
                      }
                    }}
                    className="text-[10px] text-blue-400 hover:underline font-bold"
                  >
                    (Alterar)
                  </button>
                </div>
                <span className="font-mono font-bold text-rose-400">
                  - R$ {totals.discountAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* TOTAL DA VENDA EM GRANDE DESTAQUE */}
            <div className="pt-3 border-t border-slate-700/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Total a Pagar
              </span>
              <div className="text-4xl font-black text-emerald-400 font-mono tracking-tight">
                R$ {totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Seção 3: Botões de Ação Principal */}
          <div className="space-y-2 pt-2">
            <Button
              type="button"
              onClick={() => {
                if (!currentCashSession) {
                  toast.error('Caixa fechado! É obrigatório abrir o caixa para iniciar vendas.')
                  setIsOpenCashModalOpen(true)
                  return
                }
                setIsPaymentModalOpen(true)
              }}
              disabled={cart.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 text-base transition disabled:opacity-50"
            >
              <CreditCard className="h-5 w-5" />
              Pagar e Finalizar (F10)
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsImportQuoteOpen(true)}
                className="border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5 text-amber-400" />
                Orçamento (F8)
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (cart.length > 0) setIsClearCartConfirmOpen(true)
                }}
                disabled={cart.length === 0}
                className="border-slate-800 bg-slate-850 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar (F7)
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAIS AUXILIARES ─────────────────────────────────────────────── */}

      {/* Modal de Pagamento e Formas */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalToPay={totals.total}
        isSubmitting={isSubmittingSale}
        customer={selectedCustomer}
        companyId={activeCompany?.id}
        onConfirm={handleConfirmSale}
      />

      {/* Modal de Sucesso da Venda */}
      {lastSaleResult && (
        <SaleSuccessModal
          isOpen={isSaleSuccessOpen}
          saleId={lastSaleResult.saleId}
          saleCode={lastSaleResult.code}
          total={lastSaleResult.total}
          changeAmount={lastSaleResult.change}
          paymentMethods={lastSaleResult.methods}
          operatorName={profile?.full_name || 'Operador de Caixa'}
          branchName={activeBranch?.name || 'Filial Principal'}
          onNewSale={() => {
            setIsSaleSuccessOpen(false)
            setLastSaleResult(null)
            setCompletedSale(null)
          }}
          onViewHistory={() => {
            setIsSaleSuccessOpen(false)
            navigate('/comercial/vendas')
          }}
          onPrintReceipt={async () => {
            if (!completedSale && lastSaleResult.saleId && activeCompany?.id) {
              const full = await saleService.getSale(lastSaleResult.saleId, activeCompany.id)
              if (full) setCompletedSale(full)
            }
            setIsReceiptPreviewOpen(true)
          }}
        />
      )}

      {/* Modal de Pré-visualização e Impressão Térmica (Etapa 10) */}
      <ReceiptPreviewModal
        isOpen={isReceiptPreviewOpen}
        onClose={() => setIsReceiptPreviewOpen(false)}
        sale={completedSale}
        company={activeCompany}
        isReprint={false}
      />

      {/* Modal de Busca de Produtos (F2) */}
      {activeCompany?.id && activeBranch?.id && (
        <ProductSearchModal
          isOpen={isProductSearchOpen}
          onClose={() => setIsProductSearchOpen(false)}
          companyId={activeCompany.id}
          branchId={activeBranch.id}
          onSelectProduct={(p) => addProductToCart(p, 1)}
        />
      )}

      {/* Modal de Câmera Scanner */}
      <QrCameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={async (code) => {
          if (!activeCompany?.id || !activeBranch?.id) return
          const found = await productService.findByBarcodeOrSku(
            activeCompany.id,
            activeBranch.id,
            code
          )
          if (found) {
            addProductToCart(found, 1)
            setIsCameraScannerOpen(false)
            toast.success(`Adicionado via Câmera: ${found.name}`)
          } else {
            toast.error(`Produto com código "${code}" não localizado.`)
          }
        }}
        title="Escanear Código de Barras no Caixa"
      />

      {/* Modal de Importar Orçamento (F8) */}
      {activeCompany?.id && activeBranch?.id && (
        <ImportQuoteModal
          isOpen={isImportQuoteOpen}
          onClose={() => setIsImportQuoteOpen(false)}
          companyId={activeCompany.id}
          branchId={activeBranch.id}
          onSelectQuote={handleImportQuote}
        />
      )}

      {/* Modal Confirmar Limpar Carrinho (F7) */}
      <ClearCartConfirmModal
        isOpen={isClearCartConfirmOpen}
        onClose={() => setIsClearCartConfirmOpen(false)}
        onConfirm={() => {
          resetPos()
          setIsClearCartConfirmOpen(false)
          toast.success('Carrinho limpo!')
        }}
        itemCount={cart.length}
      />

      {/* Mini Modal para Identificar Cliente (F4) */}
      {isCustomerSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="h-4 w-4 text-blue-400" />
                Vincular Cliente na Venda
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomerSelectorOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <Input
              value={customerSearchQuery}
              onChange={(e) => setCustomerSearchQuery(e.target.value)}
              placeholder="Buscar por nome, documento ou telefone..."
              className="bg-slate-800 border-slate-700 text-white text-xs"
              autoFocus
            />

            <div className="max-h-60 overflow-y-auto space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null)
                  setCustomCustomerName('')
                  setCustomCustomerDoc('')
                  setCustomerMode('unidentified')
                  setIsCustomerSelectorOpen(false)
                }}
                className="w-full text-left p-2.5 rounded-xl border border-slate-800 bg-slate-850 hover:bg-slate-800 text-xs text-slate-300 font-semibold"
              >
                Consumidor Final (Não Identificado)
              </button>

              {customersList
                .filter(
                  (c) =>
                    !customerSearchQuery ||
                    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                    (c.document && c.document.includes(customerSearchQuery))
                )
                .slice(0, 15)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(c)
                      setCustomerMode('registered')
                      setIsCustomerSelectorOpen(false)
                      toast.success(`Cliente ${c.name} selecionado!`)
                    }}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-800 bg-slate-850 hover:bg-slate-800 text-xs text-white space-y-0.5"
                  >
                    <div className="font-bold truncate">{c.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {c.document || 'Sem documento'} &bull; {c.phone || 'Sem telefone'}
                    </div>
                  </button>
                ))}
            </div>

            <div className="border-t border-slate-800 pt-3">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                Ou digite Nome e CPF avulso:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={customCustomerName}
                  onChange={(e) => setCustomCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
                  className="bg-slate-800 border-slate-700 text-white text-xs"
                />
                <Input
                  value={customCustomerDoc}
                  onChange={(e) => setCustomCustomerDoc(e.target.value)}
                  placeholder="CPF / CNPJ"
                  className="bg-slate-800 border-slate-700 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCustomerSelectorOpen(false)}
                className="text-xs text-slate-400"
              >
                Fechar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCustomerSelectorOpen(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAIS DE CONTROLE DE CAIXA (ETAPA 11) ────────────────────────── */}

      {/* Abertura de Caixa */}
      <OpenCashSessionModal
        isOpen={isOpenCashModalOpen}
        onClose={() => setIsOpenCashModalOpen(false)}
        companyId={activeCompany?.id || ''}
        branchId={activeBranch?.id || ''}
        companyName={activeCompany?.trade_name || activeCompany?.legal_name || 'MundoMix'}
        branchName={activeBranch?.name || 'Filial Principal'}
        operatorName={profile?.full_name || user?.email?.split('@')[0] || 'Operador'}
        onSessionOpened={(session: CashSession) => {
          setCurrentCashSession(session)
          toast.success(`Caixa ${session.terminal_name} aberto com sucesso!`)
        }}
      />

      {/* Movimentações de Caixa (Suprimento / Sangria) */}
      <CashMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        session={currentCashSession}
        defaultType={movementModalType}
        onMovementAdded={() => {
          loadCashSession()
        }}
      />

      {/* Fechamento de Caixa */}
      <CloseCashSessionModal
        isOpen={isCloseCashModalOpen}
        onClose={() => setIsCloseCashModalOpen(false)}
        session={currentCashSession}
        companyId={activeCompany?.id || ''}
        onSessionClosed={(closed: CashSession) => {
          setCurrentCashSession(null)
          setClosedSessionForReport(closed)
        }}
      />

      {/* Relatório de Fechamento de Caixa */}
      <CashReportModal
        isOpen={!!closedSessionForReport}
        onClose={() => setClosedSessionForReport(null)}
        session={closedSessionForReport}
        company={activeCompany}
      />
    </div>
  )
}
