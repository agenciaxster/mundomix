export type PersonType = 'PF' | 'PJ'
export type SupplierStatus = 'active' | 'inactive'

export interface Supplier {
  id: string
  company_id: string
  name: string
  trade_name?: string | null
  person_type: PersonType
  document?: string | null
  state_registration?: string | null
  email?: string | null
  phone?: string | null
  contact_name?: string | null
  zip_code?: string | null
  street?: string | null
  number?: string | null
  complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  notes?: string | null
  status: SupplierStatus
  created_at: string
  updated_at: string
}

export interface SupplierFilters {
  search?: string
  status?: 'all' | SupplierStatus
  personType?: 'all' | PersonType
}

export interface SupplierKpis {
  totalSuppliers: number
  activeSuppliers: number
  inactiveSuppliers: number
  pjCount: number
}
