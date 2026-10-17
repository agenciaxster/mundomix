import { supabase } from '@/lib/supabase'
import {
  DEFAULT_RECEIPT_SETTINGS,
  type CompanyReceiptSettings,
} from '@/types/receipt'

const STORAGE_PREFIX = 'erp_receipt_settings_'

export const receiptSettingsService = {
  /**
   * Obtém as configurações de impressão para a empresa ativa.
   * Busca no Supabase e aplica fallback gracioso para cache local e defaults.
   */
  async getSettings(companyId: string): Promise<CompanyReceiptSettings> {
    if (!companyId) {
      return {
        ...DEFAULT_RECEIPT_SETTINGS,
        company_id: '',
      }
    }

    // 1. Tenta buscar no Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('company_receipt_settings')
          .select('*')
          .eq('company_id', companyId)
          .maybeSingle()

        if (!error && data) {
          const settings: CompanyReceiptSettings = {
            id: data.id,
            company_id: data.company_id,
            paper_width: data.paper_width === '58mm' ? '58mm' : '80mm',
            copies_count: data.copies_count === 2 ? 2 : 1,
            show_trade_name: data.show_trade_name ?? true,
            show_legal_name: data.show_legal_name ?? true,
            show_cnpj: data.show_cnpj ?? true,
            show_phone: data.show_phone ?? true,
            show_address: data.show_address ?? true,
            show_operator: data.show_operator ?? true,
            show_customer: data.show_customer ?? true,
            show_item_discounts: data.show_item_discounts ?? true,
            footer_message: data.footer_message ?? DEFAULT_RECEIPT_SETTINGS.footer_message,
            created_at: data.created_at,
            updated_at: data.updated_at,
          }
          // Salva no cache local
          this.saveToLocal(companyId, settings)
          return settings
        }
      } catch (err) {
        console.warn('Aviso ao consultar company_receipt_settings no Supabase:', err)
      }
    }

    // 2. Fallback: tenta recuperar do localStorage
    const local = this.getFromLocal(companyId)
    if (local) return local

    // 3. Retorna defaults
    return {
      ...DEFAULT_RECEIPT_SETTINGS,
      company_id: companyId,
    }
  },

  /**
   * Salva ou atualiza as configurações de impressão de comprovante.
   */
  async saveSettings(
    companyId: string,
    settings: Partial<CompanyReceiptSettings>
  ): Promise<CompanyReceiptSettings> {
    if (!companyId) throw new Error('ID da empresa é obrigatório.')

    const payload = {
      company_id: companyId,
      paper_width: settings.paper_width || '80mm',
      copies_count: settings.copies_count || 1,
      show_trade_name: settings.show_trade_name ?? true,
      show_legal_name: settings.show_legal_name ?? true,
      show_cnpj: settings.show_cnpj ?? true,
      show_phone: settings.show_phone ?? true,
      show_address: settings.show_address ?? true,
      show_operator: settings.show_operator ?? true,
      show_customer: settings.show_customer ?? true,
      show_item_discounts: settings.show_item_discounts ?? true,
      footer_message: settings.footer_message ?? DEFAULT_RECEIPT_SETTINGS.footer_message,
      updated_at: new Date().toISOString(),
    }

    let savedRemote: CompanyReceiptSettings | null = null

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('company_receipt_settings')
          .upsert(payload, { onConflict: 'company_id' })
          .select('*')
          .single()

        if (!error && data) {
          savedRemote = data as CompanyReceiptSettings
        } else if (error) {
          console.warn('Aviso ao persistir configurações no Supabase:', error.message)
        }
      } catch (err) {
        console.warn('Erro ao salvar no Supabase:', err)
      }
    }

    const finalSettings: CompanyReceiptSettings = savedRemote || {
      ...payload,
      id: settings.id || crypto.randomUUID(),
    }

    this.saveToLocal(companyId, finalSettings)
    return finalSettings
  },

  getFromLocal(companyId: string): CompanyReceiptSettings | null {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${companyId}`)
      if (stored) return JSON.parse(stored)
    } catch {
      // Ignora erro de JSON
    }
    return null
  },

  saveToLocal(companyId: string, settings: CompanyReceiptSettings): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${companyId}`, JSON.stringify(settings))
    } catch {
      // Ignora erro de localStorage
    }
  },
}
