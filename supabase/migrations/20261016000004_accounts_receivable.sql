-- ==============================================================================
-- MIGRATION: 20261016000004_accounts_receivable.sql
-- DESCRIÇÃO: ETAPA 12 — Vendas a Prazo, Crediário, Parcelas e Contas a Receber
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SEQUÊNCIA DE DOCUMENTOS DE CONTAS A RECEBER
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.accounts_receivable_seq START WITH 1 INCREMENT BY 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA DE CONTAS A RECEBER / OBRIGAÇÕES FINANCEIRAS (accounts_receivable)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounts_receivable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    document_number VARCHAR(100) NOT NULL,
    description TEXT,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Valores
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    down_payment NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (down_payment >= 0),
    balance_amount NUMERIC(12, 2) NOT NULL CHECK (balance_amount >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    installments_count INTEGER NOT NULL DEFAULT 1 CHECK (installments_count >= 1),
    
    -- Status da Conta
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partially_paid', 'paid', 'overdue', 'cancelled')),
    notes TEXT,
    
    -- Auditoria
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Cancelamento / Estorno
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cancellation_reason TEXT
);

COMMENT ON TABLE public.accounts_receivable IS 'Títulos e obrigações a receber originadas de vendas a prazo (crediário) ou títulos avulsos';

