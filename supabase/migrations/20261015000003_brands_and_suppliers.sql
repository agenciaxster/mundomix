-- ==============================================================================
-- MIGRATION: 20261015000003_brands_and_suppliers.sql
-- DESCRIÇÃO: Gestão de Marcas Comerciais e Cadastro de Fornecedores
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA DE MARCAS (brands)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    logo_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_brand_company_name UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_brands_company ON public.brands(company_id);
CREATE INDEX IF NOT EXISTS idx_brands_name ON public.brands(name);
CREATE INDEX IF NOT EXISTS idx_brands_status ON public.brands(status);

-- Adiciona brand_id na tabela products caso ainda não exista
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id);

-- RLS para brands
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brands_select_policy" ON public.brands;
CREATE POLICY "brands_select_policy" ON public.brands
    FOR SELECT TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "brands_insert_policy" ON public.brands;
CREATE POLICY "brands_insert_policy" ON public.brands
    FOR INSERT TO authenticated
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "brands_update_policy" ON public.brands;
CREATE POLICY "brands_update_policy" ON public.brands
    FOR UPDATE TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "brands_delete_policy" ON public.brands;
CREATE POLICY "brands_delete_policy" ON public.brands
    FOR DELETE TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Migra automaticamente as marcas textuais existentes na tabela products
INSERT INTO public.brands (company_id, name, status)
SELECT DISTINCT company_id, TRIM(brand), 'active'
FROM public.products
WHERE brand IS NOT NULL AND TRIM(brand) <> ''
ON CONFLICT (company_id, name) DO NOTHING;

-- Vincula os produtos existentes ao respectivo brand_id
UPDATE public.products p
SET brand_id = b.id
FROM public.brands b
WHERE p.company_id = b.company_id
  AND TRIM(p.brand) = b.name
  AND p.brand_id IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA DE FORNECEDORES (suppliers)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    person_type VARCHAR(2) NOT NULL DEFAULT 'PJ' CHECK (person_type IN ('PF', 'PJ')),
    document VARCHAR(20),
    state_registration VARCHAR(30),
    email VARCHAR(255),
    phone VARCHAR(30),
    contact_name VARCHAR(100),
    zip_code VARCHAR(10),
    street VARCHAR(255),
    number VARCHAR(30),
    complement VARCHAR(100),
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(2),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_company ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_document ON public.suppliers(document);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);

-- RLS para suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select_policy" ON public.suppliers;
CREATE POLICY "suppliers_select_policy" ON public.suppliers
    FOR SELECT TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "suppliers_insert_policy" ON public.suppliers;
CREATE POLICY "suppliers_insert_policy" ON public.suppliers
    FOR INSERT TO authenticated
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "suppliers_update_policy" ON public.suppliers;
CREATE POLICY "suppliers_update_policy" ON public.suppliers
    FOR UPDATE TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "suppliers_delete_policy" ON public.suppliers;
CREATE POLICY "suppliers_delete_policy" ON public.suppliers
    FOR DELETE TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );
