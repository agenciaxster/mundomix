export interface CompanyPricingSettings {
  id?: string
  company_id: string
  /** Percentual de markup padrão sobre o custo. Ex: 30 = 30% */
  default_markup_percentage: number
  /** Se true, aplica markup ao sale_price no momento da importação XLS (grava no banco) */
  apply_markup_on_import: boolean
  /** Se true, aplica markup em tempo real no PDV/Orçamento quando sale_price = 0 */
  apply_markup_on_pdv: boolean
  created_at?: string
  updated_at?: string
}

export const DEFAULT_PRICING_SETTINGS: Omit<CompanyPricingSettings, 'company_id'> = {
  default_markup_percentage: 0,
  apply_markup_on_import: false,
  apply_markup_on_pdv: false,
}

/**
 * Calcula o preço de venda a partir do custo e do percentual de markup.
 * Fórmula: costPrice * (1 + markupPercentage / 100)
 * Arredonda para 2 casas decimais.
 */
export function calcMarkupPrice(costPrice: number, markupPercentage: number): number {
  if (!costPrice || costPrice <= 0 || !markupPercentage || markupPercentage <= 0) return 0
  return Math.round(costPrice * (1 + markupPercentage / 100) * 100) / 100
}
