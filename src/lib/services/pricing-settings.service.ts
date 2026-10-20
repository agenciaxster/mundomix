import { supabase } from '@/lib/supabase'
import {
  DEFAULT_PRICING_SETTINGS,
  type CompanyPricingSettings,
} from '@/types/pricing'

const STORAGE_PREFIX = 'erp_pricing_settings_'

export const pricingSettingsService = {
  /**
   * Obtém as configurações de precificação/markup para a empresa ativa.
   * Busca no Supabase e aplica fallback gracioso para cache local e defaults.
   */
  async getSettings(companyId: string): Promise<CompanyPricingSettings> {
    if (!companyId) {
      return { ...DEFAULT_PRICING_SETTINGS, company_id: '' }
    }

    // 1. Tenta buscar no Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('company_pricing_settings')
          .select('*')
          .eq('company_id', companyId)
          .maybeSingle()

        if (!error && data) {
          const settings: CompanyPricingSettings = {
            id: data.id,
            company_id: data.company_id,
            default_markup_percentage: Number(data.default_markup_percentage ?? 0),
            apply_markup_on_import: Boolean(data.apply_markup_on_import ?? false),
            apply_markup_on_pdv: Boolean(data.apply_markup_on_pdv ?? false),
            created_at: data.created_at,
            updated_at: data.updated_at,
          }
          // Salva no cache local
          this.saveToLocal(companyId, settings)
          return settings
        }
      } catch (err) {
        // Tabela ainda não criada ou erro de acesso — fallback gracioso
        console.warn('[PricingSettings] Aviso ao consultar company_pricing_settings:', err)
      }
    }

    // 2. Fallback: tenta recuperar do localStorage
    const local = this.getFromLocal(companyId)
    if (local) return local

    // 3. Retorna defaults
    return { ...DEFAULT_PRICING_SETTINGS, company_id: companyId }
  },

  /**
   * Salva ou atualiza as configurações de precificação/markup da empresa.
   */
  async saveSettings(
    companyId: string,
    settings: Partial<CompanyPricingSettings>
  ): Promise<CompanyPricingSettings> {
    if (!companyId) throw new Error('ID da empresa é obrigatório.')

    const payload = {
      company_id: companyId,
      default_markup_percentage: Math.max(0, Number(settings.default_markup_percentage ?? 0)),
      apply_markup_on_import: Boolean(settings.apply_markup_on_import ?? false),
      apply_markup_on_pdv: Boolean(settings.apply_markup_on_pdv ?? false),
      updated_at: new Date().toISOString(),
    }

    let savedRemote: CompanyPricingSettings | null = null

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('company_pricing_settings')
          .upsert(payload, { onConflict: 'company_id' })
          .select('*')
          .single()

        if (!error && data) {
          savedRemote = data as CompanyPricingSettings
        } else if (error) {
          console.warn('[PricingSettings] Aviso ao persistir no Supabase:', error.message)
        }
      } catch (err) {
        console.warn('[PricingSettings] Erro ao salvar no Supabase:', err)
      }
    }

    const finalSettings: CompanyPricingSettings = savedRemote || {
      ...payload,
      id: settings.id || crypto.randomUUID(),
    }

    this.saveToLocal(companyId, finalSettings)
    return finalSettings
  },

  getFromLocal(companyId: string): CompanyPricingSettings | null {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${companyId}`)
      if (stored) return JSON.parse(stored)
    } catch {
      // Ignora erro de JSON
    }
    return null
  },

  saveToLocal(companyId: string, settings: CompanyPricingSettings): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${companyId}`, JSON.stringify(settings))
    } catch {
      // Ignora erro de localStorage
    }
  },
}
