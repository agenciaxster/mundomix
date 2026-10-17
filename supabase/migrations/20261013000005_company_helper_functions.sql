-- ==============================================================================
-- ETAPA 3: MIGRATION 05 — FUNÇÃO SEGURA PARA CONTAR FILIAIS ATIVAS POR EMPRESA
-- e VIEW para listagem de empresas com contagem de unidades
-- ==============================================================================

-- Função segura para retornar quantidade de filiais ativas por empresa
-- Usa SECURITY DEFINER para evitar bypass de RLS ao contar
CREATE OR REPLACE FUNCTION public.get_company_branch_count(p_company_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COUNT(*)::INTEGER
    FROM public.branches
    WHERE company_id = p_company_id
      AND status = 'active';
$$;

REVOKE ALL ON FUNCTION public.get_company_branch_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_branch_count(UUID) TO authenticated;

-- Função segura para verificar se empresa já possui uma matriz cadastrada
CREATE OR REPLACE FUNCTION public.company_has_headquarters(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.branches
        WHERE company_id = p_company_id
          AND branch_type = 'matriz'
    );
$$;

REVOKE ALL ON FUNCTION public.company_has_headquarters(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_has_headquarters(UUID) TO authenticated;
