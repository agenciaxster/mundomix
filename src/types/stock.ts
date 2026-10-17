export type StockMovementType =
  | 'entry'
  | 'exit'
  | 'adjustment'
  | 'transfer_out'
  | 'transfer_in'
  | 'reversal'

export type StockTransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled'

export interface Product {
  id: string
  company_id: string
  name: string
  sku: string | null
  barcode: string | null
  category: string | null
  brand?: string | null
  image_url?: string | null
  unit: string
  cost_price: number
  sale_price: number
  wholesale_price?: number | null
  wholesale_min_qty?: number | null
  max_discount_percentage?: number | null
  min_stock: number
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface BranchStockItem {
  id: string
  company_id: string
  branch_id: string
  product_id: string
  quantity: number
  reserved_quantity: number
  min_stock: number
  last_movement_at: string | null
  created_at: string
  updated_at: string
  product?: Product
}

export interface StockMovement {
  id: string
  company_id: string
  branch_id: string
  product_id: string
  movement_type: StockMovementType
  quantity: number
  balance_before: number
  balance_after: number
  reason: string
  notes: string | null
  user_id: string | null
  reference_id: string | null
  reference_type: string | null
  created_at: string
  product?: Product
  user_email?: string
  user_name?: string
}

export interface StockTransferItem {
  id: string
  transfer_id: string
  product_id: string
  quantity_sent: number
  quantity_received: number
  created_at: string
  product?: Product
}

export interface StockTransfer {
  id: string
  company_id: string
  code: string
  origin_branch_id: string
  destination_branch_id: string
  status: StockTransferStatus
  notes: string | null
  shipped_by: string | null
  shipped_at: string | null
  received_by: string | null
  received_at: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  origin_branch?: { id: string; name: string; code: string }
  destination_branch?: { id: string; name: string; code: string }
  items?: StockTransferItem[]
}

export interface StockKpis {
  totalProductsWithStock: number
  lowStockCount: number
  zeroStockCount: number
  monthlyEntries: number
  monthlyExits: number
  pendingTransfersCount: number
}

export interface ExecuteMovementPayload {
  company_id: string
  branch_id: string
  product_id: string
  movement_type: 'entry' | 'exit' | 'adjustment'
  quantity: number
  reason: string
  notes?: string
  reference_id?: string
  reference_type?: string
}

export interface CreateTransferPayload {
  company_id: string
  origin_branch_id: string
  destination_branch_id: string
  notes?: string
  items: {
    product_id: string
    quantity: number
  }[]
}
