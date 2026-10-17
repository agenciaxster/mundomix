export type PersonType = 'individual' | 'company'
export type CreditStatus = 'available' | 'blocked' | 'under_review'
export type CustomerStatus = 'active' | 'inactive'

export interface Customer {
  id: string
  company_id: string
  origin_branch_id: string | null
  person_type: PersonType
  name: string
  trade_name: string | null
  document: string | null
  state_registration: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  zip_code: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  credit_limit: number
  credit_status: CreditStatus
  status: CustomerStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  origin_branch?: { id: string; name: string; code: string } | null
}

export interface CustomerCreditHistory {
  id: string
  company_id: string
  customer_id: string
  previous_limit: number
  new_limit: number
  reason: string
  user_id: string | null
  created_at: string
  user_name?: string
  user_email?: string
}

export interface CustomerFormData {
  person_type: PersonType
  name: string
  trade_name: string
  document: string
  state_registration: string
  email: string
  phone: string
  whatsapp: string
  zip_code: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  credit_limit: number
  credit_status: CreditStatus
  status: CustomerStatus
  notes: string
  origin_branch_id?: string | null
}

export interface CustomerFilters {
  search?: string
  personType?: 'all' | PersonType
  status?: 'all' | CustomerStatus
  creditStatus?: 'all' | CreditStatus
  page?: number
  pageSize?: number
}

export interface CustomerKpis {
  totalCustomers: number
  activeCustomers: number
  withCreditLimitCount: number
  totalCreditGranted: number
}
