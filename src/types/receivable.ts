export type ReceivableStatus = 'open' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
export type ReceivablePaymentMethod = 'cash' | 'pix' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'other'

export interface AccountReceivable {
  id: string
  company_id: string
  branch_id: string
  customer_id: string
  sale_id?: string | null
  document_number: string
  description?: string | null
  issue_date: string
  total_amount: number
  down_payment: number
  balance_amount: number
  paid_amount: number
  installments_count: number
  status: ReceivableStatus
  notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  cancelled_at?: string | null
  cancelled_by?: string | null
  cancellation_reason?: string | null

  // Joins opcionais
  customer?: {
    id: string
    name: string
    trade_name?: string | null
    document?: string | null
    phone?: string | null
  } | null
  branch?: {
    id: string
    name: string
    code: string
  } | null
  installments?: ReceivableInstallment[]
}

export interface ReceivableInstallment {
  id: string
  receivable_id: string
  company_id: string
  branch_id: string
  customer_id: string
  installment_number: number
  due_date: string
  original_amount: number
  paid_amount: number
  balance_amount: number
  status: ReceivableStatus
  notes?: string | null
  created_at: string
  updated_at: string

  // Joins
  receivable?: AccountReceivable | null
  customer?: {
    id: string
    name: string
    trade_name?: string | null
    document?: string | null
    phone?: string | null
  } | null
  payments?: ReceivablePayment[]
}

export interface ReceivablePayment {
  id: string
  company_id: string
  branch_id: string
  receivable_id: string
  installment_id: string
  customer_id: string
  cash_session_id?: string | null
  amount_paid: number
  payment_method: ReceivablePaymentMethod
  payment_date: string
  received_by: string
  received_by_name?: string | null
  notes?: string | null
  idempotency_key?: string | null
  created_at: string
}

export interface CustomerCreditProfile {
  customer_id: string
  customer_name: string
  document?: string | null
  credit_status: 'available' | 'blocked' | 'under_review'
  customer_status: 'active' | 'inactive'
  credit_limit: number
  used_credit: number
  available_credit: number
  overdue_amount: number
  overdue_count: number
  open_receivables_count: number
  is_blocked: boolean
  has_overdue: boolean
}

export interface ReceivePaymentParams {
  company_id: string
  branch_id: string
  installment_id: string
  amount: number
  payment_method: ReceivablePaymentMethod
  cash_session_id?: string | null
  notes?: string | null
  idempotency_key?: string
}

export interface ListInstallmentsFilter {
  companyId: string
  branchId?: string
  customerId?: string
  status?: ReceivableStatus | 'all'
  startDate?: string
  endDate?: string
  searchQuery?: string
  onlyOverdue?: boolean
}

export interface CreateManualReceivableParams {
  company_id: string
  branch_id: string
  customer_id: string
  description: string
  total_amount: number
  down_payment?: number
  installments_count: number
  first_due_date: string
  interval_days?: number
  notes?: string
}