CREATE INDEX IF NOT EXISTS idx_acc_rec_company ON public.accounts_receivable(company_id);
CREATE INDEX IF NOT EXISTS idx_acc_rec_branch ON public.accounts_receivable(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_acc_rec_customer ON public.accounts_receivable(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_acc_rec_sale ON public.accounts_receivable(sale_id);
CREATE INDEX IF NOT EXISTS idx_acc_rec_status ON public.accounts_receivable(company_id, status);
CREATE INDEX IF NOT EXISTS idx_acc_rec_doc ON public.accounts_receivable(company_id, document_number);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABELA DE PARCELAS DE CONTAS A RECEBER (accounts_receivable_installments)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounts_receivable_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receivable_id UUID NOT NULL REFERENCES public.accounts_receivable(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    
    installment_number INTEGER NOT NULL CHECK (installment_number >= 1),
    due_date DATE NOT NULL,
    original_amount NUMERIC(12, 2) NOT NULL CHECK (original_amount > 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    balance_amount NUMERIC(12, 2) NOT NULL CHECK (balance_amount >= 0),
    
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partially_paid', 'paid', 'overdue', 'cancelled')),
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT uq_installment_per_receivable UNIQUE (receivable_id, installment_number)
);

COMMENT ON TABLE public.accounts_receivable_installments IS 'Parcelas individuais com vencimento e saldo em aberto';

CREATE INDEX IF NOT EXISTS idx_acc_rec_inst_company ON public.accounts_receivable_installments(company_id);
CREATE INDEX IF NOT EXISTS idx_acc_rec_inst_rec_id ON public.accounts_receivable_installments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_acc_rec_inst_customer ON public.accounts_receivable_installments(customer_id);
CREATE INDEX IF NOT EXISTS idx_acc_rec_inst_due_date ON public.accounts_receivable_installments(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_acc_rec_inst_status ON public.accounts_receivable_installments(company_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABELA DE HISTÓRICO DE RECEBIMENTOS (receivable_payments)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receivable_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    receivable_id UUID NOT NULL REFERENCES public.accounts_receivable(id) ON DELETE CASCADE,
    installment_id UUID NOT NULL REFERENCES public.accounts_receivable_installments(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
    
    amount_paid NUMERIC(12, 2) NOT NULL CHECK (amount_paid > 0),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'pix', 'debit_card', 'credit_card', 'bank_transfer', 'other')),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    received_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    received_by_name VARCHAR(255),
    notes TEXT,
    idempotency_key VARCHAR(100),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.receivable_payments IS 'Registro auditável de cada liquidação ou amortização de parcela recebida';

CREATE INDEX IF NOT EXISTS idx_rec_payments_company ON public.receivable_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_rec_payments_installment ON public.receivable_payments(installment_id);
CREATE INDEX IF NOT EXISTS idx_rec_payments_receivable ON public.receivable_payments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_rec_payments_cash_session ON public.receivable_payments(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_rec_payments_idempotency ON public.receivable_payments(company_id, idempotency_key);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TRIGGER DE IMUTABILIDADE DE RECEBIMENTOS (AUDITORIA ESTATUTÁRIA)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_prevent_receivable_payment_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Recebimentos confirmados não podem ser alterados diretamente por motivos de auditoria fiscal.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Recebimentos confirmados não podem ser excluídos. Em caso de estorno, utilize o procedimento oficial de cancelamento.';
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_receivable_payment_tampering ON public.receivable_payments;
CREATE TRIGGER trg_prevent_receivable_payment_tampering
    BEFORE UPDATE OR DELETE ON public.receivable_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_receivable_payment_tampering();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. POLÍTICAS DE RLS (ROW LEVEL SECURITY)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivable_payments ENABLE ROW LEVEL SECURITY;

-- accounts_receivable RLS
DROP POLICY IF EXISTS "Usuários podem visualizar contas a receber de sua empresa" ON public.accounts_receivable;
CREATE POLICY "Usuários podem visualizar contas a receber de sua empresa"
    ON public.accounts_receivable FOR SELECT
    TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "Usuários podem inserir contas a receber de sua empresa" ON public.accounts_receivable;
CREATE POLICY "Usuários podem inserir contas a receber de sua empresa"
    ON public.accounts_receivable FOR INSERT
    TO authenticated
    WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "Usuários podem atualizar contas a receber de sua empresa" ON public.accounts_receivable;
CREATE POLICY "Usuários podem atualizar contas a receber de sua empresa"
    ON public.accounts_receivable FOR UPDATE
    TO authenticated
    USING (public.user_has_company_access(company_id));

-- accounts_receivable_installments RLS
DROP POLICY IF EXISTS "Usuários podem visualizar parcelas de sua empresa" ON public.accounts_receivable_installments;
CREATE POLICY "Usuários podem visualizar parcelas de sua empresa"
    ON public.accounts_receivable_installments FOR SELECT
    TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "Usuários podem inserir parcelas de sua empresa" ON public.accounts_receivable_installments;
CREATE POLICY "Usuários podem inserir parcelas de sua empresa"
    ON public.accounts_receivable_installments FOR INSERT
    TO authenticated
    WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "Usuários podem atualizar parcelas de sua empresa" ON public.accounts_receivable_installments;
CREATE POLICY "Usuários podem atualizar parcelas de sua empresa"
    ON public.accounts_receivable_installments FOR UPDATE
    TO authenticated
    USING (public.user_has_company_access(company_id));

-- receivable_payments RLS
DROP POLICY IF EXISTS "Usuários podem visualizar recebimentos de sua empresa" ON public.receivable_payments;
CREATE POLICY "Usuários podem visualizar recebimentos de sua empresa"
    ON public.receivable_payments FOR SELECT
    TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "Usuários podem inserir recebimentos de sua empresa" ON public.receivable_payments;
CREATE POLICY "Usuários podem inserir recebimentos de sua empresa"
    ON public.receivable_payments FOR INSERT
    TO authenticated
    WITH CHECK (public.user_has_company_access(company_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. FUNÇÃO DE CONSULTA E VALIDAÇÃO DE LIMITE DE CRÉDITO DO CLIENTE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_customer_credit_profile(
    p_company_id UUID,
    p_customer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer RECORD;
    v_credit_limit NUMERIC(12, 2) := 0.00;
    v_used_credit NUMERIC(12, 2) := 0.00;
    v_available_credit NUMERIC(12, 2) := 0.00;
    v_overdue_amount NUMERIC(12, 2) := 0.00;
    v_overdue_count INTEGER := 0;
    v_open_count INTEGER := 0;
BEGIN
    SELECT * INTO v_customer
    FROM public.customers
    WHERE id = p_customer_id AND company_id = p_company_id;

    IF v_customer.id IS NULL THEN
        RAISE EXCEPTION 'Cliente não encontrado para a empresa informada.';
    END IF;

    v_credit_limit := COALESCE(v_customer.credit_limit, 0.00);

    -- Soma do saldo em aberto de títulos não quitados
    SELECT
        COALESCE(SUM(balance_amount), 0.00),
        COUNT(*)
    INTO v_used_credit, v_open_count
    FROM public.accounts_receivable
    WHERE customer_id = p_customer_id
      AND company_id = p_company_id
      AND status IN ('open', 'partially_paid', 'overdue');

    -- Soma das parcelas vencidas
    SELECT
        COALESCE(SUM(balance_amount), 0.00),
        COUNT(*)
    INTO v_overdue_amount, v_overdue_count
    FROM public.accounts_receivable_installments
    WHERE customer_id = p_customer_id
      AND company_id = p_company_id
      AND status IN ('open', 'partially_paid', 'overdue')
      AND due_date < CURRENT_DATE;

    v_available_credit := GREATEST(0.00, v_credit_limit - v_used_credit);

    RETURN jsonb_build_object(
        'customer_id', v_customer.id,
        'customer_name', v_customer.name,
        'document', v_customer.document,
        'credit_status', v_customer.credit_status,
        'customer_status', v_customer.status,
        'credit_limit', v_credit_limit,
        'used_credit', v_used_credit,
        'available_credit', v_available_credit,
        'overdue_amount', v_overdue_amount,
        'overdue_count', v_overdue_count,
        'open_receivables_count', v_open_count,
        'is_blocked', (v_customer.credit_status = 'blocked' OR v_customer.status = 'inactive'),
        'has_overdue', (v_overdue_count > 0)
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. FUNÇÃO RPC: REGISTRAR RECEBIMENTO DE PARCELA (receive_installment_payment)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.receive_installment_payment(
    p_company_id UUID,
    p_branch_id UUID,
    p_installment_id UUID,
    p_amount NUMERIC(12, 2),
    p_payment_method VARCHAR(50),
    p_cash_session_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_name VARCHAR(255);
    v_inst RECORD;
    v_rec RECORD;
    v_cash_session RECORD;
    v_payment_id UUID;
    v_new_paid NUMERIC(12, 2);
    v_new_balance NUMERIC(12, 2);
    v_new_status VARCHAR(30);
    v_rec_new_paid NUMERIC(12, 2);
    v_rec_new_balance NUMERIC(12, 2);
    v_rec_new_status VARCHAR(30);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF NOT public.user_has_company_access(p_company_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado à empresa selecionada.';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'O valor do recebimento deve ser maior que zero.';
    END IF;

    -- Verifica idempotência
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        SELECT id INTO v_payment_id
        FROM public.receivable_payments
        WHERE company_id = p_company_id AND idempotency_key = TRIM(p_idempotency_key);

        IF v_payment_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'payment_id', v_payment_id
            );
        END IF;
    END IF;

    -- Localiza e bloqueia a parcela para consistência concorrente
    SELECT * INTO v_inst
    FROM public.accounts_receivable_installments
    WHERE id = p_installment_id AND company_id = p_company_id
    FOR UPDATE;

    IF v_inst.id IS NULL THEN
        RAISE EXCEPTION 'Parcela não encontrada.';
    END IF;

    IF v_inst.status = 'paid' THEN
        RAISE EXCEPTION 'Esta parcela já se encontra totalmente quitada.';
    END IF;

    IF v_inst.status = 'cancelled' THEN
        RAISE EXCEPTION 'Esta parcela está cancelada e não pode receber pagamentos.';
    END IF;

    IF p_amount > v_inst.balance_amount THEN
        RAISE EXCEPTION 'O valor recebido (R$ %) não pode ultrapassar o saldo da parcela (R$ %).',
            p_amount, v_inst.balance_amount;
    END IF;

    -- Localiza a conta a receber pai
    SELECT * INTO v_rec
    FROM public.accounts_receivable
    WHERE id = v_inst.receivable_id AND company_id = p_company_id
    FOR UPDATE;

    -- Obtém nome do operador
    SELECT full_name INTO v_user_name
    FROM public.profiles
    WHERE id = v_user_id;

    -- Se recebimento em dinheiro, valida o caixa aberto
    IF p_payment_method = 'cash' AND p_cash_session_id IS NOT NULL THEN
        SELECT * INTO v_cash_session
        FROM public.cash_sessions
        WHERE id = p_cash_session_id AND company_id = p_company_id AND branch_id = p_branch_id;

        IF v_cash_session.id IS NULL THEN
            RAISE EXCEPTION 'A sessão de caixa informada não existe ou não pertence a esta filial.';
        END IF;

        IF v_cash_session.status <> 'open' THEN
            RAISE EXCEPTION 'O caixa informado já está fechado. Abra um caixa para receber em dinheiro.';
        END IF;

        -- Registra entrada de caixa como Suprimento/Recebimento de crediário
        INSERT INTO public.cash_movements (
            company_id, branch_id, cash_session_id, movement_type,
            amount, reason, created_by, authorized_by, notes
        ) VALUES (
            p_company_id, p_branch_id, p_cash_session_id, 'supply',
            p_amount, 'Recebimento de Crediário: Parcela ' || v_inst.installment_number || ' (' || v_rec.document_number || ')',
            v_user_id, v_user_id, p_notes
        );
    END IF;

    -- Atualiza Parcela
    v_new_paid := ROUND(v_inst.paid_amount + p_amount, 2);
    v_new_balance := ROUND(v_inst.balance_amount - p_amount, 2);
    v_new_status := CASE WHEN v_new_balance <= 0.009 THEN 'paid' ELSE 'partially_paid' END;

    UPDATE public.accounts_receivable_installments
    SET paid_amount = v_new_paid,
        balance_amount = v_new_balance,
        status = v_new_status,
        updated_at = now()
    WHERE id = v_inst.id;

    -- Atualiza Conta Pai
    v_rec_new_paid := ROUND(v_rec.paid_amount + p_amount, 2);
    v_rec_new_balance := ROUND(v_rec.balance_amount - p_amount, 2);
    v_rec_new_status := CASE WHEN v_rec_new_balance <= 0.009 THEN 'paid' ELSE 'partially_paid' END;

    UPDATE public.accounts_receivable
    SET paid_amount = v_rec_new_paid,
        balance_amount = v_rec_new_balance,
        status = v_rec_new_status,
        updated_at = now()
    WHERE id = v_rec.id;

    -- Registra Histórico Auditável
    INSERT INTO public.receivable_payments (
        company_id, branch_id, receivable_id, installment_id,
        customer_id, cash_session_id, amount_paid, payment_method,
        received_by, received_by_name, notes, idempotency_key
    ) VALUES (
        p_company_id, p_branch_id, v_rec.id, v_inst.id,
        v_rec.customer_id, p_cash_session_id, p_amount, p_payment_method,
        v_user_id, COALESCE(v_user_name, 'Operador'), p_notes, p_idempotency_key
    ) RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'installment_id', v_inst.id,
        'receivable_id', v_rec.id,
        'amount_paid', p_amount,
        'installment_balance', v_new_balance,
        'installment_status', v_new_status,
        'receivable_balance', v_rec_new_balance,
        'receivable_status', v_rec_new_status
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ATUALIZAÇÃO DA RPC finalize_pos_sale: SUPORTE A CREDIÁRIO / VENDAS A PRAZO
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc
        JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
        WHERE nspname = 'public' AND proname = 'finalize_pos_sale'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.finalize_pos_sale(' || r.argtypes || ') CASCADE;';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_pos_sale(
    p_company_id UUID,
    p_branch_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_customer_name VARCHAR(255) DEFAULT NULL,
    p_customer_document VARCHAR(30) DEFAULT NULL,
    p_discount_type VARCHAR(10) DEFAULT 'value',
    p_discount_value NUMERIC(12, 2) DEFAULT 0.00,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_payments JSONB DEFAULT '[]'::jsonb,
    p_quote_id UUID DEFAULT NULL,
    p_idempotency_key VARCHAR(100) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_cash_session_id UUID DEFAULT NULL,
    p_receivable_config JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_sale_id UUID;
    v_existing_sale RECORD;
    v_sale_number BIGINT;
    v_sale_code VARCHAR(50);
    v_cash_session_id UUID := p_cash_session_id;
    v_cash_session RECORD;

    -- Totais
    v_subtotal NUMERIC(12, 2) := 0.00;
    v_discount_amount NUMERIC(12, 2) := 0.00;
    v_total NUMERIC(12, 2) := 0.00;
    v_payments_total NUMERIC(12, 2) := 0.00;
    v_total_change NUMERIC(12, 2) := 0.00;
    v_store_credit_amount NUMERIC(12, 2) := 0.00;
    v_store_credit_installments INTEGER := 1;

    -- Iteradores e Registros
    v_item JSONB;
    v_payment JSONB;
    v_prod RECORD;
    v_quote RECORD;
    v_current_stock NUMERIC(12, 3);
    v_qty NUMERIC(12, 3);
    v_item_unit_price NUMERIC(12, 2);
    v_item_discount NUMERIC(12, 2);
    v_item_subtotal NUMERIC(12, 2);
    v_item_total NUMERIC(12, 2);

    -- Pagamentos
    v_pay_method VARCHAR(50);
    v_pay_amount NUMERIC(12, 2);
    v_pay_received NUMERIC(12, 2);
    v_pay_change NUMERIC(12, 2);
    v_pay_installments INTEGER;

    -- Contas a Receber
    v_customer RECORD;
    v_credit_profile JSONB;
    v_receivable_id UUID;
    v_receivable_doc VARCHAR(100);
    v_rec_inst_count INTEGER := 1;
    v_rec_first_due DATE;
    v_rec_interval_days INTEGER := 30;
    v_installment_idx INTEGER;
    v_installment_due DATE;
    v_installment_base NUMERIC(12, 2);
    v_installment_cents_remainder NUMERIC(12, 2);
    v_installment_val NUMERIC(12, 2);
BEGIN
    -- 1. Identificação do Usuário e Permissões
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF NOT public.user_has_company_access(p_company_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado à empresa selecionada.';
    END IF;

    IF NOT (public.user_is_company_admin(p_company_id) OR public.user_has_branch_access(p_branch_id)) THEN
        RAISE EXCEPTION 'Usuário não possui permissão para operar nesta filial.';
    END IF;

    -- 2. Verificação Obrigatória de Caixa Aberto
    IF v_cash_session_id IS NOT NULL THEN
        SELECT * INTO v_cash_session
        FROM public.cash_sessions
        WHERE id = v_cash_session_id AND company_id = p_company_id AND branch_id = p_branch_id;

        IF v_cash_session.id IS NULL THEN
            RAISE EXCEPTION 'A sessão de caixa informada não existe ou não pertence a esta filial.';
        END IF;

        IF v_cash_session.status <> 'open' THEN
            RAISE EXCEPTION 'O caixa informado já foi fechado. Abra um novo caixa para finalizar vendas.';
        END IF;
    ELSE
        SELECT id INTO v_cash_session_id
        FROM public.cash_sessions
        WHERE branch_id = p_branch_id AND opened_by = v_user_id AND status = 'open'
        ORDER BY opened_at DESC
        LIMIT 1;

        IF v_cash_session_id IS NULL THEN
            SELECT id INTO v_cash_session_id
            FROM public.cash_sessions
            WHERE branch_id = p_branch_id AND status = 'open'
            ORDER BY opened_at DESC
            LIMIT 1;
        END IF;

        IF v_cash_session_id IS NULL THEN
            RAISE EXCEPTION 'Nenhum caixa aberto encontrado para esta filial/operador. Abra o caixa antes de realizar vendas no PDV.';
        END IF;
    END IF;

    -- 3. Verificação de Idempotência
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        SELECT * INTO v_existing_sale
        FROM public.sales
        WHERE company_id = p_company_id AND idempotency_key = TRIM(p_idempotency_key);

        IF v_existing_sale.id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'sale_id', v_existing_sale.id,
                'sale_code', v_existing_sale.code,
                'sale_number', v_existing_sale.sale_number,
                'total', v_existing_sale.total,
                'change_amount', v_existing_sale.change_amount,
                'cash_session_id', v_existing_sale.cash_session_id
            );
        END IF;
    END IF;

    -- 4. Verificação de Orçamento Vinculado
    IF p_quote_id IS NOT NULL THEN
        SELECT * INTO v_quote
        FROM public.quotes
        WHERE id = p_quote_id AND company_id = p_company_id;

        IF v_quote.id IS NULL THEN
            RAISE EXCEPTION 'Orçamento indicado não foi localizado.';
        END IF;

        IF v_quote.status = 'converted' THEN
            RAISE EXCEPTION 'Este orçamento já foi convertido em venda anteriormente.';
        END IF;
    END IF;

    -- 5. Validação da Lista de Itens
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'A venda deve conter pelo menos 1 item no carrinho.';
    END IF;

    -- 6. Validação das Formas de Pagamento (mínimo 1, máximo 2 formas)
    IF jsonb_array_length(p_payments) = 0 THEN
        RAISE EXCEPTION 'Informe ao menos 1 forma de pagamento.';
    END IF;

    IF jsonb_array_length(p_payments) > 2 THEN
        RAISE EXCEPTION 'O PDV permite no máximo 2 formas de pagamento por venda.';
    END IF;

    -- 7. Primeira passagem: Validação de produtos, cálculo seguro de preços e subtotal
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::NUMERIC, 0);
        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'A quantidade do item deve ser estritamente maior que zero.';
        END IF;

        SELECT * INTO v_prod
        FROM public.products
        WHERE id = (v_item->>'product_id')::UUID
          AND company_id = p_company_id;

        IF v_prod.id IS NULL THEN
            RAISE EXCEPTION 'Produto não cadastrado ou não pertence à empresa: %', (v_item->>'product_id');
        END IF;

        IF v_prod.status <> 'active' THEN
            RAISE EXCEPTION 'O produto "%" está inativo para vendas.', v_prod.name;
        END IF;

        SELECT quantity INTO v_current_stock
        FROM public.branch_stock
        WHERE branch_id = p_branch_id AND product_id = v_prod.id;

        v_current_stock := COALESCE(v_current_stock, 0);

        IF v_current_stock < v_qty THEN
            RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Disponível: %, Solicitado: %).',
                v_prod.name, v_current_stock, v_qty;
        END IF;

        v_item_unit_price := COALESCE(
            (v_item->>'unit_price')::NUMERIC,
            v_prod.sale_price,
            0.00
        );

        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0.00);
        IF v_item_discount < 0 THEN
            v_item_discount := 0.00;
        END IF;

        v_item_subtotal := ROUND(v_item_unit_price * v_qty, 2);
        IF v_item_discount > v_item_subtotal THEN
            v_item_discount := v_item_subtotal;
        END IF;

        v_item_total := v_item_subtotal - v_item_discount;
        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    -- 8. Cálculo do Desconto Geral e Total Líquido
    IF p_discount_type = 'percentage' THEN
        v_discount_amount := ROUND(v_subtotal * (LEAST(GREATEST(p_discount_value, 0), 100) / 100), 2);
    ELSE
        v_discount_amount := LEAST(GREATEST(p_discount_value, 0), v_subtotal);
    END IF;

    v_total := ROUND(GREATEST(0, v_subtotal - v_discount_amount), 2);

    -- 9. Validação dos Pagamentos e Checagem de Crediário
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
        v_pay_method := TRIM(v_payment->>'payment_method');
        v_pay_amount := COALESCE((v_payment->>'amount')::NUMERIC, 0);
        v_pay_received := COALESCE((v_payment->>'received_amount')::NUMERIC, v_pay_amount);

        IF v_pay_amount <= 0 THEN
            RAISE EXCEPTION 'O valor de cada forma de pagamento deve ser maior que zero.';
        END IF;

        IF v_pay_method NOT IN ('cash', 'pix', 'credit_card', 'debit_card', 'store_credit', 'other') THEN
            RAISE EXCEPTION 'Forma de pagamento não reconhecida: %', v_pay_method;
        END IF;

        IF v_pay_method = 'cash' THEN
            IF v_pay_received < v_pay_amount THEN
                RAISE EXCEPTION 'O valor recebido em dinheiro (R$ %) não pode ser inferior ao valor do pagamento (R$ %).',
                    v_pay_received, v_pay_amount;
            END IF;
            v_pay_change := ROUND(v_pay_received - v_pay_amount, 2);
            v_total_change := v_total_change + v_pay_change;
        END IF;

        IF v_pay_method = 'store_credit' THEN
            v_store_credit_amount := v_store_credit_amount + v_pay_amount;
            v_store_credit_installments := COALESCE((v_payment->>'installments')::INTEGER, 1);
        END IF;

        v_payments_total := v_payments_total + v_pay_amount;
    END LOOP;

    IF ABS(v_payments_total - v_total) > 0.01 THEN
        RAISE EXCEPTION 'A soma dos pagamentos (R$ %) difere do total da venda (R$ %).',
            v_payments_total, v_total;
    END IF;

    -- 10. Validação Restrita de Crediário / Vendas a Prazo
    IF v_store_credit_amount > 0 THEN
        IF p_customer_id IS NULL THEN
            RAISE EXCEPTION 'Para vendas no Crediário / A Prazo, é obrigatório selecionar um cliente cadastrado.';
        END IF;

        -- Consulta e validação de crédito do cliente
        v_credit_profile := public.get_customer_credit_profile(p_company_id, p_customer_id);

        IF (v_credit_profile->>'is_blocked')::BOOLEAN THEN
            RAISE EXCEPTION 'Cliente bloqueado para compras a prazo (Status: %).',
                v_credit_profile->>'credit_status';
        END IF;

        IF (v_credit_profile->>'has_overdue')::BOOLEAN THEN
            RAISE EXCEPTION 'Cliente possui parcelas vencidas em atraso (Total vencido: R$ %). Regularize antes de nova venda.',
                v_credit_profile->>'overdue_amount';
        END IF;

        -- Validação de limite de crédito
        IF (v_credit_profile->>'available_credit')::NUMERIC < v_store_credit_amount THEN
            RAISE EXCEPTION 'Limite de crédito insuficiente! Limite disponível: R$ %, Solicitado: R$ %.',
                v_credit_profile->>'available_credit', v_store_credit_amount;
        END IF;
    END IF;

    -- 11. Geração do Número e Código da Venda
    v_sale_number := nextval('public.sale_number_seq');
    v_sale_code := 'VND-' || lpad(v_sale_number::text, 6, '0');

    -- 12. Inserção do Cabeçalho da Venda vinculado ao Caixa Aberto
    INSERT INTO public.sales (
        company_id, branch_id, user_id, cash_session_id,
        customer_id, customer_name, customer_document,
        sale_number, code, status,
        subtotal, discount_type, discount_value, discount_amount, total,
        payment_amount, change_amount, quote_id, idempotency_key, notes
    ) VALUES (
        p_company_id, p_branch_id, v_user_id, v_cash_session_id,
        p_customer_id, p_customer_name, p_customer_document,
        v_sale_number, v_sale_code, 'completed',
        v_subtotal, p_discount_type, p_discount_value, v_discount_amount, v_total,
        v_payments_total, v_total_change, p_quote_id, p_idempotency_key, p_notes
    ) RETURNING id INTO v_sale_id;

    -- 13. Inserção dos Itens e Baixa Atômica de Estoque
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::NUMERIC;

        SELECT * INTO v_prod
        FROM public.products
        WHERE id = (v_item->>'product_id')::UUID;

        SELECT quantity INTO v_current_stock
        FROM public.branch_stock
        WHERE branch_id = p_branch_id AND product_id = v_prod.id;

        v_current_stock := COALESCE(v_current_stock, 0);

        v_item_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, v_prod.sale_price, 0.00);
        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0.00);
        v_item_subtotal := ROUND(v_item_unit_price * v_qty, 2);
        IF v_item_discount > v_item_subtotal THEN
            v_item_discount := v_item_subtotal;
        END IF;
        v_item_total := v_item_subtotal - v_item_discount;

        INSERT INTO public.sale_items (
            sale_id, company_id, branch_id, product_id,
            product_name, product_sku, product_barcode, unit,
            quantity, unit_price, cost_price, price_type,
            discount, subtotal, total
        ) VALUES (
            v_sale_id, p_company_id, p_branch_id, v_prod.id,
            v_prod.name, v_prod.sku, v_prod.barcode, v_prod.unit,
            v_qty, v_item_unit_price, v_prod.cost_price,
            COALESCE(v_item->>'price_type', 'retail'),
            v_item_discount, v_item_subtotal, v_item_total
        );

        UPDATE public.branch_stock
        SET quantity = quantity - v_qty,
            last_movement_at = now(),
            updated_at = now()
        WHERE branch_id = p_branch_id AND product_id = v_prod.id;

        INSERT INTO public.stock_movements (
            company_id, branch_id, product_id, movement_type,
            quantity, balance_before, balance_after,
            reason, notes, user_id, reference_id, reference_type
        ) VALUES (
            p_company_id, p_branch_id, v_prod.id, 'exit',
            v_qty, v_current_stock, v_current_stock - v_qty,
            'Venda PDV ' || v_sale_code,
            'Baixa automática realizada pelo operador de caixa no PDV',
            v_user_id, v_sale_id, 'pos_sale'
        );
    END LOOP;

    -- 14. Inserção das Formas de Pagamento
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
        v_pay_method := TRIM(v_payment->>'payment_method');
        v_pay_amount := (v_payment->>'amount')::NUMERIC;
        v_pay_received := COALESCE((v_payment->>'received_amount')::NUMERIC, v_pay_amount);
        v_pay_change := CASE WHEN v_pay_method = 'cash' THEN ROUND(v_pay_received - v_pay_amount, 2) ELSE 0.00 END;
        v_pay_installments := COALESCE((v_payment->>'installments')::INTEGER, 1);

        INSERT INTO public.sale_payments (
            sale_id, company_id, payment_method, amount,
            received_amount, change_amount, installments, notes
        ) VALUES (
            v_sale_id, p_company_id, v_pay_method, v_pay_amount,
            v_pay_received, v_pay_change, v_pay_installments, v_payment->>'notes'
        );
    END LOOP;

    -- 15. Geração Automática das Contas a Receber e Parcelas (Crediário)
    IF v_store_credit_amount > 0 THEN
        v_receivable_doc := 'TIT-' || v_sale_code;
        v_rec_inst_count := GREATEST(1, v_store_credit_installments);

        IF p_receivable_config IS NOT NULL THEN
            v_rec_inst_count := COALESCE((p_receivable_config->>'installments_count')::INTEGER, v_rec_inst_count);
            v_rec_first_due := (p_receivable_config->>'first_due_date')::DATE;
            v_rec_interval_days := COALESCE((p_receivable_config->>'interval_days')::INTEGER, 30);
        END IF;

        IF v_rec_first_due IS NULL THEN
            v_rec_first_due := CURRENT_DATE + (v_rec_interval_days || ' days')::INTERVAL;
        END IF;

        -- Inserção do Título Pai
        INSERT INTO public.accounts_receivable (
            company_id, branch_id, customer_id, sale_id,
            document_number, description, issue_date,
            total_amount, down_payment, balance_amount, paid_amount,
            installments_count, status, notes, created_by
        ) VALUES (
            p_company_id, p_branch_id, p_customer_id, v_sale_id,
            v_receivable_doc, 'Venda a Prazo / Crediário PDV ' || v_sale_code, CURRENT_DATE,
            v_store_credit_amount, 0.00, v_store_credit_amount, 0.00,
            v_rec_inst_count, 'open', p_notes, v_user_id
        ) RETURNING id INTO v_receivable_id;

        -- Divisão matemática exata em centavos
        v_installment_base := TRUNC(v_store_credit_amount / v_rec_inst_count, 2);
        v_installment_cents_remainder := ROUND(v_store_credit_amount - (v_installment_base * v_rec_inst_count), 2);

        FOR v_installment_idx IN 1..v_rec_inst_count
        LOOP
            v_installment_due := v_rec_first_due + (((v_installment_idx - 1) * v_rec_interval_days) || ' days')::INTERVAL;
            
            -- O primeiro pagamento recebe a sobra dos centavos para soma bater 100%
            IF v_installment_idx = 1 THEN
                v_installment_val := v_installment_base + v_installment_cents_remainder;
            ELSE
                v_installment_val := v_installment_base;
            END IF;

            INSERT INTO public.accounts_receivable_installments (
                receivable_id, company_id, branch_id, customer_id,
                installment_number, due_date, original_amount,
                paid_amount, balance_amount, status
            ) VALUES (
                v_receivable_id, p_company_id, p_branch_id, p_customer_id,
                v_installment_idx, v_installment_due, v_installment_val,
                0.00, v_installment_val, 'open'
            );
        END LOOP;
    END IF;

    -- 16. Conversão de Orçamento (se aplicável)
    IF p_quote_id IS NOT NULL THEN
        UPDATE public.quotes
        SET status = 'converted',
            converted_at = now(),
            converted_to_sale_id = v_sale_id,
            updated_at = now()
        WHERE id = p_quote_id;

        INSERT INTO public.quote_status_history (
            quote_id, company_id, previous_status, new_status, reason, user_id
        ) VALUES (
            p_quote_id, p_company_id, v_quote.status, 'converted',
            'Convertido em venda faturada no PDV (' || v_sale_code || ')',
            v_user_id
        );
    END IF;

    -- 17. Retorno de Sucesso com Dados Financeiros
    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'sale_code', v_sale_code,
        'sale_number', v_sale_number,
        'total', v_total,
        'payment_amount', v_payments_total,
        'change_amount', v_total_change,
        'cash_session_id', v_cash_session_id,
        'store_credit_amount', v_store_credit_amount,
        'receivable_id', v_receivable_id,
        'created_at', now()
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. CONCESSÃO DE PERMISSÕES PARA AS FUNÇÕES
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_customer_credit_profile FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_credit_profile TO authenticated;

REVOKE ALL ON FUNCTION public.receive_installment_payment FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_installment_payment TO authenticated;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc
        JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
        WHERE nspname = 'public' AND proname = 'finalize_pos_sale'
    ) LOOP
        EXECUTE 'REVOKE ALL ON FUNCTION public.finalize_pos_sale(' || r.argtypes || ') FROM PUBLIC;';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.finalize_pos_sale(' || r.argtypes || ') TO authenticated;';
    END LOOP;
END $$;
