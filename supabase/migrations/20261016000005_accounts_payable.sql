-- ==============================================================================
-- MIGRATION: 20261016000005_accounts_payable.sql
-- DESCRIÇÃO: Módulo de Contas a Pagar, Categorias Financeiras e Integração com Caixa
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA DE CATEGORIAS FINANCEIRAS (financial_categories)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    type VARCHAR(20) NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
    color VARCHAR(30) DEFAULT 'blue',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_financial_category_company_name UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_financial_categories_company ON public.financial_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_categories_type ON public.financial_categories(company_id, type);
CREATE INDEX IF NOT EXISTS idx_financial_categories_status ON public.financial_categories(company_id, status);

-- Seed de Categorias Básicas Padrão para empresas existentes
INSERT INTO public.financial_categories (company_id, name, code, type, color, status)
SELECT c.id, cat.name, cat.code, 'expense', cat.color, 'active'
FROM public.companies c
CROSS JOIN (
    VALUES
        ('Aluguel', 'ALUGUEL', 'amber'),
        ('Água e Energia', 'AGUA_LUZ', 'cyan'),
        ('Internet e Telefone', 'TELECOM', 'indigo'),
        ('Fornecedores e Mercadorias', 'FORNECEDORES', 'blue'),
        ('Serviços Contratados', 'SERVICOS', 'purple'),
        ('Folha de Pagamento', 'SALARIOS', 'emerald'),
        ('Impostos e Taxas', 'IMPOSTOS', 'rose'),
        ('Manutenção', 'MANUTENCAO', 'orange'),
        ('Outras Despesas', 'OUTROS', 'slate')
) AS cat(name, code, color)
ON CONFLICT (company_id, name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA DE CONTAS A PAGAR (accounts_payable)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.accounts_payable_seq START 1;

CREATE TABLE IF NOT EXISTS public.accounts_payable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
    document_number VARCHAR(100),
    description VARCHAR(255) NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    competence_date DATE,
    due_date DATE NOT NULL,
    original_amount NUMERIC(12, 2) NOT NULL CHECK (original_amount > 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    interest_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (interest_amount >= 0),
    fine_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (fine_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    balance_amount NUMERIC(12, 2) NOT NULL CHECK (balance_amount >= 0),
    installments_count INT NOT NULL DEFAULT 1 CHECK (installments_count >= 1),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    notes TEXT,
    attachment_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.accounts_payable IS 'Registro principal de contas e despesas a pagar';

CREATE INDEX IF NOT EXISTS idx_accounts_payable_company ON public.accounts_payable(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_branch ON public.accounts_payable(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_supplier ON public.accounts_payable(company_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_category ON public.accounts_payable(company_id, category_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_due_date ON public.accounts_payable(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_status ON public.accounts_payable(company_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABELA DE PARCELAS DE CONTAS A PAGAR (accounts_payable_installments)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounts_payable_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payable_id UUID NOT NULL REFERENCES public.accounts_payable(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    installment_number INT NOT NULL CHECK (installment_number >= 1),
    due_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    balance_amount NUMERIC(12, 2) NOT NULL CHECK (balance_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payable_installment UNIQUE (payable_id, installment_number)
);

COMMENT ON TABLE public.accounts_payable_installments IS 'Parcelas individualizadas de contas a pagar';

CREATE INDEX IF NOT EXISTS idx_payable_inst_payable_id ON public.accounts_payable_installments(payable_id);
CREATE INDEX IF NOT EXISTS idx_payable_inst_company ON public.accounts_payable_installments(company_id);
CREATE INDEX IF NOT EXISTS idx_payable_inst_branch ON public.accounts_payable_installments(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_payable_inst_due_date ON public.accounts_payable_installments(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_payable_inst_status ON public.accounts_payable_installments(company_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABELA DE HISTÓRICO DE PAGAMENTOS DE CONTAS A PAGAR (payable_payments)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payable_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    payable_id UUID NOT NULL REFERENCES public.accounts_payable(id) ON DELETE CASCADE,
    installment_id UUID NOT NULL REFERENCES public.accounts_payable_installments(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
    cash_movement_id UUID REFERENCES public.cash_movements(id) ON DELETE SET NULL,
    amount_paid NUMERIC(12, 2) NOT NULL CHECK (amount_paid > 0),
    discount_applied NUMERIC(12, 2) NOT NULL DEFAULT 0,
    interest_applied NUMERIC(12, 2) NOT NULL DEFAULT 0,
    fine_applied NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'pix', 'bank_transfer', 'credit_card', 'bank_slip', 'other')),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    receipt_url TEXT,
    idempotency_key VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payable_payments IS 'Histórico auditável e imutável de pagamentos de contas';

CREATE INDEX IF NOT EXISTS idx_payable_pay_inst ON public.payable_payments(installment_id);
CREATE INDEX IF NOT EXISTS idx_payable_pay_payable ON public.payable_payments(payable_id);
CREATE INDEX IF NOT EXISTS idx_payable_pay_company ON public.payable_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payable_pay_date ON public.payable_payments(company_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payable_pay_cash_session ON public.payable_payments(cash_session_id);

-- Trigger de Imutabilidade dos Pagamentos de Contas a Pagar
CREATE OR REPLACE FUNCTION public.prevent_payable_payment_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Histórico de pagamentos de contas a pagar é estritamente imutável para garantir auditoria financeira.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_payable_payment_tampering ON public.payable_payments;
CREATE TRIGGER trg_prevent_payable_payment_tampering
    BEFORE DELETE OR UPDATE ON public.payable_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_payable_payment_tampering();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. POLÍTICAS RLS (Multi-empresa e Filiais)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payable_payments ENABLE ROW LEVEL SECURITY;

-- Categorias
DROP POLICY IF EXISTS "financial_categories_select_policy" ON public.financial_categories;
CREATE POLICY "financial_categories_select_policy" ON public.financial_categories
    FOR SELECT TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "financial_categories_all_policy" ON public.financial_categories;
CREATE POLICY "financial_categories_all_policy" ON public.financial_categories
    FOR ALL TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Contas a Pagar
DROP POLICY IF EXISTS "accounts_payable_select_policy" ON public.accounts_payable;
CREATE POLICY "accounts_payable_select_policy" ON public.accounts_payable
    FOR SELECT TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "accounts_payable_insert_policy" ON public.accounts_payable;
CREATE POLICY "accounts_payable_insert_policy" ON public.accounts_payable
    FOR INSERT TO authenticated
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "accounts_payable_update_policy" ON public.accounts_payable;
CREATE POLICY "accounts_payable_update_policy" ON public.accounts_payable
    FOR UPDATE TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Parcelas
DROP POLICY IF EXISTS "accounts_payable_inst_select_policy" ON public.accounts_payable_installments;
CREATE POLICY "accounts_payable_inst_select_policy" ON public.accounts_payable_installments
    FOR SELECT TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "accounts_payable_inst_all_policy" ON public.accounts_payable_installments;
CREATE POLICY "accounts_payable_inst_all_policy" ON public.accounts_payable_installments
    FOR ALL TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Pagamentos
DROP POLICY IF EXISTS "payable_payments_select_policy" ON public.payable_payments;
CREATE POLICY "payable_payments_select_policy" ON public.payable_payments
    FOR SELECT TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "payable_payments_insert_policy" ON public.payable_payments;
CREATE POLICY "payable_payments_insert_policy" ON public.payable_payments
    FOR INSERT TO authenticated
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FUNÇÃO RPC: pay_payable_installment (Quitação / Baixa Atômica)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pay_payable_installment(
    p_company_id UUID,
    p_branch_id UUID,
    p_installment_id UUID,
    p_amount NUMERIC(12, 2),
    p_payment_method VARCHAR(50),
    p_cash_session_id UUID DEFAULT NULL,
    p_discount NUMERIC(12, 2) DEFAULT 0,
    p_interest NUMERIC(12, 2) DEFAULT 0,
    p_fine NUMERIC(12, 2) DEFAULT 0,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(255);
    v_inst RECORD;
    v_payable RECORD;
    v_new_inst_paid NUMERIC(12, 2);
    v_new_inst_bal NUMERIC(12, 2);
    v_new_inst_status VARCHAR(20);
    v_new_pay_paid NUMERIC(12, 2);
    v_new_pay_bal NUMERIC(12, 2);
    v_new_pay_status VARCHAR(20);
    v_payment_id UUID;
    v_movement_id UUID := NULL;
    v_existing_payment RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NOT NULL THEN
        SELECT COALESCE(full_name, 'Operador') INTO v_user_name
        FROM public.profiles WHERE id = v_user_id;
    ELSE
        v_user_name := 'Operador';
    END IF;

    -- Validação de entrada
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'O valor do pagamento deve ser maior que zero.';
    END IF;

    -- 1. Idempotência
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        SELECT * INTO v_existing_payment
        FROM public.payable_payments
        WHERE idempotency_key = p_idempotency_key
        LIMIT 1;

        IF FOUND THEN
            SELECT balance_amount, status INTO v_new_inst_bal, v_new_inst_status
            FROM public.accounts_payable_installments
            WHERE id = v_existing_payment.installment_id;

            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'payment_id', v_existing_payment.id,
                'installment_balance', v_new_inst_bal,
                'installment_status', v_new_inst_status
            );
        END IF;
    END IF;

    -- 2. Bloqueio da parcela FOR UPDATE
    SELECT * INTO v_inst
    FROM public.accounts_payable_installments
    WHERE id = p_installment_id AND company_id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parcela de conta a pagar não encontrada.';
    END IF;

    IF v_inst.status = 'paid' OR v_inst.balance_amount <= 0.009 THEN
        RAISE EXCEPTION 'Esta parcela já se encontra totalmente quitada.';
    END IF;

    IF v_inst.status = 'cancelled' THEN
        RAISE EXCEPTION 'Esta parcela foi cancelada e não pode receber pagamentos.';
    END IF;

    -- Validação de saldo devedor
    IF p_amount > (v_inst.balance_amount + 0.009) THEN
        RAISE EXCEPTION 'O valor informado (R$ %) é superior ao saldo devedor da parcela (R$ %).',
            ROUND(p_amount, 2), ROUND(v_inst.balance_amount, 2);
    END IF;

    -- 3. Bloqueio da Conta a Pagar Pai
    SELECT * INTO v_payable
    FROM public.accounts_payable
    WHERE id = v_inst.payable_id AND company_id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta a pagar vinculada não encontrada.';
    END IF;

    -- 4. Se pagamento for em dinheiro (cash) e houver caixa aberto, registra despesa/saída no caixa
    IF p_payment_method = 'cash' AND p_cash_session_id IS NOT NULL THEN
        -- Verifica se caixa está aberto
        IF NOT EXISTS (
            SELECT 1 FROM public.cash_sessions
            WHERE id = p_cash_session_id AND status = 'open' AND company_id = p_company_id
        ) THEN
            RAISE EXCEPTION 'A sessão de caixa informada não está aberta para movimentação.';
        END IF;

        INSERT INTO public.cash_movements (
            company_id,
            branch_id,
            cash_session_id,
            movement_type,
            amount,
            reason,
            user_id,
            user_name,
            notes
        ) VALUES (
            p_company_id,
            p_branch_id,
            p_cash_session_id,
            'expense',
            p_amount,
            'Pagamento de despesa: ' || v_payable.description || ' (Parc. ' || v_inst.installment_number || ')',
            COALESCE(v_user_id, '00000000-0000-0000-0000-000000000000'::UUID),
            v_user_name,
            p_notes
        ) RETURNING id INTO v_movement_id;
    END IF;

    -- 5. Registra o Pagamento no Histórico Auditável
    INSERT INTO public.payable_payments (
        company_id,
        branch_id,
        payable_id,
        installment_id,
        supplier_id,
        cash_session_id,
        cash_movement_id,
        amount_paid,
        discount_applied,
        interest_applied,
        fine_applied,
        payment_method,
        paid_by,
        notes,
        idempotency_key
    ) VALUES (
        p_company_id,
        p_branch_id,
        v_inst.payable_id,
        v_inst.id,
        v_inst.supplier_id,
        p_cash_session_id,
        v_movement_id,
        p_amount,
        COALESCE(p_discount, 0),
        COALESCE(p_interest, 0),
        COALESCE(p_fine, 0),
        p_payment_method,
        v_user_id,
        p_notes,
        p_idempotency_key
    ) RETURNING id INTO v_payment_id;

    -- 6. Recalcula Saldo e Status da Parcela
    v_new_inst_paid := ROUND((v_inst.paid_amount + p_amount)::numeric, 2);
    v_new_inst_bal  := GREATEST(0, ROUND((v_inst.balance_amount - p_amount)::numeric, 2));

    IF v_new_inst_bal <= 0.009 THEN
        v_new_inst_status := 'paid';
    ELSE
        v_new_inst_status := 'partially_paid';
    END IF;

    UPDATE public.accounts_payable_installments
    SET paid_amount    = v_new_inst_paid,
        balance_amount = v_new_inst_bal,
        status         = v_new_inst_status,
        updated_at     = now()
    WHERE id = v_inst.id;

    -- 7. Recalcula Saldo e Status da Conta Principal
    v_new_pay_paid := ROUND((v_payable.paid_amount + p_amount)::numeric, 2);
    v_new_pay_bal  := GREATEST(0, ROUND((v_payable.balance_amount - p_amount)::numeric, 2));

    IF v_new_pay_bal <= 0.009 THEN
        v_new_pay_status := 'paid';
    ELSE
        v_new_pay_status := 'partially_paid';
    END IF;

    UPDATE public.accounts_payable
    SET paid_amount    = v_new_pay_paid,
        balance_amount = v_new_pay_bal,
        status         = v_new_pay_status,
        updated_at     = now()
    WHERE id = v_payable.id;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'cash_movement_id', v_movement_id,
        'installment_balance', v_new_inst_bal,
        'installment_status', v_new_inst_status,
        'payable_balance', v_new_pay_bal,
        'payable_status', v_new_pay_status
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. FUNÇÃO RPC: cancel_accounts_payable (Cancelamento Auditado)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_accounts_payable(
    p_company_id UUID,
    p_payable_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_payable RECORD;
BEGIN
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'É obrigatório informar o motivo do cancelamento.';
    END IF;

    SELECT * INTO v_payable
    FROM public.accounts_payable
    WHERE id = p_payable_id AND company_id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta a pagar não encontrada.';
    END IF;

    IF v_payable.status = 'cancelled' THEN
        RAISE EXCEPTION 'Esta conta a pagar já está cancelada.';
    END IF;

    -- Não permite cancelar se houver valores já pagos
    IF v_payable.paid_amount > 0.009 THEN
        RAISE EXCEPTION 'Não é permitido cancelar uma conta com pagamentos realizados (R$ % pago). Realize o estorno prévio.',
            ROUND(v_payable.paid_amount, 2);
    END IF;

    UPDATE public.accounts_payable
    SET status              = 'cancelled',
        cancellation_reason = p_reason,
        cancelled_by        = v_user_id,
        cancelled_at        = now(),
        updated_at          = now()
    WHERE id = p_payable_id;

    UPDATE public.accounts_payable_installments
    SET status     = 'cancelled',
        updated_at = now()
    WHERE payable_id = p_payable_id;

    RETURN jsonb_build_object(
        'success', true,
        'payable_id', p_payable_id,
        'status', 'cancelled'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_payable_installment TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_accounts_payable TO authenticated;
