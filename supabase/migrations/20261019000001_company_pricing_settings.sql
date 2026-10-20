-- ============================================================
-- Migration: company_pricing_settings
-- Cria tabela para configurações de markup/precificação
-- Não altera nenhuma tabela existente
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_pricing_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  default_markup_percentage NUMERIC(6, 2) NOT NULL DEFAULT 0,
  apply_markup_on_import BOOLEAN NOT NULL DEFAULT false,
  apply_markup_on_pdv BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_pricing_settings_company_id_unique UNIQUE (company_id)
);

-- Índice para lookup rápido por empresa
CREATE INDEX IF NOT EXISTS idx_company_pricing_settings_company_id
  ON public.company_pricing_settings (company_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.company_pricing_settings ENABLE ROW LEVEL SECURITY;

-- Membros da empresa podem ler suas configurações
CREATE POLICY "company_pricing_settings_select"
  ON public.company_pricing_settings
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.user_company_access
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Admins/owners podem inserir e atualizar
CREATE POLICY "company_pricing_settings_upsert"
  ON public.company_pricing_settings
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.user_company_access
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.user_company_access
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_company_pricing_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_pricing_settings_updated_at
  BEFORE UPDATE ON public.company_pricing_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_pricing_settings_updated_at();
