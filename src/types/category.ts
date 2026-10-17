export interface Category {
  id: string
  company_id: string
  name: string
  code?: string | null
  description?: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  products_count?: number
}

export interface CategoryFilters {
  search?: string
  status?: 'all' | 'active' | 'inactive'
}

export interface CategoryKpis {
  totalCategories: number
  activeCategories: number
  inactiveCategories: number
  totalCategorizedProducts: number
}
