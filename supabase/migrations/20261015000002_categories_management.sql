-- ==============================================================================
-- MIGRATION: 20261015000002_categories_management.sql
-- DESCRIÇÃO: Tabela de Categorias e relacionamento formal com Produtos
-- ==============================================================================

-- 1. Criação da Tabela categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_category_company_name UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_company ON public.categories(company_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_status ON public.categories(status);

-- 2. Adiciona category_id na tabela products caso ainda não exista
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- 3. Habilita RLS na tabela categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de RLS para categories
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
CREATE POLICY "categories_select_policy" ON public.categories
    FOR SELECT TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
CREATE POLICY "categories_insert_policy" ON public.categories
    FOR INSERT TO authenticated
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
CREATE POLICY "categories_update_policy" ON public.categories
    FOR UPDATE TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;
CREATE POLICY "categories_delete_policy" ON public.categories
    FOR DELETE TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- 5. Migra automaticamente as categorias textuais existentes na tabela products
INSERT INTO public.categories (company_id, name, status)
SELECT DISTINCT company_id, TRIM(category), 'active'
FROM public.products
WHERE category IS NOT NULL AND TRIM(category) <> ''
ON CONFLICT (company_id, name) DO NOTHING;

-- 6. Vincula os produtos existentes ao respectivo category_id
UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE p.company_id = c.company_id
  AND TRIM(p.category) = c.name
  AND p.category_id IS NULL;
