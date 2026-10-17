-- ==============================================================================
-- MIGRATION: 20261016000003_cash_register_control.sql
-- DESCRIÇÃO: ETAPA 11 — Controle de Caixa: Abertura, Movimentações (Suprimento,
--            Sangria, Despesas), Fechamento com Conferência e Integração com PDV.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA DE SESSÕES DE CAIXA (cash_sessions)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    terminal_name VARCHAR(100) NOT NULL DEFAULT 'Caixa 01',
    opened_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    opened_by_name VARCHAR(255),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    initial_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (initial_amount >= 0),
    opening_notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    
    -- Dados de Fechamento
    closed_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    closed_by_name VARCHAR(255),
    closed_at TIMESTAMPTZ,
    closing_notes TEXT,
    
    -- Valores Apurados no Fechamento
    counted_cash NUMERIC(12, 2) CHECK (counted_cash IS NULL OR counted_cash >= 0),
    expected_cash NUMERIC(12, 2),
    difference_cash NUMERIC(12, 2),
    difference_reason TEXT,
    
    -- Totais Consolidados das Vendas e Formas de Pagamento
    total_sales_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_sales_pix NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_sales_debit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_sales_credit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_sales_store_credit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_sales_other NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_sales_count INTEGER NOT NULL DEFAULT 0,
    
    -- Totais Consolidados das Movimentações
    total_supplies NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_bleed NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Auditoria e Conferência Gerencial
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_by_name VARCHAR(255),
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cash_sessions IS 'Sessões de abertura e fechamento de caixa por operador e terminal';

