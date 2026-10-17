import type { Product } from './stock'
import type { Customer } from './customer'

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted'

export type PriceType = 'retail' | 'wholesale' | 'custom'

export type DiscountType = 'percentage' | 'value'

export interface QuoteItem {
  id?: string
  quote_id?: string
  product_id: string
  product_name: string
  product_sku?: string | null
  product_barcode?: string | null
  unit: string
  quantity: number
  unit_price: number
  price_type: PriceType
  discount: number
  subtotal: number
  total: number
  notes?: string | null
  created_at?: string
  product?: Product
  current_stock?: number
}

export interface Quote {
  id: string
  company_id: string
  branch_id: string
  quote_number: number
  code: string
  customer_id: string | null
  customer_name: string | null
  customer_document: string | null
  customer_email: string | null
  customer_phone: string | null
  user_id: string
  status: QuoteStatus
  subtotal: number
  discount_type: DiscountType
  discount_value: number
  discount_amount: number
  total: number
  notes: string | null
  valid_until: string
  converted_at: string | null
  converted_to_sale_id: string | null
  created_at: string
  updated_at: string
  branch?: {
    id: string
    name: string
    code: string
  }
  customer?: Customer | null
  items?: QuoteItem[]
  user_name?: string
  user_email?: string
}

export interface QuoteStatusHistory {
  id: string
  quote_id: string
  company_id: string
  previous_status: QuoteStatus | null
  new_status: QuoteStatus
  reason: string | null
  user_id: string | null
  created_at: string
  user_name?: string
}

export interface QuoteFormData {
  id?: string
  company_id: string
  branch_id: string
  customer_id?: string | null
  customer_name?: string | null
  customer_document?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  status: QuoteStatus
  discount_type: DiscountType
  discount_value: number
  notes?: string | null
  valid_until: string
  items: Array<{
    product_id: string
    quantity: number
    unit_price?: number
    discount?: number
    notes?: string
  }>
}

export interface QuoteFilters {
  search?: string
  branchId?: string
  status?: QuoteStatus | 'all'
  customerId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface QuoteKpis {
  totalQuotes: number
  draftCount: number
  sentCount: number
  approvedCount: number
  convertedCount: number
  rejectedOrExpiredCount: number
  totalValue: number
  conversionRate: number
}
