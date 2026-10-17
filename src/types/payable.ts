import type { Supplier } from './supplier'

export type PayableStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'

export type PayablePaymentMethod =
  | 'cash'
  | 'pix'
  | 'bank_transfer'
  | 'credit_card'
  | 'bank_slip'
  | 'other'

export interface FinancialCategory {
  id: string
  company_id: string
  name: string
  code?: string | null
  type: 'expense' | 'income'
  color?: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface AccountPayable {
  id: string
  company_id: string
  branch_id: string
  supplier_id?: string | null
  category_id?: string | null
  document_number?: string | null
  description: string
  issue_date: string
  competence_date?: string | null
  due_date: string
  original_amount: number
  discount_amount: number
  interest_amount: number
  fine_amount: number
  total_amount: number
  paid_amount: number
  balance_amount: number
  installments_count: number
  status: PayableStatus
  cancellation_reason?: string | null
  cancelled_by?: string | null
  cancelled_at?: string | null
  notes?: string | null
  attachment_url?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string

  // Joins opcionais
  supplier?: Supplier | null
  category?: FinancialCategory | null
  installments?: PayableInstallment[]
}

export interface PayableInstallment {
  id: string
  payable_id: string
  company_id: string
  branch_id: string
  supplier_id?: string | null
  installment_number: number
  due_date: string
  amount: number
  paid_amount: number
  balance_amount: number
  status: PayableStatus
  created_at: string
  updated_at: string

  // Joins opcionais
  payable?: AccountPayable | null
  supplier?: Supplier | null
}

export interface PayablePayment {
  id: string
  company_id: string
  branch_id: string
  payable_id: string
  installment_id: string
  supplier_id?: string | null
  cash_session_id?: string | null
  cash_movement_id?: string | null
  amount_paid: number
  discount_applied: number
  interest_applied: number
  fine_applied: number
  payment_method: PayablePaymentMethod
  payment_date: string
  paid_by?: string | null
  paid_by_name?: string | null
  notes?: string | null
  receipt_url?: string | null
  idempotency_key?: string | null
  created_at: string
}

export interface CreatePayablePayload {
  company_id: string
  branch_id: string
  supplier_id?: string | null
  category_id?: string | null
  document_number?: string
  description: string
  issue_date?: string
  competence_date?: string
  due_date: string
  original_amount: number
  discount_amount?: number
  interest_amount?: number
  fine_amount?: number
  installments_count: number
  interval_days?: number
  notes?: string
  attachment_url?: string
}

export interface PayInstallmentPayload {
  company_id: string
  branch_id: string
  installment_id: string
  amount: number
  payment_method: PayablePaymentMethod
  cash_session_id?: string | null
  discount?: number
  interest?: number
  fine?: number
  notes?: string
  idempotency_key?: string
}

export interface PayableFilter {
  companyId: string
  branchId?: string
  supplierId?: string
  categoryId?: string
  status?: 'all' | PayableStatus
  startDate?: string
  endDate?: string
  searchQuery?: string
}

export interface PayableKpis {
  totalOpen: number
  totalOverdue: number
  totalDueToday: number
  totalDueUpcoming: number
  totalPaidPeriod: number
  countDueSoon: number
  totalCount: number
}
