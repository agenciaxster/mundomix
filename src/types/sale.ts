import type { Customer } from './customer'
import type { Branch } from './auth'

export type PaymentMethod =
  | 'cash'
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'store_credit'
  | 'other'

export type SaleStatus = 'completed' | 'cancelled'
export type PriceType = 'retail' | 'wholesale' | 'custom'
export type DiscountType = 'percentage' | 'value'

export interface SaleItem {
  id?: string
  sale_id?: string
  company_id: string
  branch_id: string
  product_id: string
  product_name: string
  product_sku?: string | null
  product_barcode?: string | null
  unit: string
  quantity: number
  unit_price: number
  cost_price?: number
  price_type: PriceType
  discount: number
  subtotal: number
  total: number
  created_at?: string
}

export interface SalePayment {
  id?: string
  sale_id?: string
  company_id: string
  payment_method: PaymentMethod
  amount: number
  received_amount?: number
  change_amount?: number
  installments?: number
  notes?: string | null
  created_at?: string
}

export interface Sale {
  id: string
  company_id: string
  branch_id: string
  user_id: string
  customer_id: string | null
  customer_name: string | null
  customer_document: string | null
  sale_number: number
  code: string
  status: SaleStatus
  subtotal: number
  discount_type: DiscountType
  discount_value: number
  discount_amount: number
  total: number
  payment_amount: number
  change_amount: number
  quote_id: string | null
  cash_session_id?: string | null
  idempotency_key?: string | null
  notes: string | null
  created_at: string
  updated_at: string
  branch?: Branch
  customer?: Customer | null
  items?: SaleItem[]
  payments?: SalePayment[]
  user_name?: string
  user_email?: string
}

export interface FinalizeSalePayload {
  company_id: string
  branch_id: string
  cash_session_id?: string | null
  customer_id?: string | null
  customer_name?: string | null
  customer_document?: string | null
  discount_type?: DiscountType
  discount_value?: number
  items: Array<{
    product_id: string
    quantity: number
    discount?: number
  }>
  payments: Array<{
    payment_method: PaymentMethod
    amount: number
    received_amount?: number
    installments?: number
    notes?: string
  }>
  quote_id?: string | null
  idempotency_key?: string | null
  notes?: string | null
  receivable_config?: {
    installments_count?: number
    first_due_date?: string
    interval_days?: number
  } | null
}

export interface SaleFilters {
  branchId?: string
  status?: string
  paymentMethod?: string
  customerId?: string
  userId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface SaleKpis {
  todayTotal: number
  todayCount: number
  averageTicket: number
  cashTotal: number
  pixTotal: number
  cardTotal: number
}
