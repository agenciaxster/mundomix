-- ==============================================================================
-- ETAPA 4: MIGRATION 06 - PERFIS DE ACESSO, PERMISSÕES E EXTENSÕES
-- Tabelas: roles, role_permissions, user_permissions_override
-- ==============================================================================

-- 1. Tabela de perfis/cargos de acesso (customizáveis por empresa ou sistema padrão)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Um slug deve ser único por empresa, ou global se company_id for nulo
    CONSTRAINT uq_roles_company_slug UNIQUE NULLS NOT DISTINCT (company_id, slug)
);

COMMENT ON TABLE public.roles IS 'Perfis de acesso do sistema (admin, gerente, vendedor, caixa, etc)';

-- 2. Tabela de permissões detalhadas por perfil
-- Módulos: users, companies, products, sales, stock, financial, reports, settings
-- Ações: view, create, edit, delete
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT false,
    can_create BOOLEAN NOT NULL DEFAULT false,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    can_delete BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_role_module UNIQUE (role_id, module)
);

COMMENT ON TABLE public.role_permissions IS 'Matriz de permissões por módulo e ação para cada perfil';

-- 3. Adicionar coluna role_id na user_company_access para associar perfis configuráveis
ALTER TABLE public.user_company_access
    ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

COMMENT ON COLUMN public.user_company_access.role_id IS 'Perfil de acesso configurável associado ao vínculo';
COMMENT ON COLUMN public.user_company_access.status IS 'Status do acesso à empresa (active/inactive) permitindo desativar sem apagar histórico';

-- 4. Adicionar coluna status na user_branch_access para permitir desativar acesso à filial sem apagar histórico
ALTER TABLE public.user_branch_access
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

COMMENT ON COLUMN public.user_branch_access.status IS 'Status do acesso à filial (active/inactive)';

-- 5. Trigger de updated_at para roles e role_permissions
DROP TRIGGER IF EXISTS trg_roles_updated_at ON public.roles;
CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON public.roles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_role_permissions_updated_at ON public.role_permissions;
CREATE TRIGGER trg_role_permissions_updated_at
    BEFORE UPDATE ON public.role_permissions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Inserir perfis de sistema padrão caso não existam
