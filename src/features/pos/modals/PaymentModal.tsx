import { useState, useMemo, useEffect, useRef } from 'react'
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Split,
  Coins,
  User,
  ShieldAlert,
} from 'lucide-react'
import type { PaymentMethod } from '@/types/sale'
import type { Customer } from '@/types/customer'
import type { CustomerCreditProfile } from '@/types/receivable'
import { receivableService } from '@/lib/services/receivable.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

export interface PaymentItem {
  payment_method: PaymentMethod
  amount: number
  received_amount: number
  installments: number
  notes?: string
}

export interface ReceivableConfigPayload {
  installments_count: number
  first_due_date: string
  interval_days: number
}

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  totalToPay: number
  isSubmitting: boolean
  customer?: Customer | null
  companyId?: string
  onConfirm: (payments: PaymentItem[], receivableConfig?: ReceivableConfigPayload) => void
}

const PAYMENT_METHODS_CONFIG: Array<{
  id: PaymentMethod
  label: string
  icon: typeof Banknote
  colorClass: string
  borderClass: string
  bgClass: string
}> = [
  {
    id: 'cash',
    label: 'Dinheiro',
    icon: Banknote,
    colorClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/50 hover:border-emerald-500',
    bgClass: 'bg-emerald-500/10',
  },
  {
    id: 'pix',
    label: 'Pix',
    icon: QrCode,
    colorClass: 'text-teal-400',
    borderClass: 'border-teal-500/50 hover:border-teal-500',
    bgClass: 'bg-teal-500/10',
  },
  {
    id: 'debit_card',
    label: 'Cartão de Débito',
    icon: CreditCard,
    colorClass: 'text-blue-400',
    borderClass: 'border-blue-500/50 hover:border-blue-500',
    bgClass: 'bg-blue-500/10',
  },
  {
    id: 'credit_card',
    label: 'Cartão de Crédito',
    icon: CreditCard,
    colorClass: 'text-indigo-400',
    borderClass: 'border-indigo-500/50 hover:border-indigo-500',
    bgClass: 'bg-indigo-500/10',
  },
  {
    id: 'store_credit',
    label: 'Crediário / Convênio',
    icon: Wallet,
    colorClass: 'text-amber-400',
    borderClass: 'border-amber-500/50 hover:border-amber-500',
    bgClass: 'bg-amber-500/10',
  },
  {
    id: 'other',
    label: 'Outros',
    icon: Coins,
    colorClass: 'text-slate-400',
    borderClass: 'border-slate-500/50 hover:border-slate-500',
    bgClass: 'bg-slate-500/10',
  },
]

