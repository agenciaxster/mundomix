export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type CompanyStatus = 'active' | 'inactive' | 'suspended'
export type BranchType = 'matriz' | 'filial'
export type BranchStatus = 'active' | 'inactive'
export type ProfileStatus = 'active' | 'inactive' | 'blocked'
export type AccessStatus = 'active' | 'inactive'
export type UserCompanyRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'salesperson'
  | 'cashier'
  | 'operator'

export type SystemModule =
  | 'users'
  | 'companies'
  | 'products'
  | 'sales'
  | 'stock'
  | 'financial'
  | 'reports'
  | 'settings'

export type ActionType = 'view' | 'create' | 'edit' | 'delete'

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          legal_name: string
          trade_name: string
          cnpj: string
          state_registration: string | null
          email: string | null
          phone: string | null
          status: CompanyStatus
          zip_code: string | null
          street: string | null
          number: string | null
          complement: string | null
          neighborhood: string | null
          city: string | null
          state: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          legal_name: string
          trade_name: string
          cnpj: string
          state_registration?: string | null
          email?: string | null
          phone?: string | null
          status?: CompanyStatus
          zip_code?: string | null
          street?: string | null
          number?: string | null
          complement?: string | null
          neighborhood?: string | null
          city?: string | null
          state?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          legal_name?: string
          trade_name?: string
          cnpj?: string
          state_registration?: string | null
          email?: string | null
          phone?: string | null
          status?: CompanyStatus
          zip_code?: string | null
          street?: string | null
          number?: string | null
          complement?: string | null
          neighborhood?: string | null
          city?: string | null
          state?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          id: string
          company_id: string
          name: string
          code: string
          cnpj: string | null
          state_registration: string | null
          branch_type: BranchType
          status: BranchStatus
          zip_code: string | null
          street: string | null
          number: string | null
          complement: string | null
          neighborhood: string | null
          city: string
          state: string
          phone: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          code: string
          cnpj?: string | null
          state_registration?: string | null
          branch_type?: BranchType
          status?: BranchStatus
          zip_code?: string | null
          street?: string | null
          number?: string | null
          complement?: string | null
          neighborhood?: string | null
          city: string
          state: string
          phone?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          code?: string
          cnpj?: string | null
          state_registration?: string | null
          branch_type?: BranchType
          status?: BranchStatus
          zip_code?: string | null
          street?: string | null
          number?: string | null
          complement?: string | null
          neighborhood?: string | null
          city?: string
          state?: string
          phone?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'branches_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          status: ProfileStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          phone?: string | null
          status?: ProfileStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          phone?: string | null
          status?: ProfileStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          id: string
          company_id: string | null
          name: string
          slug: string
          description: string | null
          is_system: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          name: string
          slug: string
          description?: string | null
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          name?: string
          slug?: string
          description?: string | null
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'roles_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          }
        ]
      }
      role_permissions: {
        Row: {
          id: string
          role_id: string
          module: string
          can_view: boolean
          can_create: boolean
          can_edit: boolean
          can_delete: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          role_id: string
          module: string
          can_view?: boolean
          can_create?: boolean
          can_edit?: boolean
          can_delete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role_id?: string
          module?: string
          can_view?: boolean
          can_create?: boolean
          can_edit?: boolean
          can_delete?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'role_permissions_role_id_fkey'
            columns: ['role_id']
            referencedRelation: 'roles'
            referencedColumns: ['id']
          }
        ]
      }
      user_company_access: {
        Row: {
          id: string
          user_id: string
          company_id: string
          role: UserCompanyRole
          role_id: string | null
          status: AccessStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id: string
          role?: UserCompanyRole
          role_id?: string | null
          status?: AccessStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string
          role?: UserCompanyRole
          role_id?: string | null
          status?: AccessStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_company_access_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_company_access_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_company_access_role_id_fkey'
            columns: ['role_id']
            referencedRelation: 'roles'
            referencedColumns: ['id']
          }
        ]
      }
      user_branch_access: {
        Row: {
          id: string
          user_id: string
          branch_id: string
          status: AccessStatus
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          branch_id: string
          status?: AccessStatus
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          branch_id?: string
          status?: AccessStatus
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_branch_access_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_branch_access_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          }
        ]
      }
      products: {
        Row: {
          id: string
          company_id: string
          name: string
          sku: string | null
          barcode: string | null
          category: string | null
          brand: string | null
          image_url: string | null
          unit: string
          cost_price: number
          sale_price: number
          wholesale_price: number | null
          wholesale_min_qty: number | null
          max_discount_percentage: number | null
          min_stock: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          sku?: string | null
          barcode?: string | null
          category?: string | null
          brand?: string | null
          image_url?: string | null
          unit?: string
          cost_price?: number
          sale_price?: number
          wholesale_price?: number | null
          wholesale_min_qty?: number | null
          max_discount_percentage?: number | null
          min_stock?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          sku?: string | null
          barcode?: string | null
          category?: string | null
          brand?: string | null
          image_url?: string | null
          unit?: string
          cost_price?: number
          sale_price?: number
          wholesale_price?: number | null
          wholesale_min_qty?: number | null
          max_discount_percentage?: number | null
          min_stock?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          }
        ]
      }
      branch_stock: {
        Row: {
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
        }
        Insert: {
          id?: string
          company_id: string
          branch_id: string
          product_id: string
          quantity?: number
          reserved_quantity?: number
          min_stock?: number
          last_movement_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          branch_id?: string
          product_id?: string
          quantity?: number
          reserved_quantity?: number
          min_stock?: number
          last_movement_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'branch_stock_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'branch_stock_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'branch_stock_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      stock_movements: {
        Row: {
          id: string
          company_id: string
          branch_id: string
          product_id: string
          movement_type: string
          quantity: number
          balance_before: number
          balance_after: number
          reason: string
          notes: string | null
          user_id: string | null
          reference_id: string | null
          reference_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          branch_id: string
          product_id: string
          movement_type: string
          quantity: number
          balance_before: number
          balance_after: number
          reason: string
          notes?: string | null
          user_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          branch_id?: string
          product_id?: string
          movement_type?: string
          quantity?: number
          balance_before?: number
          balance_after?: number
          reason?: string
          notes?: string | null
          user_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stock_movements_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_movements_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_movements_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      stock_transfers: {
        Row: {
          id: string
          company_id: string
          code: string
          origin_branch_id: string
          destination_branch_id: string
          status: string
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
        }
        Insert: {
          id?: string
          company_id: string
          code: string
          origin_branch_id: string
          destination_branch_id: string
          status?: string
          notes?: string | null
          shipped_by?: string | null
          shipped_at?: string | null
          received_by?: string | null
          received_at?: string | null
          cancelled_by?: string | null
          cancelled_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          code?: string
          origin_branch_id?: string
          destination_branch_id?: string
          status?: string
          notes?: string | null
          shipped_by?: string | null
          shipped_at?: string | null
          received_by?: string | null
          received_at?: string | null
          cancelled_by?: string | null
          cancelled_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stock_transfers_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_transfers_origin_branch_id_fkey'
            columns: ['origin_branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_transfers_destination_branch_id_fkey'
            columns: ['destination_branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          }
        ]
      }
      stock_transfer_items: {
        Row: {
          id: string
          transfer_id: string
          product_id: string
          quantity_sent: number
          quantity_received: number
          created_at: string
        }
        Insert: {
          id?: string
          transfer_id: string
          product_id: string
          quantity_sent: number
          quantity_received?: number
          created_at?: string
        }
        Update: {
          id?: string
          transfer_id?: string
          product_id?: string
          quantity_sent?: number
          quantity_received?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stock_transfer_items_transfer_id_fkey'
            columns: ['transfer_id']
            referencedRelation: 'stock_transfers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_transfer_items_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      customers: {
        Row: {
          id: string
          company_id: string
          origin_branch_id: string | null
          person_type: 'individual' | 'company'
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
          credit_status: 'available' | 'blocked' | 'under_review'
          status: 'active' | 'inactive'
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          origin_branch_id?: string | null
          person_type?: 'individual' | 'company'
          name: string
          trade_name?: string | null
          document?: string | null
          state_registration?: string | null
          email?: string | null
          phone?: string | null
          whatsapp?: string | null
          zip_code?: string | null
          street?: string | null
          number?: string | null
          complement?: string | null
          neighborhood?: string | null
          city?: string | null
          state?: string | null
          credit_limit?: number
          credit_status?: 'available' | 'blocked' | 'under_review'
          status?: 'active' | 'inactive'
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          origin_branch_id?: string | null
          person_type?: 'individual' | 'company'
          name?: string
          trade_name?: string | null
          document?: string | null
          state_registration?: string | null
          email?: string | null
          phone?: string | null
          whatsapp?: string | null
          zip_code?: string | null
          street?: string | null
          number?: string | null
          complement?: string | null
          neighborhood?: string | null
          city?: string | null
          state?: string | null
          credit_limit?: number
          credit_status?: 'available' | 'blocked' | 'under_review'
          status?: 'active' | 'inactive'
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customers_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customers_origin_branch_id_fkey'
            columns: ['origin_branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          }
        ]
      }
      customer_credit_history: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          previous_limit: number
          new_limit: number
          reason: string
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          customer_id: string
          previous_limit?: number
          new_limit: number
          reason: string
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string
          previous_limit?: number
          new_limit?: number
          reason?: string
          user_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customer_credit_history_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_credit_history_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          }
        ]
      }
      quotes: {
        Row: {
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
          status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted'
          subtotal: number
          discount_type: 'percentage' | 'value'
          discount_value: number
          discount_amount: number
          total: number
          notes: string | null
          valid_until: string
          converted_at: string | null
          converted_to_sale_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          branch_id: string
          quote_number?: number
          code: string
          customer_id?: string | null
          customer_name?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_phone?: string | null
          user_id: string
          status?: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted'
          subtotal?: number
          discount_type?: 'percentage' | 'value'
          discount_value?: number
          discount_amount?: number
          total?: number
          notes?: string | null
          valid_until?: string
          converted_at?: string | null
          converted_to_sale_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          branch_id?: string
          quote_number?: number
          code?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_phone?: string | null
          user_id?: string
          status?: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted'
          subtotal?: number
          discount_type?: 'percentage' | 'value'
          discount_value?: number
          discount_amount?: number
          total?: number
          notes?: string | null
          valid_until?: string
          converted_at?: string | null
          converted_to_sale_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          product_id: string
          product_name: string
          product_sku: string | null
          product_barcode: string | null
          unit: string
          quantity: number
          unit_price: number
          price_type: 'retail' | 'wholesale' | 'custom'
          discount: number
          subtotal: number
          total: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          product_id: string
          product_name: string
          product_sku?: string | null
          product_barcode?: string | null
          unit?: string
          quantity: number
          unit_price: number
          price_type?: 'retail' | 'wholesale' | 'custom'
          discount?: number
          subtotal?: number
          total?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          product_id?: string
          product_name?: string
          product_sku?: string | null
          product_barcode?: string | null
          unit?: string
          quantity?: number
          unit_price?: number
          price_type?: 'retail' | 'wholesale' | 'custom'
          discount?: number
          subtotal?: number
          total?: number
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      quote_status_history: {
        Row: {
          id: string
          quote_id: string
          company_id: string
          previous_status: string | null
          new_status: string
          reason: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          company_id: string
          previous_status?: string | null
          new_status: string
          reason?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          company_id?: string
          previous_status?: string | null
          new_status?: string
          reason?: string | null
          user_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_has_company_access: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      user_is_company_admin: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      user_has_branch_access: {
        Args: { p_branch_id: string }
        Returns: boolean
      }
      get_company_branch_count: {
        Args: { p_company_id: string }
        Returns: number
      }
      company_has_headquarters: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { p_company_id: string; p_module: string; p_action: string }
        Returns: boolean
      }
      assign_user_to_company: {
        Args: {
          p_company_id: string
          p_target_user_id: string
          p_role: string
          p_role_id: string | null
          p_branch_ids: string[] | null
        }
        Returns: Json
      }
      execute_stock_movement: {
        Args: {
          p_company_id: string
          p_branch_id: string
          p_product_id: string
          p_movement_type: string
          p_quantity: number
          p_reason: string
          p_notes?: string | null
          p_reference_id?: string | null
          p_reference_type?: string | null
        }
        Returns: Json
      }
      ship_stock_transfer: {
        Args: {
          p_transfer_id: string
          p_notes?: string | null
        }
        Returns: Json
      }
      receive_stock_transfer: {
        Args: {
          p_transfer_id: string
          p_notes?: string | null
        }
        Returns: Json
      }
      cancel_stock_transfer: {
        Args: {
          p_transfer_id: string
          p_notes?: string | null
        }
        Returns: Json
      }
      update_customer_credit_limit: {
        Args: {
          p_company_id: string
          p_customer_id: string
          p_new_limit: number
          p_reason: string
          p_credit_status?: string | null
        }
        Returns: Json
      }
      save_quote: {
        Args: {
          p_payload: Json
        }
        Returns: Json
      }
      update_quote_status: {
        Args: {
          p_quote_id: string
          p_new_status: string
          p_reason?: string | null
        }
        Returns: Json
      }
      duplicate_quote: {
        Args: {
          p_quote_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
