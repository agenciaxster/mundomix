-- ==============================================================================
-- ETAPA 3/4: MIGRATION 20261014000002 — CORREÇÃO DEFINITIVA DE RLS PARA EMPRESAS
-- Resolve o erro: "new row violates row-level security policy for table companies"
-- 1. Garante que todas as colunas de endereço existam
-- 2. Adiciona a coluna created_by com DEFAULT auth.uid()
-- 3. Atualiza a política de SELECT para aceitar quem tem acesso OU quem criou a empresa
--    (essencial para que o RETURNING * do Supabase funcione sem violar RLS no INSERT)
-- 4. Atualiza a política de INSERT para qualquer usuário autenticado
-- 5. Trigger que associa o criador como 'owner'/'admin' em user_company_access
-- ==============================================================================

-- 1. Campos de endereço e registro
ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS state_registration TEXT,
    ADD COLUMN IF NOT EXISTS zip_code           VARCHAR(10),
    ADD COLUMN IF NOT EXISTS street             TEXT,
    ADD COLUMN IF NOT EXISTS number             TEXT,
    ADD COLUMN IF NOT EXISTS complement         TEXT,
    ADD COLUMN IF NOT EXISTS neighborhood       TEXT,
    ADD COLUMN IF NOT EXISTS city               TEXT,
    ADD COLUMN IF NOT EXISTS state              VARCHAR(2),
    ADD COLUMN IF NOT EXISTS created_by         UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- 2. Campos faltantes em branches
ALTER TABLE public.branches
    ADD COLUMN IF NOT EXISTS state_registration TEXT,
    ADD COLUMN IF NOT EXISTS email              TEXT;

-- 3. Índices de performance
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies(created_by);
CREATE INDEX IF NOT EXISTS idx_companies_city       ON public.companies(city);
CREATE INDEX IF NOT EXISTS idx_companies_state      ON public.companies(state);
CREATE INDEX IF NOT EXISTS idx_branches_city        ON public.branches(city);
CREATE INDEX IF NOT EXISTS idx_branches_state       ON public.branches(state);
CREATE INDEX IF NOT EXISTS idx_branches_status      ON public.branches(status);
CREATE INDEX IF NOT EXISTS idx_companies_status     ON public.companies(status);

-- 4. RLS — Permite INSERT para usuários autenticados
DROP POLICY IF EXISTS "companies_insert_policy" ON public.companies;
CREATE POLICY "companies_insert_policy" ON public.companies
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- 5. RLS — Permite SELECT tanto para membros existentes quanto para quem criou o registro
-- (Isso resolve a violação de RLS durante o comando INSERT ... RETURNING do Supabase)
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
CREATE POLICY "companies_select_policy" ON public.companies
    FOR SELECT
    TO authenticated
    USING (
        public.user_has_company_access(id)
        OR created_by = auth.uid()
    );

-- 6. RLS — Permite UPDATE para administradores ou para o criador
DROP POLICY IF EXISTS "companies_update_policy" ON public.companies;
CREATE POLICY "companies_update_policy" ON public.companies
    FOR UPDATE
    TO authenticated
    USING (
        public.user_is_company_admin(id)
        OR created_by = auth.uid()
    )
    WITH CHECK (
        public.user_is_company_admin(id)
        OR created_by = auth.uid()
    );

-- 7. Trigger que vincula automaticamente o criador como 'owner'/'admin' em user_company_access
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_role_id UUID;
BEGIN
    SELECT id INTO v_admin_role_id FROM public.roles WHERE slug = 'admin' LIMIT 1;

    IF auth.uid() IS NOT NULL THEN
        INSERT INTO public.user_company_access (user_id, company_id, role, role_id, status)
        VALUES (auth.uid(), NEW.id, 'owner', v_admin_role_id, 'active')
        ON CONFLICT (user_id, company_id) DO UPDATE
            SET role = 'owner',
                role_id = COALESCE(v_admin_role_id, public.user_company_access.role_id),
                status = 'active';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_auto_admin ON public.companies;
CREATE TRIGGER trg_company_auto_admin
    AFTER INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_company();

-- 8. Recarregar o cache do schema no PostgREST
NOTIFY pgrst, 'reload schema';