INSERT INTO public.roles (id, company_id, name, slug, description, is_system)
VALUES
    ('a0000000-0000-0000-0000-000000000001', NULL, 'Administrador', 'admin', 'Acesso total a todas as funcionalidades e configurações da empresa', true),
    ('a0000000-0000-0000-0000-000000000002', NULL, 'Gerente', 'manager', 'Gestão operacional de vendas, estoque, compras e relatórios', true),
    ('a0000000-0000-0000-0000-000000000003', NULL, 'Vendedor', 'salesperson', 'Atendimento, orçamentos, pedidos de venda e clientes', true),
    ('a0000000-0000-0000-0000-000000000004', NULL, 'Operador de Caixa', 'cashier', 'Operação de frente de caixa PDV, recebimentos e abertura/fechamento', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Preencher permissões dos perfis padrão do sistema
-- Admin: tudo liberado em todos os módulos
INSERT INTO public.role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
VALUES
    -- Admin
    ('a0000000-0000-0000-0000-000000000001', 'users', true, true, true, true),
    ('a0000000-0000-0000-0000-000000000001', 'companies', true, true, true, true),
    ('a0000000-0000-0000-0000-000000000001', 'products', true, true, true, true),
    ('a0000000-0000-0000-0000-000000000001', 'sales', true, true, true, true),
    ('a0000000-0000-0000-0000-000000000001', 'stock', true, true, true, true),
    ('a0000000-0000-0000-0000-000000000001', 'financial', true, true, true, true),
    ('a0000000-0000-0000-0000-000000000001', 'reports', true, true, true, true),
    ('a0000000-0000-0000-0000-000000000001', 'settings', true, true, true, true),

    -- Gerente
    ('a0000000-0000-0000-0000-000000000002', 'users', true, false, false, false),
    ('a0000000-0000-0000-0000-000000000002', 'companies', true, false, false, false),
    ('a0000000-0000-0000-0000-000000000002', 'products', true, true, true, false),
    ('a0000000-0000-0000-0000-000000000002', 'sales', true, true, true, true),
    ('a0000000-0000-0000-0000-000000000002', 'stock', true, true, true, false),
    ('a0000000-0000-0000-0000-000000000002', 'financial', true, true, true, false),
    ('a0000000-0000-0000-0000-000000000002', 'reports', true, true, false, false),
    ('a0000000-0000-0000-0000-000000000002', 'settings', true, false, false, false),

    -- Vendedor
    ('a0000000-0000-0000-0000-000000000003', 'users', false, false, false, false),
    ('a0000000-0000-0000-0000-000000000003', 'companies', false, false, false, false),
    ('a0000000-0000-0000-0000-000000000003', 'products', true, false, false, false),
    ('a0000000-0000-0000-0000-000000000003', 'sales', true, true, true, false),
    ('a0000000-0000-0000-0000-000000000003', 'stock', true, false, false, false),
    ('a0000000-0000-0000-0000-000000000003', 'financial', false, false, false, false),
    ('a0000000-0000-0000-0000-000000000003', 'reports', true, false, false, false),
    ('a0000000-0000-0000-0000-000000000003', 'settings', false, false, false, false),

    -- Operador de Caixa
    ('a0000000-0000-0000-0000-000000000004', 'users', false, false, false, false),
    ('a0000000-0000-0000-0000-000000000004', 'companies', false, false, false, false),
    ('a0000000-0000-0000-0000-000000000004', 'products', true, false, false, false),
    ('a0000000-0000-0000-0000-000000000004', 'sales', true, true, false, false),
    ('a0000000-0000-0000-0000-000000000004', 'stock', false, false, false, false),
    ('a0000000-0000-0000-0000-000000000004', 'financial', true, true, false, false),
    ('a0000000-0000-0000-0000-000000000004', 'reports', false, false, false, false),
    ('a0000000-0000-0000-0000-000000000004', 'settings', false, false, false, false)
ON CONFLICT (role_id, module) DO NOTHING;

-- 8. Vincular retroativamente role_id em user_company_access existentes que estiverem sem role_id
UPDATE public.user_company_access
SET role_id = CASE
    WHEN role IN ('owner', 'admin') THEN 'a0000000-0000-0000-0000-000000000001'::uuid
    WHEN role = 'manager' THEN 'a0000000-0000-0000-0000-000000000002'::uuid
    WHEN role = 'salesperson' THEN 'a0000000-0000-0000-0000-000000000003'::uuid
    WHEN role = 'cashier' THEN 'a0000000-0000-0000-0000-000000000004'::uuid
    ELSE 'a0000000-0000-0000-0000-000000000004'::uuid
END
WHERE role_id IS NULL;

-- 9. Habilitar RLS em roles e role_permissions
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas para roles:
-- Leitura: Perfis do sistema (company_id is null) ou da empresa à qual o usuário tem acesso
DROP POLICY IF EXISTS "roles_select_policy" ON public.roles;
CREATE POLICY "roles_select_policy" ON public.roles
    FOR SELECT
    TO authenticated
    USING (
        company_id IS NULL
        OR public.user_has_company_access(company_id)
    );

-- Modificação de roles customizados: apenas administradores da empresa
DROP POLICY IF EXISTS "roles_insert_policy" ON public.roles;
CREATE POLICY "roles_insert_policy" ON public.roles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id IS NOT NULL
        AND public.user_is_company_admin(company_id)
        AND is_system = false
    );

DROP POLICY IF EXISTS "roles_update_policy" ON public.roles;
CREATE POLICY "roles_update_policy" ON public.roles
    FOR UPDATE
    TO authenticated
    USING (
        company_id IS NOT NULL
        AND public.user_is_company_admin(company_id)
        AND is_system = false
    )
    WITH CHECK (
        company_id IS NOT NULL
        AND public.user_is_company_admin(company_id)
        AND is_system = false
    );

DROP POLICY IF EXISTS "roles_delete_policy" ON public.roles;
CREATE POLICY "roles_delete_policy" ON public.roles
    FOR DELETE
    TO authenticated
    USING (
        company_id IS NOT NULL
        AND public.user_is_company_admin(company_id)
        AND is_system = false
    );

-- Políticas para role_permissions:
-- Leitura: qualquer usuário autenticado pode ler as permissões dos perfis visíveis
DROP POLICY IF EXISTS "role_permissions_select_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_select_policy" ON public.role_permissions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.roles r
            WHERE r.id = role_permissions.role_id
              AND (r.company_id IS NULL OR public.user_has_company_access(r.company_id))
        )
    );

-- Modificação de permissões: apenas para roles não de sistema da empresa do admin
DROP POLICY IF EXISTS "role_permissions_insert_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_insert_policy" ON public.role_permissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.roles r
            WHERE r.id = role_permissions.role_id
              AND r.company_id IS NOT NULL
              AND r.is_system = false
              AND public.user_is_company_admin(r.company_id)
        )
    );

DROP POLICY IF EXISTS "role_permissions_update_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_update_policy" ON public.role_permissions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.roles r
            WHERE r.id = role_permissions.role_id
              AND r.company_id IS NOT NULL
              AND r.is_system = false
              AND public.user_is_company_admin(r.company_id)
        )
    );

DROP POLICY IF EXISTS "role_permissions_delete_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_delete_policy" ON public.role_permissions
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.roles r
            WHERE r.id = role_permissions.role_id
              AND r.company_id IS NOT NULL
              AND r.is_system = false
              AND public.user_is_company_admin(r.company_id)
        )
    );