export function PaymentModal({
  isOpen,
  onClose,
  totalToPay,
  isSubmitting,
  customer,
  companyId,
  onConfirm,
}: PaymentModalProps) {
  // Modo de pagamento: 1 forma ou 2 formas divididas
  const [paymentMode, setPaymentMode] = useState<'single' | 'split'>('single')

  // Forma 1
  const [method1, setMethod1] = useState<PaymentMethod>('cash')
  const [amount1, setAmount1] = useState<string>('')
  const [received1, setReceived1] = useState<string>('')
  const [installments1, setInstallments1] = useState<number>(1)
  const [storeCreditInstallments1, setStoreCreditInstallments1] = useState<number>(1)
  const [storeCreditFirstDue1, setStoreCreditFirstDue1] = useState<string>('')

  // Forma 2 (se split)
  const [method2, setMethod2] = useState<PaymentMethod>('credit_card')
  const [amount2, setAmount2] = useState<string>('')
  const [received2, setReceived2] = useState<string>('')
  const [installments2, setInstallments2] = useState<number>(1)
  const [storeCreditInstallments2, setStoreCreditInstallments2] = useState<number>(1)
  const [storeCreditFirstDue2, setStoreCreditFirstDue2] = useState<string>('')

  // Perfil de crédito do cliente
  const [creditProfile, setCreditProfile] = useState<CustomerCreditProfile | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)

  // Foco inicial
  const firstInputRef = useRef<HTMLInputElement>(null)

  // Inicializa valores ao abrir
  useEffect(() => {
    if (isOpen) {
      setPaymentMode('single')
      setMethod1('cash')
      setAmount1(totalToPay.toFixed(2))
      setReceived1(totalToPay.toFixed(2))
      setInstallments1(1)
      setStoreCreditInstallments1(1)

      const d = new Date()
      d.setDate(d.getDate() + 30)
      const defDue = d.toISOString().split('T')[0]
      setStoreCreditFirstDue1(defDue)
      setStoreCreditFirstDue2(defDue)

      setMethod2('credit_card')
      setAmount2('0.00')
      setReceived2('0.00')
      setInstallments2(1)
      setStoreCreditInstallments2(1)

      setTimeout(() => {
        firstInputRef.current?.focus()
        firstInputRef.current?.select()
      }, 100)
    }
  }, [isOpen, totalToPay])

  // Busca perfil de crédito quando necessário
  useEffect(() => {
    const hasStoreCredit = method1 === 'store_credit' || (paymentMode === 'split' && method2 === 'store_credit')
    if (isOpen && hasStoreCredit && customer && companyId) {
      setIsLoadingProfile(true)
      receivableService
        .getCustomerCreditProfile(companyId, customer.id)
        .then((prof) => setCreditProfile(prof))
        .catch((e) => console.warn('Aviso ao consultar crédito:', e))
        .finally(() => setIsLoadingProfile(false))
    } else {
      setCreditProfile(null)
    }
  }, [isOpen, method1, method2, paymentMode, customer, companyId])

  // Quando alterna para split, divide o valor automaticamente
  function handleToggleMode(mode: 'single' | 'split') {
    setPaymentMode(mode)
    if (mode === 'single') {
      setAmount1(totalToPay.toFixed(2))
      setReceived1(method1 === 'cash' ? totalToPay.toFixed(2) : '')
    } else {
      const half = Math.round((totalToPay / 2) * 100) / 100
      const remainder = Math.round((totalToPay - half) * 100) / 100
      setAmount1(half.toFixed(2))
      setReceived1(method1 === 'cash' ? half.toFixed(2) : '')
      setAmount2(remainder.toFixed(2))
      setReceived2(method2 === 'cash' ? remainder.toFixed(2) : '')
    }
  }

  // Cálculos matemáticos
  const numAmount1 = parseFloat(amount1) || 0
  const numAmount2 = paymentMode === 'split' ? parseFloat(amount2) || 0 : 0
  const totalPaid = Math.round((numAmount1 + numAmount2) * 100) / 100
  const remaining = Math.round((totalToPay - totalPaid) * 100) / 100
  const isBalanced = Math.abs(remaining) < 0.009

  // Cálculo de Troco (se houver pagamento em dinheiro)
  const change1 = useMemo(() => {
    if (method1 !== 'cash') return 0
    const rec = parseFloat(received1) || 0
    return Math.max(0, Math.round((rec - numAmount1) * 100) / 100)
  }, [method1, received1, numAmount1])

  const change2 = useMemo(() => {
    if (paymentMode !== 'split' || method2 !== 'cash') return 0
    const rec = parseFloat(received2) || 0
    return Math.max(0, Math.round((rec - numAmount2) * 100) / 100)
  }, [paymentMode, method2, received2, numAmount2])

  const totalChange = Math.round((change1 + change2) * 100) / 100

  function handleExactCash(isSecond = false) {
    if (!isSecond) {
      setReceived1(numAmount1.toFixed(2))
    } else {
      setReceived2(numAmount2.toFixed(2))
    }
  }

  // Verifica se há crediário em uso
  const isStoreCredit1 = method1 === 'store_credit'
  const isStoreCredit2 = paymentMode === 'split' && method2 === 'store_credit'
  const totalStoreCredit = (isStoreCredit1 ? numAmount1 : 0) + (isStoreCredit2 ? numAmount2 : 0)

  function handleFinalize() {
    if (!isBalanced) {
      toast.error(
        `A soma dos pagamentos (R$ ${totalPaid.toFixed(2)}) deve ser exatamente igual ao total da venda (R$ ${totalToPay.toFixed(2)}).`
      )
      return
    }

    if (numAmount1 <= 0) {
      toast.error('O valor da primeira forma de pagamento deve ser maior que zero.')
      return
    }

    if (method1 === 'cash') {
      const rec = parseFloat(received1) || 0
      if (rec < numAmount1) {
        toast.error('O valor recebido em dinheiro não pode ser menor que o valor a pagar.')
        return
      }
    }

    // Validações do Crediário
    if (totalStoreCredit > 0) {
      if (!customer) {
        toast.error('Para compras no Crediário / A Prazo, é obrigatório selecionar um cliente cadastrado.')
        return
      }

      if (creditProfile) {
        if (creditProfile.is_blocked) {
          toast.error(`Cliente bloqueado para compras a prazo (${creditProfile.credit_status}).`)
          return
        }

        if (creditProfile.has_overdue) {
          const proceedOverdue = window.confirm(
            `Atenção: O cliente possui R$ ${creditProfile.overdue_amount.toFixed(2)} em parcelas vencidas em atraso!\n\n` +
            'Deseja prosseguir com a venda a prazo mediante autorização gerencial?'
          )
          if (!proceedOverdue) return
        }

        if (totalStoreCredit > creditProfile.available_credit) {
          const proceedExceeded = window.confirm(
            `Limite de crédito insuficiente!\n` +
            `Limite disponível: R$ ${creditProfile.available_credit.toFixed(2)}\n` +
            `Valor solicitado: R$ ${totalStoreCredit.toFixed(2)}\n\n` +
            'Deseja autorizar a liberação excepcional desta venda a prazo?'
          )
          if (!proceedExceeded) return
        }
      }
    }

    const payments: PaymentItem[] = [
      {
        payment_method: method1,
        amount: numAmount1,
        received_amount: method1 === 'cash' ? parseFloat(received1) || numAmount1 : numAmount1,
        installments: method1 === 'credit_card' ? installments1 : isStoreCredit1 ? storeCreditInstallments1 : 1,
      },
    ]

    if (paymentMode === 'split') {
      if (numAmount2 <= 0) {
        toast.error('O valor da segunda forma de pagamento deve ser maior que zero.')
        return
      }

      if (method2 === 'cash') {
        const rec = parseFloat(received2) || 0
        if (rec < numAmount2) {
          toast.error('O valor recebido em dinheiro na 2ª forma não pode ser menor que o valor a pagar.')
          return
        }
      }

      payments.push({
        payment_method: method2,
        amount: numAmount2,
        received_amount: method2 === 'cash' ? parseFloat(received2) || numAmount2 : numAmount2,
        installments: method2 === 'credit_card' ? installments2 : isStoreCredit2 ? storeCreditInstallments2 : 1,
      })
    }

    // Configuração da obrigação a receber para Crediário
    let receivableConfig: ReceivableConfigPayload | undefined
    if (totalStoreCredit > 0) {
      const activeInstCount = isStoreCredit1 ? storeCreditInstallments1 : storeCreditInstallments2
      const activeFirstDue = isStoreCredit1 ? storeCreditFirstDue1 : storeCreditFirstDue2
      receivableConfig = {
        installments_count: activeInstCount,
        first_due_date: activeFirstDue,
        interval_days: 30,
      }
    }

    onConfirm(payments, receivableConfig)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header com Total em Destaque */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Finalização de Venda
              </span>
              <h2 className="text-xl font-black text-white">Formas de Pagamento</h2>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total da Venda
              </span>
              <div className="text-2xl font-black text-emerald-400">
                R$ {totalToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Alternador de Modo: 1 Forma ou 2 Formas (Dividir) */}
          <div className="flex items-center justify-between p-1.5 rounded-2xl bg-slate-800/80 border border-slate-700/80">
            <button
              type="button"
              onClick={() => handleToggleMode('single')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                paymentMode === 'single'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              1 Forma de Pagamento (Integral)
            </button>

            <button
              type="button"
              onClick={() => handleToggleMode('split')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                paymentMode === 'split'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Split className="h-4 w-4" />
              2 Formas de Pagamento (Dividir Conta)
            </button>
          </div>

          {/* PRIMEIRA FORMA DE PAGAMENTO */}
          <div className="p-5 rounded-2xl bg-slate-850/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-300 text-[11px]">
                  1
                </span>
                {paymentMode === 'split' ? 'Primeira Forma de Pagamento' : 'Forma de Pagamento'}
              </span>

              {paymentMode === 'split' && (
                <span className="text-xs font-semibold text-slate-400">
                  Valor: <strong className="text-white">R$ {numAmount1.toFixed(2)}</strong>
                </span>
              )}
            </div>

            {/* Grid de Métodos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PAYMENT_METHODS_CONFIG.map((cfg) => {
                const Icon = cfg.icon
                const isSelected = method1 === cfg.id
                return (
                  <button
                    key={cfg.id}
                    type="button"
                    onClick={() => {
                      setMethod1(cfg.id)
                      if (cfg.id === 'cash' && !received1) {
                        setReceived1(amount1)
                      }
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? `${cfg.bgClass} ${cfg.borderClass} border-2 ring-1 ring-white/10`
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isSelected ? cfg.colorClass : 'text-slate-400'}`} />
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {cfg.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Campos de Valor e Controles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Valor a Pagar nesta forma (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                  <Input
                    ref={firstInputRef}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount1}
                    onChange={(e) => {
                      setAmount1(e.target.value)
                      if (method1 === 'cash') setReceived1(e.target.value)
                    }}
                    placeholder="0,00"
                    className="pl-9 bg-slate-800 border-slate-700 text-white font-mono text-base font-bold focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Se for Cartão de Crédito */}
              {method1 === 'credit_card' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Parcelamento
                  </label>
                  <select
                    value={installments1}
                    onChange={(e) => setInstallments1(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none h-10 font-medium"
                  >
                    <option value={1}>1x à vista (R$ {numAmount1.toFixed(2)})</option>
                    {[2, 3, 4, 5, 6, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}x de R$ {(numAmount1 / n).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Se for Crediário / Convênio: Parcelas e 1º Vencimento */}
              {method1 === 'store_credit' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Parcelas
                    </label>
                    <select
                      value={storeCreditInstallments1}
                      onChange={(e) => setStoreCreditInstallments1(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none h-10 font-bold"
                    >
                      <option value={1}>1x (30 dias)</option>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <option key={n} value={n}>
                          {n}x de ~ R$ {(numAmount1 / n).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      1º Vencimento
                    </label>
                    <Input
                      type="date"
                      value={storeCreditFirstDue1}
                      onChange={(e) => setStoreCreditFirstDue1(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white text-xs h-10"
                    />
                  </div>
                </div>
              )}

              {/* Se for Dinheiro: Valor Recebido e Troco */}
              {method1 === 'cash' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Valor Entregue pelo Cliente (R$)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleExactCash(false)}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition"
                    >
                      Valor Exato
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={received1}
                      onChange={(e) => setReceived1(e.target.value)}
                      placeholder="0,00"
                      className="pl-9 bg-slate-800 border-slate-700 text-emerald-400 font-mono text-base font-bold focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Informações de Limite se Crediário */}
            {method1 === 'store_credit' && (
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-1.5">
                {isLoadingProfile ? (
                  <div className="flex items-center gap-2 text-amber-300 font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Consultando limite de crédito do cliente...
                  </div>
                ) : customer ? (
                  <>
                    <div className="flex items-center justify-between font-bold text-amber-300">
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" /> {customer.name}
                      </span>
                      {creditProfile && (
                        <span>
                          Limite: R$ {creditProfile.credit_limit.toFixed(2)} &bull; Disponível: R${' '}
                          <strong className="text-emerald-400 font-mono">
                            {creditProfile.available_credit.toFixed(2)}
                          </strong>
                        </span>
                      )}
                    </div>
                    {creditProfile?.has_overdue && (
                      <div className="text-rose-400 font-semibold flex items-center gap-1 text-[11px]">
                        <ShieldAlert className="h-3.5 w-3.5" /> Possui R${' '}
                        {creditProfile.overdue_amount.toFixed(2)} em parcelas atrasadas!
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-amber-400 font-bold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Consumidor não identificado! Para vender no crediário, vincule um cliente antes de finalizar.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SEGUNDA FORMA DE PAGAMENTO (SE SPLIT) */}
          {paymentMode === 'split' && (
            <div className="p-5 rounded-2xl bg-slate-850/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-purple-300 text-[11px]">
                    2
                  </span>
                  Segunda Forma de Pagamento
                </span>

                <span className="text-xs font-semibold text-slate-400">
                  Valor: <strong className="text-white">R$ {numAmount2.toFixed(2)}</strong>
                </span>
              </div>

              {/* Grid de Métodos Forma 2 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {PAYMENT_METHODS_CONFIG.map((cfg) => {
                  const Icon = cfg.icon
                  const isSelected = method2 === cfg.id
                  return (
                    <button
                      key={cfg.id}
                      type="button"
                      onClick={() => {
                        setMethod2(cfg.id)
                        if (cfg.id === 'cash' && !received2) {
                          setReceived2(amount2)
                        }
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition ${
                        isSelected
                          ? `${cfg.bgClass} ${cfg.borderClass} border-2 ring-1 ring-white/10`
                          : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isSelected ? cfg.colorClass : 'text-slate-400'}`} />
                      <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {cfg.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Valor a Pagar nesta forma (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount2}
                      onChange={(e) => {
                        setAmount2(e.target.value)
                        if (method2 === 'cash') setReceived2(e.target.value)
                      }}
                      placeholder="0,00"
                      className="pl-9 bg-slate-800 border-slate-700 text-white font-mono text-base font-bold focus:border-purple-500"
                    />
                  </div>
                </div>

                {method2 === 'credit_card' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Parcelamento
                    </label>
                    <select
                      value={installments2}
                      onChange={(e) => setInstallments2(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none h-10 font-medium"
                    >
                      <option value={1}>1x à vista (R$ {numAmount2.toFixed(2)})</option>
                      {[2, 3, 4, 5, 6, 10, 12].map((n) => (
                        <option key={n} value={n}>
                          {n}x de R$ {(numAmount2 / n).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {method2 === 'store_credit' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Parcelas
                      </label>
                      <select
                        value={storeCreditInstallments2}
                        onChange={(e) => setStoreCreditInstallments2(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none h-10 font-bold"
                      >
                        <option value={1}>1x (30 dias)</option>
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <option key={n} value={n}>
                            {n}x de ~ R$ {(numAmount2 / n).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        1º Vencimento
                      </label>
                      <Input
                        type="date"
                        value={storeCreditFirstDue2}
                        onChange={(e) => setStoreCreditFirstDue2(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white text-xs h-10"
                      />
                    </div>
                  </div>
                )}

                {method2 === 'cash' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Valor Entregue pelo Cliente (R$)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleExactCash(true)}
                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition"
                      >
                        Valor Exato
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={received2}
                        onChange={(e) => setReceived2(e.target.value)}
                        placeholder="0,00"
                        className="pl-9 bg-slate-800 border-slate-700 text-emerald-400 font-mono text-base font-bold focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resumo de Troco e Conciliação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            {/* Troco */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Troco a Devolver
                </span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  R$ {totalChange.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Balanço / Restante */}
            <div className="text-right flex flex-col justify-center">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Status dos Pagamentos
              </span>
              {isBalanced ? (
                <span className="text-sm font-bold text-emerald-400 flex items-center justify-end gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Total 100% Coberto
                </span>
              ) : remaining > 0 ? (
                <span className="text-sm font-bold text-amber-400 flex items-center justify-end gap-1">
                  <AlertCircle className="h-4 w-4" /> Falta R$ {remaining.toFixed(2)}
                </span>
              ) : (
                <span className="text-sm font-bold text-rose-400 flex items-center justify-end gap-1">
                  <AlertCircle className="h-4 w-4" /> Excesso de R$ {Math.abs(remaining).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-850/80">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white"
          >
            Cancelar (ESC)
          </Button>

          <Button
            type="button"
            onClick={handleFinalize}
            disabled={!isBalanced || isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-2.5 rounded-xl shadow-lg shadow-emerald-950/50 disabled:opacity-50 text-sm flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando Venda...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar e Finalizar Venda (Enter)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
