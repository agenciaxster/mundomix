-- ==============================================================================
-- ETAPA 2: MIGRATION 03 - POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- Isolamento estrito de dados por Empresa e Filial, controle de privilégios
-- ==============================================================================

-- 1. Habilitação de RLS em todas as tabelas privadas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;

-- 2. Funções auxiliares SECURITY DEFINER para checagem de permissão
-- Evitam recursão infinita de políticas RLS e garantem busca controlada no search_path public

CREATE OR REPLACE FUNCTION public.user_has_company_access(p_company_id UUID)
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
    );
$$;

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
    );
$$;

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
        JOIN public.user_company_access uca 
            ON uca.company_id = b.company_id 
           AND uca.user_id = auth.uid()
        LEFT JOIN public.user_branch_access uba 
            ON uba.branch_id = b.id 
           AND uba.user_id = auth.uid()
        WHERE b.id = p_branch_id
          -- Admins e proprietários da empresa têm acesso a todas as filiais da empresa
          -- Demais membros precisam de atribuição explícita na user_branch_access
          AND (uca.role IN ('owner', 'admin') OR uba.id IS NOT NULL)
    );
$$;

-- Restringe execução das funções apenas a usuários autenticados
REVOKE ALL ON FUNCTION public.user_has_company_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_is_company_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_branch_access(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.user_has_company_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_company_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_branch_access(UUID) TO authenticated;

-- ==============================================================================
-- 3. POLÍTICAS PARA A TABELA: companies
-- ==============================================================================

-- Consulta: apenas membros autorizados daquela empresa
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
CREATE POLICY "companies_select_policy" ON public.companies
    FOR SELECT
    TO authenticated
    USING (public.user_has_company_access(id));

-- Atualização: apenas administradores / proprietários da empresa
DROP POLICY IF EXISTS "companies_update_policy" ON public.companies;
CREATE POLICY "companies_update_policy" ON public.companies
    FOR UPDATE
    TO authenticated
    USING (public.user_is_company_admin(id))
    WITH CHECK (public.user_is_company_admin(id));

-- ==============================================================================
-- 4. POLÍTICAS PARA A TABELA: branches
-- ==============================================================================

-- Consulta: usuário deve ter acesso à filial (atribuído explicitamente ou ser admin da empresa)
DROP POLICY IF EXISTS "branches_select_policy" ON public.branches;
CREATE POLICY "branches_select_policy" ON public.branches
    FOR SELECT
    TO authenticated
    USING (public.user_has_branch_access(id));

-- Inserção: apenas administradores da empresa proprietária
DROP POLICY IF EXISTS "branches_insert_policy" ON public.branches;
CREATE POLICY "branches_insert_policy" ON public.branches
    FOR INSERT
    TO authenticated
    WITH CHECK (public.user_is_company_admin(company_id));

-- Atualização: apenas administradores da empresa proprietária
DROP POLICY IF EXISTS "branches_update_policy" ON public.branches;
CREATE POLICY "branches_update_policy" ON public.branches
    FOR UPDATE
    TO authenticated
    USING (public.user_is_company_admin(company_id))
    WITH CHECK (public.user_is_company_admin(company_id));

-- Exclusão: apenas administradores da empresa proprietária
DROP POLICY IF EXISTS "branches_delete_policy" ON public.branches;
CREATE POLICY "branches_delete_policy" ON public.branches
    FOR DELETE
    TO authenticated
    USING (public.user_is_company_admin(company_id));

-- ==============================================================================
-- 5. POLÍTICAS PARA A TABELA: profiles
-- ==============================================================================

-- Consulta: usuário pode ler seu próprio perfil ou perfis de colegas da mesma empresa
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.user_company_access viewer_uca
            JOIN public.user_company_access target_uca
                ON viewer_uca.company_id = target_uca.company_id
            WHERE viewer_uca.user_id = auth.uid()
              AND target_uca.user_id = profiles.id
        )
    );

-- Atualização: usuário pode atualizar apenas seu próprio perfil
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ==============================================================================
-- 6. POLÍTICAS PARA A TABELA: user_company_access
-- ==============================================================================

-- Consulta: usuário pode ver seus próprios vínculos ou admins veem todos da empresa
DROP POLICY IF EXISTS "user_company_access_select_policy" ON public.user_company_access;
CREATE POLICY "user_company_access_select_policy" ON public.user_company_access
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.user_is_company_admin(company_id)
    );

-- Inserção: apenas admins da empresa podem conceder acesso a outros membros
DROP POLICY IF EXISTS "user_company_access_insert_policy" ON public.user_company_access;
CREATE POLICY "user_company_access_insert_policy" ON public.user_company_access
    FOR INSERT
    TO authenticated
    WITH CHECK (public.user_is_company_admin(company_id));

-- Atualização: apenas admins da empresa podem alterar papéis
DROP POLICY IF EXISTS "user_company_access_update_policy" ON public.user_company_access;
CREATE POLICY "user_company_access_update_policy" ON public.user_company_access
    FOR UPDATE
    TO authenticated
    USING (public.user_is_company_admin(company_id))
    WITH CHECK (public.user_is_company_admin(company_id));

-- Exclusão: apenas admins da empresa podem revogar acesso
DROP POLICY IF EXISTS "user_company_access_delete_policy" ON public.user_company_access;
CREATE POLICY "user_company_access_delete_policy" ON public.user_company_access
    FOR DELETE
    TO authenticated
    USING (public.user_is_company_admin(company_id));

-- ==============================================================================
-- 7. POLÍTICAS PARA A TABELA: user_branch_access
-- ==============================================================================

-- Consulta: usuário pode ver suas próprias filiais vinculadas ou admins da empresa
DROP POLICY IF EXISTS "user_branch_access_select_policy" ON public.user_branch_access;
CREATE POLICY "user_branch_access_select_policy" ON public.user_branch_access
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.branches b
            WHERE b.id = branch_id
              AND public.user_is_company_admin(b.company_id)
        )
    );

-- Inserção: apenas admins da empresa dona da filial podem associar usuários
DROP POLICY IF EXISTS "user_branch_access_insert_policy" ON public.user_branch_access;
CREATE POLICY "user_branch_access_insert_policy" ON public.user_branch_access
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.branches b
            WHERE b.id = branch_id
              AND public.user_is_company_admin(b.company_id)
        )
    );

-- Exclusão: apenas admins da empresa dona da filial podem desvincular usuários
DROP POLICY IF EXISTS "user_branch_access_delete_policy" ON public.user_branch_access;
CREATE POLICY "user_branch_access_delete_policy" ON public.user_branch_access
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.branches b
            WHERE b.id = branch_id
              AND public.user_is_company_admin(b.company_id)
        )
    );