-- 10. Função utilitária para verificar se o usuário logado tem permissão em determinado módulo e ação
CREATE OR REPLACE FUNCTION public.user_has_permission(
    p_company_id UUID,
    p_module TEXT,
    p_action TEXT -- 'view', 'create', 'edit', 'delete'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_role_id UUID;
    v_status TEXT;
    v_allowed BOOLEAN := false;
BEGIN
    -- Busca o vínculo do usuário na empresa
    SELECT uca.role, uca.role_id, uca.status
    INTO v_role, v_role_id, v_status
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = p_company_id;

    -- Se o vínculo não existir ou estiver inativo, nega
    IF v_role IS NULL OR v_status = 'inactive' THEN
        RETURN false;
    END IF;

    -- Proprietários e Administradores possuem acesso total irrestrito
    IF v_role IN ('owner', 'admin') THEN
        RETURN true;
    END IF;

    -- Se não houver role_id configurado, mapeia pela role legada padrão
    IF v_role_id IS NULL THEN
        SELECT r.id INTO v_role_id
        FROM public.roles r
        WHERE r.slug = v_role AND r.company_id IS NULL
        LIMIT 1;
    END IF;

    IF v_role_id IS NULL THEN
        RETURN false;
    END IF;

    -- Checa permissão na tabela role_permissions
    SELECT
        CASE p_action
            WHEN 'view'   THEN rp.can_view
            WHEN 'create' THEN rp.can_create
            WHEN 'edit'   THEN rp.can_edit
            WHEN 'delete' THEN rp.can_delete
            ELSE false
        END INTO v_allowed
    FROM public.role_permissions rp
    WHERE rp.role_id = v_role_id
      AND rp.module = p_module;

    RETURN COALESCE(v_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_permission(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_permission(UUID, TEXT, TEXT) TO authenticated;

-- 11. Função RPC segura para convidar/criar usuário no Auth + Profile
-- A criação de usuário do Supabase requer service_role no Auth API ou Edge Function.
-- Criamos uma função de conveniência que cadastra o profile e vínculos se o chamador for admin da empresa,
-- e que impede auto-promoção e escalada de privilégios.
CREATE OR REPLACE FUNCTION public.assign_user_to_company(
    p_company_id UUID,
    p_target_user_id UUID,
    p_role TEXT,
    p_role_id UUID,
    p_branch_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role TEXT;
    v_branch_id UUID;
BEGIN
    -- 1. Verifica privilégios do chamador
    SELECT role INTO v_caller_role
    FROM public.user_company_access
    WHERE user_id = auth.uid() AND company_id = p_company_id AND status = 'active';

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores da empresa podem vincular membros.';
    END IF;

    -- 2. Proteção contra escalada: Não-owner não pode conceder papel 'owner'
    IF p_role = 'owner' AND v_caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Apenas o proprietário (owner) pode atribuir a função de proprietário.';
    END IF;

    -- 3. Proteção contra auto-promoção: se o usuário estiver alterando o próprio perfil
    IF p_target_user_id = auth.uid() AND v_caller_role <> 'owner' AND p_role = 'owner' THEN
        RAISE EXCEPTION 'Não é permitido se auto-promover a proprietário.';
    END IF;

    -- 4. Cria ou atualiza o vínculo de empresa
    INSERT INTO public.user_company_access (user_id, company_id, role, role_id, status)
    VALUES (p_target_user_id, p_company_id, p_role, p_role_id, 'active')
    ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role,
        role_id = EXCLUDED.role_id,
        status = 'active',
        updated_at = now();

    -- 5. Atualiza vínculos de filiais:
    -- Remove vínculos de filiais desta empresa que não estejam na lista
    DELETE FROM public.user_branch_access uba
    WHERE uba.user_id = p_target_user_id
      AND uba.branch_id IN (
          SELECT b.id FROM public.branches b WHERE b.company_id = p_company_id
      )
      AND (p_branch_ids IS NULL OR uba.branch_id <> ALL(p_branch_ids));

    -- Insere novos vínculos de filiais autorizadas
    IF p_branch_ids IS NOT NULL THEN
        FOREACH v_branch_id IN ARRAY p_branch_ids
        LOOP
            -- Garante que a filial pertence à empresa
            IF EXISTS (SELECT 1 FROM public.branches WHERE id = v_branch_id AND company_id = p_company_id) THEN
                INSERT INTO public.user_branch_access (user_id, branch_id, status)
                VALUES (p_target_user_id, v_branch_id, 'active')
                ON CONFLICT (user_id, branch_id) DO UPDATE
                SET status = 'active';
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_to_company(UUID, UUID, TEXT, UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_user_to_company(UUID, UUID, TEXT, UUID, UUID[]) TO authenticated;
