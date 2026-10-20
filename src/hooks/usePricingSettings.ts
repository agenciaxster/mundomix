import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { pricingSettingsService } from '@/lib/services/pricing-settings.service'
import { calcMarkupPrice, DEFAULT_PRICING_SETTINGS, type CompanyPricingSettings } from '@/types/pricing'

interface UsePricingSettingsReturn {
  pricingSettings: CompanyPricingSettings | null
  isLoading: boolean
  /** Calcula o preço de venda com markup. Retorna 0 se custo ou markup for inválido. */
  getMarkupPrice: (costPrice: number) => number
  reload: () => void
}

/**
 * Hook para consumir as configurações de markup/precificação da empresa ativa.
 * Carrega do Supabase com fallback para localStorage e defaults.
 */
export function usePricingSettings(): UsePricingSettingsReturn {
  const { activeCompany } = useAuth()
  const companyId = activeCompany?.id || ''

  const [pricingSettings, setPricingSettings] = useState<CompanyPricingSettings | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) {
      setPricingSettings({ ...DEFAULT_PRICING_SETTINGS, company_id: '' })
      return
    }
    setIsLoading(true)
    try {
      const settings = await pricingSettingsService.getSettings(companyId)
      setPricingSettings(settings)
    } catch (err) {
      console.warn('[usePricingSettings] Erro ao carregar configurações de pricing:', err)
      setPricingSettings({ ...DEFAULT_PRICING_SETTINGS, company_id: companyId })
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  /**
   * Calcula o preço de venda com o markup configurado.
   * Usa o percentual de default_markup_percentage das configurações.
   */
  const getMarkupPrice = useCallback(
    (costPrice: number): number => {
      if (!pricingSettings) return 0
      return calcMarkupPrice(costPrice, pricingSettings.default_markup_percentage)
    },
    [pricingSettings]
  )

  return {
    pricingSettings,
    isLoading,
    getMarkupPrice,
    reload: load,
  }
}