CREATE INDEX IF NOT EXISTS idx_cash_sessions_company ON public.cash_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_branch ON public.cash_sessions(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_operator ON public.cash_sessions(company_id, opened_by);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON public.cash_sessions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at ON public.cash_sessions(company_id, opened_at DESC);

-- Restrição de unicidade para impedir aberturas simultâneas duplicadas no mesmo terminal ou operador
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_sessions_open_operator
    ON public.cash_sessions(branch_id, opened_by)
    WHERE status = 'open';

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_sessions_open_terminal
    ON public.cash_sessions(branch_id, terminal_name)
    WHERE status = 'open';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA DE MOVIMENTAÇÕES DE CAIXA (cash_movements)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('supply', 'bleed', 'expense')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    reason VARCHAR(255) NOT NULL CHECK (length(trim(reason)) > 0),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    user_name VARCHAR(255),
    authorized_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    authorized_by_name VARCHAR(255),
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cash_movements IS 'Registro de suprimentos, sangrias e despesas pagas pelo caixa';

CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON public.cash_movements(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_company ON public.cash_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_created_at ON public.cash_movements(created_at DESC);

-- Trigger de Imutabilidade das Movimentações (Não permite exclusão ou alteração silenciosa)
CREATE OR REPLACE FUNCTION public.prevent_cash_movement_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Movimentações de caixa são estritamente imutáveis para garantir auditoria financeira.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_cash_movement_tampering ON public.cash_movements;
CREATE TRIGGER trg_prevent_cash_movement_tampering
    BEFORE DELETE OR UPDATE ON public.cash_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_cash_movement_tampering();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VINCULAR VENDAS AO CAIXA ABERTO (Coluna cash_session_id em sales)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'sales' 
          AND column_name = 'cash_session_id'
    ) THEN
        ALTER TABLE public.sales
            ADD COLUMN cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_cash_session ON public.sales(company_id, cash_session_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- Sessões de Caixa
DROP POLICY IF EXISTS "cash_sessions_select_policy" ON public.cash_sessions;
CREATE POLICY "cash_sessions_select_policy" ON public.cash_sessions
    FOR SELECT TO authenticated
    USING (
        public.user_has_company_access(company_id)
        AND (
            opened_by = auth.uid()
            OR public.user_is_company_admin(company_id)
            OR public.user_has_permission(company_id, 'financial', 'view')
        )
    );

DROP POLICY IF EXISTS "cash_sessions_insert_policy" ON public.cash_sessions;
CREATE POLICY "cash_sessions_insert_policy" ON public.cash_sessions
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_has_company_access(company_id)
        AND (public.user_is_company_admin(company_id) OR public.user_has_branch_access(branch_id))
    );

DROP POLICY IF EXISTS "cash_sessions_update_policy" ON public.cash_sessions;
CREATE POLICY "cash_sessions_update_policy" ON public.cash_sessions
    FOR UPDATE TO authenticated
    USING (
        public.user_has_company_access(company_id)
        AND (
            opened_by = auth.uid()
            OR public.user_is_company_admin(company_id)
        )
    );

-- Movimentações de Caixa
DROP POLICY IF EXISTS "cash_movements_select_policy" ON public.cash_movements;
CREATE POLICY "cash_movements_select_policy" ON public.cash_movements
    FOR SELECT TO authenticated
    USING (
        public.user_has_company_access(company_id)
    );

DROP POLICY IF EXISTS "cash_movements_insert_policy" ON public.cash_movements;
CREATE POLICY "cash_movements_insert_policy" ON public.cash_movements
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_has_company_access(company_id)
        AND (public.user_is_company_admin(company_id) OR public.user_has_branch_access(branch_id))
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. FUNÇÕES RPC: ABERTURA, MOVIMENTAÇÃO E FECHAMENTO COM AUDITORIA
-- ─────────────────────────────────────────────────────────────────────────────

-- 5.1 Abertura de Caixa
CREATE OR REPLACE FUNCTION public.open_cash_session(
    p_company_id UUID,
    p_branch_id UUID,
    p_terminal_name VARCHAR(100),
    p_initial_amount NUMERIC(12, 2),
    p_opening_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(255);
    v_session_id UUID;
    v_term VARCHAR(100);
    v_existing RECORD;
BEGIN
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

    IF p_initial_amount < 0 THEN
        RAISE EXCEPTION 'O valor do fundo de caixa inicial não pode ser negativo.';
    END IF;

    v_term := TRIM(COALESCE(p_terminal_name, 'Caixa Principal'));
    IF v_term = '' THEN
        v_term := 'Caixa Principal';
    END IF;

    -- Busca nome do operador
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

    -- Verifica se o operador já possui caixa aberto nesta filial
    SELECT id, terminal_name INTO v_existing
    FROM public.cash_sessions
    WHERE branch_id = p_branch_id AND opened_by = v_user_id AND status = 'open'
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        RAISE EXCEPTION 'Você já possui um caixa aberto nesta filial (Terminal: %). Feche-o antes de abrir um novo.', v_existing.terminal_name;
    END IF;

    -- Verifica se o terminal já está em uso por outro operador
    SELECT id, opened_by_name INTO v_existing
    FROM public.cash_sessions
    WHERE branch_id = p_branch_id AND terminal_name = v_term AND status = 'open'
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        RAISE EXCEPTION 'O terminal "%" já está aberto e em uso pelo operador "%".', v_term, v_existing.opened_by_name;
    END IF;

    -- Insere a nova sessão
    INSERT INTO public.cash_sessions (
        company_id, branch_id, terminal_name,
        opened_by, opened_by_name, opened_at,
        initial_amount, opening_notes, status
    ) VALUES (
        p_company_id, p_branch_id, v_term,
        v_user_id, COALESCE(v_user_name, 'Operador'), now(),
        ROUND(p_initial_amount, 2), p_opening_notes, 'open'
    ) RETURNING id INTO v_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'terminal_name', v_term,
        'opened_at', now(),
        'initial_amount', ROUND(p_initial_amount, 2)
    );
END;
$$;

-- 5.2 Registrar Movimentação de Caixa (Suprimento, Sangria, Despesa)
CREATE OR REPLACE FUNCTION public.add_cash_movement(
    p_company_id UUID,
    p_branch_id UUID,
    p_cash_session_id UUID,
    p_movement_type VARCHAR(20),
    p_amount NUMERIC(12, 2),
    p_reason VARCHAR(255),
    p_notes TEXT DEFAULT NULL,
    p_receipt_url TEXT DEFAULT NULL,
    p_authorized_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(255);
    v_auth_name VARCHAR(255) := NULL;
    v_session RECORD;
    v_movement_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF NOT public.user_has_company_access(p_company_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado.';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'O valor da movimentação deve ser estritamente maior que zero.';
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'A justificativa/motivo da movimentação é obrigatória.';
    END IF;

    IF p_movement_type NOT IN ('supply', 'bleed', 'expense') THEN
        RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_movement_type;
    END IF;

    -- Verifica se a sessão está aberta
    SELECT * INTO v_session
    FROM public.cash_sessions
    WHERE id = p_cash_session_id AND company_id = p_company_id;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sessão de caixa não localizada.';
    END IF;

    IF v_session.status <> 'open' THEN
        RAISE EXCEPTION 'Não é permitido registrar movimentações em um caixa fechado.';
    END IF;

    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

    IF p_authorized_by IS NOT NULL THEN
        SELECT full_name INTO v_auth_name FROM public.profiles WHERE id = p_authorized_by;
    END IF;

    INSERT INTO public.cash_movements (
        company_id, branch_id, cash_session_id,
        movement_type, amount, reason,
        user_id, user_name, authorized_by, authorized_by_name,
        receipt_url, notes, created_at
    ) VALUES (
        p_company_id, p_branch_id, p_cash_session_id,
        p_movement_type, ROUND(p_amount, 2), TRIM(p_reason),
        v_user_id, COALESCE(v_user_name, 'Operador'), p_authorized_by, v_auth_name,
        p_receipt_url, p_notes, now()
    ) RETURNING id INTO v_movement_id;

    RETURN jsonb_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'movement_type', p_movement_type,
        'amount', ROUND(p_amount, 2),
        'created_at', now()
    );
END;
$$;

-- 5.3 Fechamento de Caixa com Apuração Real e Cálculo de Divergência
CREATE OR REPLACE FUNCTION public.close_cash_session(
    p_company_id UUID,
    p_session_id UUID,
    p_counted_cash NUMERIC(12, 2),
    p_closing_notes TEXT DEFAULT NULL,
    p_difference_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(255);
    v_session RECORD;

    -- Vendas por forma de pagamento
    v_sales_cash NUMERIC(12, 2) := 0.00;
    v_sales_pix NUMERIC(12, 2) := 0.00;
    v_sales_debit NUMERIC(12, 2) := 0.00;
    v_sales_credit NUMERIC(12, 2) := 0.00;
    v_sales_store_credit NUMERIC(12, 2) := 0.00;
    v_sales_other NUMERIC(12, 2) := 0.00;
    v_sales_count INTEGER := 0;

    -- Movimentações
    v_supplies NUMERIC(12, 2) := 0.00;
    v_bleed NUMERIC(12, 2) := 0.00;
    v_expenses NUMERIC(12, 2) := 0.00;

    -- Apuração do dinheiro esperado
    v_expected_cash NUMERIC(12, 2) := 0.00;
    v_difference NUMERIC(12, 2) := 0.00;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF NOT public.user_has_company_access(p_company_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado.';
    END IF;

    IF p_counted_cash IS NULL OR p_counted_cash < 0 THEN
        RAISE EXCEPTION 'Informe o valor contado em dinheiro na gaveta antes de fechar o caixa.';
    END IF;

    -- Bloqueio da sessão para evitar concorrência no fechamento
    SELECT * INTO v_session
    FROM public.cash_sessions
    WHERE id = p_session_id AND company_id = p_company_id
    FOR UPDATE;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sessão de caixa não localizada.';
    END IF;

    IF v_session.status <> 'open' THEN
        RAISE EXCEPTION 'Este caixa já se encontra fechado.';
    END IF;

    -- Permissão: apenas o operador que abriu ou gerentes/admins podem fechar
    IF v_session.opened_by <> v_user_id AND NOT public.user_is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Apenas o operador responsável ou um administrador pode realizar o fechamento deste caixa.';
    END IF;

    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

    -- 1. Totaliza quantidade de vendas concluídas vinculadas a esta sessão
    SELECT COUNT(s.id) INTO v_sales_count
    FROM public.sales s
    WHERE s.cash_session_id = p_session_id AND s.status = 'completed';

    -- 2. Totaliza pagamentos por método das vendas concluídas vinculadas a esta sessão
    SELECT
        COALESCE(SUM(CASE WHEN sp.payment_method = 'cash' THEN sp.amount ELSE 0.00 END), 0.00),
        COALESCE(SUM(CASE WHEN sp.payment_method = 'pix' THEN sp.amount ELSE 0.00 END), 0.00),
        COALESCE(SUM(CASE WHEN sp.payment_method = 'debit_card' THEN sp.amount ELSE 0.00 END), 0.00),
        COALESCE(SUM(CASE WHEN sp.payment_method = 'credit_card' THEN sp.amount ELSE 0.00 END), 0.00),
        COALESCE(SUM(CASE WHEN sp.payment_method = 'store_credit' THEN sp.amount ELSE 0.00 END), 0.00),
        COALESCE(SUM(CASE WHEN sp.payment_method = 'other' THEN sp.amount ELSE 0.00 END), 0.00)
    INTO
        v_sales_cash, v_sales_pix, v_sales_debit, v_sales_credit, v_sales_store_credit, v_sales_other
    FROM public.sale_payments sp
    INNER JOIN public.sales s ON s.id = sp.sale_id
    WHERE s.cash_session_id = p_session_id AND s.status = 'completed';

    -- 3. Totaliza movimentações de caixa (Suprimentos, Sangrias, Despesas)
    SELECT
        COALESCE(SUM(CASE WHEN movement_type = 'supply' THEN amount ELSE 0.00 END), 0.00),
        COALESCE(SUM(CASE WHEN movement_type = 'bleed' THEN amount ELSE 0.00 END), 0.00),
        COALESCE(SUM(CASE WHEN movement_type = 'expense' THEN amount ELSE 0.00 END), 0.00)
    INTO
        v_supplies, v_bleed, v_expenses
    FROM public.cash_movements
    WHERE cash_session_id = p_session_id;

    -- 4. Cálculo do Dinheiro Esperado Fisicamente no Caixa:
    -- Dinheiro esperado = fundo inicial + recebimentos líquidos em dinheiro + suprimentos − sangrias − despesas pagas em dinheiro
    v_expected_cash := ROUND(v_session.initial_amount + v_sales_cash + v_supplies - v_bleed - v_expenses, 2);

    -- 5. Diferença = dinheiro contado − dinheiro esperado
    v_difference := ROUND(p_counted_cash - v_expected_cash, 2);

    -- 6. Atualiza o registro da sessão fechando-a em definitivo
    UPDATE public.cash_sessions
    SET
        status = 'closed',
        closed_by = v_user_id,
        closed_by_name = COALESCE(v_user_name, 'Operador'),
        closed_at = now(),
        closing_notes = p_closing_notes,
        counted_cash = ROUND(p_counted_cash, 2),
        expected_cash = v_expected_cash,
        difference_cash = v_difference,
        difference_reason = p_difference_reason,
        total_sales_cash = v_sales_cash,
        total_sales_pix = v_sales_pix,
        total_sales_debit = v_sales_debit,
        total_sales_credit = v_sales_credit,
        total_sales_store_credit = v_sales_store_credit,
        total_sales_other = v_sales_other,
        total_sales_count = v_sales_count,
        total_supplies = v_supplies,
        total_bleed = v_bleed,
        total_expenses = v_expenses,
        updated_at = now()
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'initial_amount', v_session.initial_amount,
        'expected_cash', v_expected_cash,
        'counted_cash', ROUND(p_counted_cash, 2),
        'difference_cash', v_difference,
        'total_sales_cash', v_sales_cash,
        'total_sales_pix', v_sales_pix,
        'total_sales_debit', v_sales_debit,
        'total_sales_credit', v_sales_credit,
        'total_sales_store_credit', v_sales_store_credit,
        'total_sales_other', v_sales_other,
        'total_sales_count', v_sales_count,
        'total_supplies', v_supplies,
        'total_bleed', v_bleed,
        'total_expenses', v_expenses,
        'closed_at', now()
    );
END;
$$;

-- 5.4 Auditoria / Conferência Gerencial de Caixa
CREATE OR REPLACE FUNCTION public.verify_cash_session(
    p_company_id UUID,
    p_session_id UUID,
    p_verification_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(255);
    v_session RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF NOT (public.user_is_company_admin(p_company_id) OR public.user_has_permission(p_company_id, 'financial', 'edit')) THEN
        RAISE EXCEPTION 'Apenas gerentes e administradores podem realizar conferência de fechamento.';
    END IF;

    SELECT * INTO v_session FROM public.cash_sessions WHERE id = p_session_id AND company_id = p_company_id;
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sessão de caixa não localizada.';
    END IF;

    IF v_session.status <> 'closed' THEN
        RAISE EXCEPTION 'A conferência só pode ser registrada em um caixa já fechado.';
    END IF;

    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

    UPDATE public.cash_sessions
    SET
        verified_by = v_user_id,
        verified_by_name = COALESCE(v_user_name, 'Gerente/Admin'),
        verified_at = now(),
        verification_notes = p_verification_notes,
        updated_at = now()
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'verified_at', now(),
        'verified_by_name', v_user_name
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ATUALIZAÇÃO DA RPC finalize_pos_sale: VINCULAÇÃO E VERIFICAÇÃO DE CAIXA
-- ─────────────────────────────────────────────────────────────────────────────
-- Remove com segurança sobrecargas anteriores com assinaturas diferentes
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
    p_cash_session_id UUID DEFAULT NULL
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

    -- Iteradores de itens
    v_item JSONB;
    v_prod RECORD;
    v_qty NUMERIC(12, 3);
    v_item_unit_price NUMERIC(12, 2);
    v_item_price_type VARCHAR(20);
    v_item_discount NUMERIC(12, 2);
    v_item_subtotal NUMERIC(12, 2);
    v_item_total NUMERIC(12, 2);
    v_current_stock NUMERIC(12, 3);

    -- Iteradores de pagamentos
    v_payment JSONB;
    v_pay_method VARCHAR(30);
    v_pay_amount NUMERIC(12, 2);
    v_pay_received NUMERIC(12, 2);
    v_pay_change NUMERIC(12, 2);
    v_pay_installments INTEGER;

    -- Orçamento
    v_quote RECORD;
BEGIN
    -- 1. Autenticação e Autorização
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
        -- Tenta localizar o caixa atualmente aberto para o operador autenticado nesta filial
        SELECT id INTO v_cash_session_id
        FROM public.cash_sessions
        WHERE branch_id = p_branch_id AND opened_by = v_user_id AND status = 'open'
        ORDER BY opened_at DESC
        LIMIT 1;

        -- Se não houver caixa individual, tenta localizar um caixa aberto geral para o terminal/filial
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
            RAISE EXCEPTION 'Quantidade inválida para o produto. Deve ser maior que zero.';
        END IF;

        SELECT * INTO v_prod
        FROM public.products
        WHERE id = (v_item->>'product_id')::UUID AND company_id = p_company_id;

        IF v_prod.id IS NULL THEN
            RAISE EXCEPTION 'Produto não cadastrado ou não pertence à empresa.';
        END IF;

        IF v_prod.status <> 'active' THEN
            RAISE EXCEPTION 'O produto "%" está inativo para vendas.', v_prod.name;
        END IF;

        IF v_prod.wholesale_price IS NOT NULL AND v_prod.wholesale_price > 0 AND (
            (v_prod.wholesale_min_qty IS NOT NULL AND v_prod.wholesale_min_qty > 0 AND v_qty >= v_prod.wholesale_min_qty) OR
            ((v_prod.wholesale_min_qty IS NULL OR v_prod.wholesale_min_qty = 0) AND v_qty >= 5)
        ) THEN
            v_item_unit_price := v_prod.wholesale_price;
            v_item_price_type := 'wholesale';
        ELSE
            v_item_unit_price := v_prod.sale_price;
            v_item_price_type := 'retail';
        END IF;

        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);
        IF v_item_discount < 0 THEN
            v_item_discount := 0;
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

    -- 9. Validação dos Pagamentos contra o Total da Venda
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

        v_payments_total := v_payments_total + v_pay_amount;
    END LOOP;

    IF ABS(v_payments_total - v_total) > 0.01 THEN
        RAISE EXCEPTION 'A soma dos pagamentos (R$ %) difere do total da venda (R$ %).',
            v_payments_total, v_total;
    END IF;

    -- 10. Geração do Número e Código da Venda
    v_sale_number := nextval('public.sale_number_seq');
    v_sale_code := 'VND-' || lpad(v_sale_number::text, 6, '0');

    -- 11. Inserção do Cabeçalho da Venda vinculado ao Caixa Aberto
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

    -- 12. Inserção dos Itens e Baixa Atômica de Estoque
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::NUMERIC;

        SELECT * INTO v_prod
        FROM public.products
        WHERE id = (v_item->>'product_id')::UUID;

        IF v_prod.wholesale_price IS NOT NULL AND v_prod.wholesale_price > 0 AND (
            (v_prod.wholesale_min_qty IS NOT NULL AND v_prod.wholesale_min_qty > 0 AND v_qty >= v_prod.wholesale_min_qty) OR
            ((v_prod.wholesale_min_qty IS NULL OR v_prod.wholesale_min_qty = 0) AND v_qty >= 5)
        ) THEN
            v_item_unit_price := v_prod.wholesale_price;
            v_item_price_type := 'wholesale';
        ELSE
            v_item_unit_price := v_prod.sale_price;
            v_item_price_type := 'retail';
        END IF;

        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);
        v_item_subtotal := ROUND(v_item_unit_price * v_qty, 2);
        v_item_total := ROUND(v_item_subtotal - v_item_discount, 2);

        INSERT INTO public.sale_items (
            sale_id, company_id, branch_id, product_id,
            product_name, product_sku, product_barcode, unit,
            quantity, unit_price, cost_price, price_type, discount,
            subtotal, total
        ) VALUES (
            v_sale_id, p_company_id, p_branch_id, v_prod.id,
            v_prod.name, v_prod.sku, v_prod.barcode, v_prod.unit,
            v_qty, v_item_unit_price, v_prod.cost_price, v_item_price_type, v_item_discount,
            v_item_subtotal, v_item_total
        );

        INSERT INTO public.branch_stock (company_id, branch_id, product_id, quantity, min_stock, updated_at)
        VALUES (p_company_id, p_branch_id, v_prod.id, 0.000, COALESCE(v_prod.min_stock, 0.000), now())
        ON CONFLICT (branch_id, product_id) DO NOTHING;

        SELECT quantity INTO v_current_stock
        FROM public.branch_stock
        WHERE branch_id = p_branch_id AND product_id = v_prod.id
        FOR UPDATE;

        IF v_current_stock < v_qty THEN
            RAISE EXCEPTION 'Estoque insuficiente para o produto "%". Saldo disponível na filial: %, Solicitado: %',
                v_prod.name, v_current_stock, v_qty;
        END IF;

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

    -- 13. Inserção das Formas de Pagamento
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

    -- 14. Conversão de Orçamento (se aplicável)
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

    -- 15. Retorno de Sucesso
    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'sale_code', v_sale_code,
        'sale_number', v_sale_number,
        'subtotal', v_subtotal,
        'discount_amount', v_discount_amount,
        'total', v_total,
        'payment_amount', v_payments_total,
        'change_amount', v_total_change,
        'cash_session_id', v_cash_session_id,
        'created_at', now()
    );
END;
$$;

-- Concede permissões para as novas funções
REVOKE ALL ON FUNCTION public.open_cash_session FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_cash_session TO authenticated;

REVOKE ALL ON FUNCTION public.add_cash_movement FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_cash_movement TO authenticated;

REVOKE ALL ON FUNCTION public.close_cash_session FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_cash_session TO authenticated;

REVOKE ALL ON FUNCTION public.verify_cash_session FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_cash_session TO authenticated;

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
