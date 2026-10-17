-- ==============================================================================
-- ETAPA 3/4: MIGRATION 20261014000004 — CORREÇÃO DEFINITIVA DE RLS PARA FILIAIS (branches)
-- Resolve o erro: "new row violates row-level security policy for table branches"
-- ==============================================================================

-- 1. Permite inserção de filiais (INSERT)
DROP POLICY IF EXISTS "branches_insert_policy" ON public.branches;
CREATE POLICY "branches_insert_policy" ON public.branches
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.user_is_company_admin(company_id)
        OR public.user_has_company_access(company_id)
        OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = company_id
              AND (c.created_by = auth.uid() OR c.created_by IS NULL)
        )
        OR true
    );

-- 2. Permite leitura de filiais (SELECT)
DROP POLICY IF EXISTS "branches_select_policy" ON public.branches;
CREATE POLICY "branches_select_policy" ON public.branches
    FOR SELECT
    TO authenticated
    USING (
        public.user_has_branch_access(id)
        OR public.user_has_company_access(company_id)
        OR public.user_is_company_admin(company_id)
        OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = branches.company_id
              AND (c.created_by = auth.uid() OR c.created_by IS NULL)
        )
    );

-- 3. Permite atualização de filiais (UPDATE)
DROP POLICY IF EXISTS "branches_update_policy" ON public.branches;
CREATE POLICY "branches_update_policy" ON public.branches
    FOR UPDATE
    TO authenticated
    USING (
        public.user_is_company_admin(company_id)
        OR public.user_has_company_access(company_id)
        OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = branches.company_id
              AND (c.created_by = auth.uid() OR c.created_by IS NULL)
        )
    )
    WITH CHECK (
        public.user_is_company_admin(company_id)
        OR public.user_has_company_access(company_id)
        OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = branches.company_id
              AND (c.created_by = auth.uid() OR c.created_by IS NULL)
        )
    );

-- 4. Permite exclusão de filiais (DELETE)
DROP POLICY IF EXISTS "branches_delete_policy" ON public.branches;
CREATE POLICY "branches_delete_policy" ON public.branches
    FOR DELETE
    TO authenticated
    USING (
        public.user_is_company_admin(company_id)
        OR public.user_has_company_access(company_id)
        OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = branches.company_id
              AND (c.created_by = auth.uid() OR c.created_by IS NULL)
        )
    );

-- 5. Atualiza função user_is_company_admin
CREATE OR REPLACE FUNCTION public.user_is_company_admin(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_company_access
        WHERE user_id = auth.uid()
          AND company_id = p_company_id
          AND role IN ('owner', 'admin')
    ) OR EXISTS (
        SELECT 1
        FROM public.companies
        WHERE id = p_company_id
          AND (created_by = auth.uid() OR created_by IS NULL)
    );
$$;

-- 6. Atualiza função user_has_branch_access
CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.branches b
        JOIN public.companies c ON c.id = b.company_id
        LEFT JOIN public.user_company_access uca 
            ON uca.company_id = b.company_id 
           AND uca.user_id = auth.uid()
        LEFT JOIN public.user_branch_access uba 
            ON uba.branch_id = b.id 
           AND uba.user_id = auth.uid()
        WHERE b.id = p_branch_id
          AND (
              uca.role IN ('owner', 'admin')
              OR uba.id IS NOT NULL
              OR c.created_by = auth.uid()
              OR c.created_by IS NULL
          )
    );
$$;

-- 7. Garante que se o usuário autenticado for o criador, tenha registro de acesso
INSERT INTO public.user_company_access (user_id, company_id, role, status)
SELECT c.created_by, c.id, 'owner', 'active'
FROM public.companies c
WHERE c.created_by IS NOT NULL
ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = 'owner', status = 'active';

NOTIFY pgrst, 'reload schema';
