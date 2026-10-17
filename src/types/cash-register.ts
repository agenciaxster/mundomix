export type CashSessionStatus = 'open' | 'closed'
export type CashMovementType = 'supply' | 'bleed' | 'expense'

export interface CashSession {
  id: string
  company_id: string
  branch_id: string
  terminal_name: string
  opened_by: string
  opened_by_name: string | null
  opened_at: string
  initial_amount: number
  opening_notes?: string | null
  status: CashSessionStatus

  // Fechamento
  closed_by?: string | null
  closed_by_name?: string | null
  closed_at?: string | null
  closing_notes?: string | null
  counted_cash?: number | null
  expected_cash?: number | null
  difference_cash?: number | null
  difference_reason?: string | null

  // Totais das vendas
  total_sales_cash: number
  total_sales_pix: number
  total_sales_debit: number
  total_sales_credit: number
  total_sales_store_credit: number
  total_sales_other: number
  total_sales_count: number

  // Totais das movimentações
  total_supplies: number
  total_bleed: number
  total_expenses: number

  // Conferência Gerencial
  verified_by?: string | null
  verified_by_name?: string | null
  verified_at?: string | null
  verification_notes?: string | null

  created_at: string
  updated_at: string
}

export interface CashMovement {
  id: string
  company_id: string
  branch_id: string
  cash_session_id: string
  movement_type: CashMovementType
  amount: number
  reason: string
  user_id: string
  user_name?: string | null
  authorized_by?: string | null
  authorized_by_name?: string | null
  receipt_url?: string | null
  notes?: string | null
  created_at: string
}

export interface OpenCashSessionPayload {
  company_id: string
  branch_id: string
  terminal_name: string
  initial_amount: number
  opening_notes?: string
}

export interface AddCashMovementPayload {
  company_id: string
  branch_id: string
  cash_session_id: string
  movement_type: CashMovementType
  amount: number
  reason: string
  notes?: string
  receipt_url?: string
  authorized_by?: string
}

export interface CloseCashSessionPayload {
  company_id: string
  session_id: string
  counted_cash: number
  closing_notes?: string
  difference_reason?: string
}

export interface VerifyCashSessionPayload {
  company_id: string
  session_id: string
  verification_notes: string
}

export interface CashSessionLiveSummary {
  session: CashSession
  movements: CashMovement[]
  salesCount: number
  salesCash: number
  salesPix: number
  salesDebit: number
  salesCredit: number
  salesStoreCredit: number
  salesOther: number
  salesTotal: number
  suppliesTotal: number
  bleedTotal: number
  expensesTotal: number
  expectedCashNow: number
}
