-- ==============================================================================
-- MIGRATION: 20261016000001_receipt_settings.sql
-- DESCRIÇÃO: ETAPA 10 — Configurações de Impressão de Comprovantes Não Fiscais (PDV)
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA DE CONFIGURAÇÕES DE IMPRESSÃO DA EMPRESA (company_receipt_settings)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_receipt_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    paper_width VARCHAR(10) NOT NULL DEFAULT '80mm' CHECK (paper_width IN ('80mm', '58mm')),
    copies_count INTEGER NOT NULL DEFAULT 1 CHECK (copies_count IN (1, 2)),
    show_trade_name BOOLEAN NOT NULL DEFAULT TRUE,
    show_legal_name BOOLEAN NOT NULL DEFAULT TRUE,
    show_cnpj BOOLEAN NOT NULL DEFAULT TRUE,
    show_phone BOOLEAN NOT NULL DEFAULT TRUE,
    show_address BOOLEAN NOT NULL DEFAULT TRUE,
    show_operator BOOLEAN NOT NULL DEFAULT TRUE,
    show_customer BOOLEAN NOT NULL DEFAULT TRUE,
    show_item_discounts BOOLEAN NOT NULL DEFAULT TRUE,
    footer_message TEXT DEFAULT 'Obrigado pela preferência! Volte sempre!',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_company_receipt_settings UNIQUE (company_id)
);

COMMENT ON TABLE public.company_receipt_settings IS 'Parâmetros de formatação e emissão de comprovantes não fiscais térmicos';

-- Índice de busca por empresa
CREATE INDEX IF NOT EXISTS idx_company_receipt_settings_company ON public.company_receipt_settings(company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. POLÍTICAS DE SEGURANÇA ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.company_receipt_settings ENABLE ROW LEVEL SECURITY;

-- Usuários com acesso ativo à empresa podem visualizar as configurações de comprovante
DROP POLICY IF EXISTS "receipt_settings_select_policy" ON public.company_receipt_settings;
CREATE POLICY "receipt_settings_select_policy"
    ON public.company_receipt_settings
    FOR SELECT
    TO authenticated
    USING (public.user_has_company_access(company_id));

-- Administradores/Gerentes podem inserir configurações
DROP POLICY IF EXISTS "receipt_settings_insert_policy" ON public.company_receipt_settings;
CREATE POLICY "receipt_settings_insert_policy"
    ON public.company_receipt_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (public.user_is_company_admin(company_id));

-- Administradores/Gerentes podem atualizar configurações
DROP POLICY IF EXISTS "receipt_settings_update_policy" ON public.company_receipt_settings;
CREATE POLICY "receipt_settings_update_policy"
    ON public.company_receipt_settings
    FOR UPDATE
    TO authenticated
    USING (public.user_is_company_admin(company_id))
    WITH CHECK (public.user_is_company_admin(company_id));
