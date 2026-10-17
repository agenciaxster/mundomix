-- ==============================================================================
-- MIGRATION 20261014000009 — HABILITA POLÍTICAS DE EXCLUSÃO (DELETE) PARA PRODUTOS E ESTOQUE
-- Permite exclusão de produtos e saldos de estoque por administradores e usuários da empresa
-- ==============================================================================

-- 1. Política de DELETE para products
DROP POLICY IF EXISTS "products_delete_policy" ON public.products;
CREATE POLICY "products_delete_policy" ON public.products
    FOR DELETE
    TO authenticated
    USING (
        public.user_is_company_admin(company_id)
        OR public.user_has_company_access(company_id)
    );

-- 2. Política de DELETE para branch_stock
DROP POLICY IF EXISTS "branch_stock_delete_policy" ON public.branch_stock;
CREATE POLICY "branch_stock_delete_policy" ON public.branch_stock
    FOR DELETE
    TO authenticated
    USING (
        public.user_is_company_admin(company_id)
        OR public.user_has_company_access(company_id)
    );

-- 3. Notifica o PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
