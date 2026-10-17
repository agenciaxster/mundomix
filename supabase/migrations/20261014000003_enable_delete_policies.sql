-- ==============================================================================
-- ETAPA 3/4: MIGRATION 20261014000003 — HABILITA POLÍTICAS DE EXCLUSÃO (DELETE)
-- Permite exclusão de empresas, filiais e desvinculação de usuários
-- ==============================================================================

-- 1. Política de DELETE para empresas (companies)
-- Permite que administradores da empresa ou o criador da empresa a excluam
DROP POLICY IF EXISTS "companies_delete_policy" ON public.companies;
CREATE POLICY "companies_delete_policy" ON public.companies
    FOR DELETE
    TO authenticated
    USING (
        public.user_is_company_admin(id)
        OR created_by = auth.uid()
    );

-- 2. Política de DELETE para filiais (branches)
-- Permite que administradores da empresa excluam suas filiais
DROP POLICY IF EXISTS "branches_delete_policy" ON public.branches;
CREATE POLICY "branches_delete_policy" ON public.branches
    FOR DELETE
    TO authenticated
    USING (
        public.user_is_company_admin(company_id)
        OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = branches.company_id
              AND (c.created_by = auth.uid() OR public.user_is_company_admin(c.id))
        )
    );

-- 3. Política de DELETE para vínculos (user_company_access)
-- Permite que o próprio usuário se desvincule OU que admins da empresa removam o vínculo
DROP POLICY IF EXISTS "user_company_access_delete_policy" ON public.user_company_access;
CREATE POLICY "user_company_access_delete_policy" ON public.user_company_access
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.user_is_company_admin(company_id)
    );

-- 4. Política de DELETE para vínculos de filiais (user_branch_access)
DROP POLICY IF EXISTS "user_branch_access_delete_policy" ON public.user_branch_access;
CREATE POLICY "user_branch_access_delete_policy" ON public.user_branch_access
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.branches b
            WHERE b.id = user_branch_access.branch_id
              AND public.user_is_company_admin(b.company_id)
        )
    );

-- 5. Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';
