export interface Brand {
  id: string
  company_id: string
  name: string
  code?: string | null
  description?: string | null
  logo_url?: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  products_count?: number
}

export interface BrandFilters {
  search?: string
  status?: 'all' | 'active' | 'inactive'
}

export interface BrandKpis {
  totalBrands: number
  activeBrands: number
  inactiveBrands: number
  totalBrandedProducts: number
}
