-- ==============================================================================
-- MIGRATION: 20261014000007_customers_and_credit_limits.sql
-- DESCRIÇÃO: ETAPA 7 — Cadastro de Clientes e Limites de Crédito
-- ==============================================================================

-- 1. Tabela: customers (Base de clientes da empresa, compartilhada entre filiais)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    origin_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    person_type VARCHAR(20) NOT NULL DEFAULT 'individual' CHECK (person_type IN ('individual', 'company')),
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    document VARCHAR(20),
    state_registration VARCHAR(30),
    email VARCHAR(255),
    phone VARCHAR(25),
    whatsapp VARCHAR(25),
    zip_code VARCHAR(10),
    street VARCHAR(255),
    number VARCHAR(30),
    complement VARCHAR(100),
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(2),
    credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (credit_limit >= 0),
    credit_status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (credit_status IN ('available', 'blocked', 'under_review')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customers IS 'Cadastro unificado de clientes por empresa com gestão de limite de crédito';

-- Índices para otimização de busca e filtragem
CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(company_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_document ON public.customers(company_id, document);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(company_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(company_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_credit_status ON public.customers(company_id, credit_status);

-- Unicidade de CPF/CNPJ dentro da mesma empresa (quando informado)
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_company_document
    ON public.customers (company_id, document)
    WHERE document IS NOT NULL AND document <> '';

-- 2. Tabela: customer_credit_history (Histórico auditável e imutável de alterações de limite)
CREATE TABLE IF NOT EXISTS public.customer_credit_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    previous_limit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    new_limit NUMERIC(12, 2) NOT NULL CHECK (new_limit >= 0),
    reason TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customer_credit_history IS 'Log auditável de concessões, expansões e reduções de limite de crédito';

CREATE INDEX IF NOT EXISTS idx_credit_history_customer ON public.customer_credit_history(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_history_company ON public.customer_credit_history(company_id, created_at DESC);

-- Trigger de imutabilidade do histórico de crédito
CREATE OR REPLACE FUNCTION public.prevent_credit_history_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Registros de histórico de limite de crédito são imutáveis e auditáveis.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_credit_history_mutation ON public.customer_credit_history;
CREATE TRIGGER trg_prevent_credit_history_mutation
    BEFORE UPDATE OR DELETE ON public.customer_credit_history
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_credit_history_mutation();

-- 3. Função RPC Atômica para Ajuste Auditado de Limite de Crédito
CREATE OR REPLACE FUNCTION public.update_customer_credit_limit(
    p_company_id UUID,
    p_customer_id UUID,
    p_new_limit NUMERIC,
    p_reason TEXT,
    p_credit_status VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_customer RECORD;
    v_history_id UUID;
    v_status_to_set VARCHAR;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF p_new_limit < 0 THEN
        RAISE EXCEPTION 'O limite de crédito não pode ser negativo.';
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'A justificativa para alteração do limite de crédito é obrigatória.';
    END IF;

    -- Validação de acesso à empresa
    IF NOT public.user_has_company_access(p_company_id) THEN
        RAISE EXCEPTION 'Usuário não possui acesso a esta empresa.';
    END IF;

    -- Localiza o cliente com trava de linha
    SELECT * INTO v_customer
    FROM public.customers
    WHERE id = p_customer_id AND company_id = p_company_id
    FOR UPDATE;

    IF v_customer.id IS NULL THEN
        RAISE EXCEPTION 'Cliente não encontrado nesta empresa.';
    END IF;

    v_status_to_set := COALESCE(p_credit_status, v_customer.credit_status);

    -- Insere registro no log auditável
    INSERT INTO public.customer_credit_history (
        company_id,
        customer_id,
        previous_limit,
        new_limit,
        reason,
        user_id
    ) VALUES (
        p_company_id,
        p_customer_id,
        v_customer.credit_limit,
        p_new_limit,
        p_reason,
        v_user_id
    ) RETURNING id INTO v_history_id;

    -- Atualiza o cadastro do cliente
    UPDATE public.customers
    SET credit_limit = p_new_limit,
        credit_status = v_status_to_set,
        updated_at = now()
    WHERE id = p_customer_id;

    RETURN jsonb_build_object(
        'success', true,
        'history_id', v_history_id,
        'previous_limit', v_customer.credit_limit,
        'new_limit', p_new_limit,
        'credit_status', v_status_to_set
    );
END;
$$;

-- 4. Habilitação de RLS e Políticas de Segurança

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_history ENABLE ROW LEVEL SECURITY;

-- Políticas para customers
DROP POLICY IF EXISTS "customers_select_policy" ON public.customers;
CREATE POLICY "customers_select_policy" ON public.customers
    FOR SELECT TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "customers_insert_policy" ON public.customers;
CREATE POLICY "customers_insert_policy" ON public.customers
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "customers_update_policy" ON public.customers;
CREATE POLICY "customers_update_policy" ON public.customers
    FOR UPDATE TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "customers_delete_policy" ON public.customers;
CREATE POLICY "customers_delete_policy" ON public.customers
    FOR DELETE TO authenticated
    USING (public.user_is_company_admin(company_id));

-- Políticas para customer_credit_history
DROP POLICY IF EXISTS "credit_history_select_policy" ON public.customer_credit_history;
CREATE POLICY "credit_history_select_policy" ON public.customer_credit_history
    FOR SELECT TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "credit_history_insert_policy" ON public.customer_credit_history;
CREATE POLICY "credit_history_insert_policy" ON public.customer_credit_history
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_company_access(company_id));
