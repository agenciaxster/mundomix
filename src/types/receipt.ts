import type { Sale } from './sale'
import type { Company } from './auth'

export type ReceiptPaperWidth = '80mm' | '58mm'
export type ReceiptCopiesCount = 1 | 2

export interface CompanyReceiptSettings {
  id?: string
  company_id: string
  paper_width: ReceiptPaperWidth
  copies_count: ReceiptCopiesCount
  show_trade_name: boolean
  show_legal_name: boolean
  show_cnpj: boolean
  show_phone: boolean
  show_address: boolean
  show_operator: boolean
  show_customer: boolean
  show_item_discounts: boolean
  footer_message: string
  created_at?: string
  updated_at?: string
}

export const DEFAULT_RECEIPT_SETTINGS: Omit<CompanyReceiptSettings, 'company_id'> = {
  paper_width: '80mm',
  copies_count: 1,
  show_trade_name: true,
  show_legal_name: true,
  show_cnpj: true,
  show_phone: true,
  show_address: true,
  show_operator: true,
  show_customer: true,
  show_item_discounts: true,
  footer_message: 'Obrigado pela preferência! Volte sempre!',
}

export interface PrintableReceiptData {
  sale: Sale
  company?: Company | null
  settings: CompanyReceiptSettings
  copyIndex?: number
  totalCopies?: number
  isReprint?: boolean
}
