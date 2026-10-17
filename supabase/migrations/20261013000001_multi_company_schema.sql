-- ==============================================================================
-- ETAPA 2: MIGRATION 01 - SCHEMA MULTIEMPRESA E MULTILOJA
-- Tabelas: companies, branches, profiles, user_company_access, user_branch_access
-- ==============================================================================

-- 1. Criação da extensão pgcrypto se ainda não existir
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Tabela: companies (Empresas do grupo / clientes SaaS)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name TEXT NOT NULL,
    trade_name TEXT NOT NULL,
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.companies IS 'Empresas / Pessoas jurídicas matrizes cadastradas no ERP';

-- 3. Tabela: branches (Matriz e Filiais pertencentes a uma empresa)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code VARCHAR(20) NOT NULL,
    cnpj VARCHAR(18),
    branch_type VARCHAR(20) NOT NULL DEFAULT 'filial' CHECK (branch_type IN ('matriz', 'filial')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    zip_code VARCHAR(10),
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT NOT NULL,
    state VARCHAR(2) NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_branch_company_code UNIQUE (company_id, code)
);

COMMENT ON TABLE public.branches IS 'Unidades de negócio (matriz e filiais) vinculadas a uma empresa';

-- 4. Tabela: profiles (Perfis de usuário estendidos a partir de auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Perfil público e dados cadastrais dos usuários do ERP';

-- 5. Tabela: user_company_access (Vínculo de usuário a uma empresa com papel/role)
CREATE TABLE IF NOT EXISTS public.user_company_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL DEFAULT 'operator' CHECK (role IN ('owner', 'admin', 'manager', 'salesperson', 'cashier', 'operator')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_company UNIQUE (user_id, company_id)
);

COMMENT ON TABLE public.user_company_access IS 'Autorização de acesso e papel do usuário em uma determinada empresa';

-- 6. Tabela: user_branch_access (Vínculo do usuário a filiais específicas da empresa)
CREATE TABLE IF NOT EXISTS public.user_branch_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_branch UNIQUE (user_id, branch_id)
);

COMMENT ON TABLE public.user_branch_access IS 'Acesso do usuário a unidades operacionais específicas';

-- 7. Índices para performance em filtros de multitenancy e integridade
CREATE INDEX IF NOT EXISTS idx_branches_company_id ON public.branches(company_id);
CREATE INDEX IF NOT EXISTS idx_user_company_access_user_id ON public.user_company_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_company_access_company_id ON public.user_company_access(company_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_user_id ON public.user_branch_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_branch_id ON public.user_branch_access(branch_id);

-- 8. Função e Trigger para validação de integridade:
-- Impede vincular usuário a uma filial sem que ele possua vínculo ativo com a empresa daquela filial
CREATE OR REPLACE FUNCTION public.check_user_branch_company_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_branch_company_id UUID;
    v_has_company_access BOOLEAN;
BEGIN
    -- Busca a empresa proprietária da filial
    SELECT company_id INTO v_branch_company_id
    FROM public.branches
    WHERE id = NEW.branch_id;

    IF v_branch_company_id IS NULL THEN
        RAISE EXCEPTION 'A filial indicada não existe.';
    END IF;

    -- Verifica se o usuário tem vínculo com a empresa
    SELECT EXISTS (
        SELECT 1
        FROM public.user_company_access
        WHERE user_id = NEW.user_id AND company_id = v_branch_company_id
    ) INTO v_has_company_access;

    IF NOT v_has_company_access THEN
        RAISE EXCEPTION 'Não é permitido vincular o usuário a uma filial sem vínculo prévio com a empresa proprietária.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_user_branch_access ON public.user_branch_access;
CREATE TRIGGER trg_validate_user_branch_access
    BEFORE INSERT OR UPDATE ON public.user_branch_access
    FOR EACH ROW
    EXECUTE FUNCTION public.check_user_branch_company_integrity();

-- 9. Trigger utilitário para atualização automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_branches_updated_at ON public.branches;
CREATE TRIGGER trg_branches_updated_at
    BEFORE UPDATE ON public.branches
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_user_company_access_updated_at ON public.user_company_access;
CREATE TRIGGER trg_user_company_access_updated_at
    BEFORE UPDATE ON public.user_company_access
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
