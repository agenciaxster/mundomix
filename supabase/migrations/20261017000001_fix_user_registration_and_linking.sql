-- ==============================================================================
-- MIGRATION: 20261017000001_fix_user_registration_and_linking.sql
-- DESCRIÇÃO: Habilita busca de perfis por administradores e procedure atômica
--            para vinculação de novos usuários por e-mail no ERP.
-- ==============================================================================

-- 1. Atualizar política de SELECT em profiles
-- Permite que administradores ativos de qualquer empresa possam consultar
-- o e-mail/perfil de usuários para vinculação à empresa.
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
        OR EXISTS (
            SELECT 1
            FROM public.user_company_access uca
            WHERE uca.user_id = auth.uid()
              AND uca.role IN ('owner', 'admin')
              AND uca.status = 'active'
        )
    );

-- 2. Função segura para localizar ID de usuário pelo e-mail
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
    LIMIT 1;

    RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_user_id_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) TO authenticated;

-- 3. Procedure segura para vincular usuário por e-mail a uma empresa e filiais
CREATE OR REPLACE FUNCTION public.link_user_by_email(
    p_company_id UUID,
    p_email TEXT,
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
    v_target_user_id UUID;
    v_branch_id UUID;
BEGIN
    -- Verifica privilégios do chamador
    SELECT role INTO v_caller_role
    FROM public.user_company_access
    WHERE user_id = auth.uid() AND company_id = p_company_id AND status = 'active';

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores da empresa podem vincular membros.';
    END IF;

    -- Proteção: apenas owner pode conceder papel owner
    IF p_role = 'owner' AND v_caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Apenas o proprietário pode conceder privilégios de proprietário.';
    END IF;

    -- Localiza o perfil pelo e-mail
    SELECT id INTO v_target_user_id
    FROM public.profiles
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
    LIMIT 1;

    IF v_target_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não encontrado com o e-mail informado.';
    END IF;

    -- Insere ou atualiza o vínculo na empresa
    INSERT INTO public.user_company_access (user_id, company_id, role, role_id, status)
    VALUES (v_target_user_id, p_company_id, p_role, p_role_id, 'active')
    ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role,
        role_id = EXCLUDED.role_id,
        status = 'active',
        updated_at = now();

    -- Atualiza as filiais autorizadas
    DELETE FROM public.user_branch_access uba
    WHERE uba.user_id = v_target_user_id
      AND uba.branch_id IN (
          SELECT b.id FROM public.branches b WHERE b.company_id = p_company_id
      )
      AND (p_branch_ids IS NULL OR uba.branch_id <> ALL(p_branch_ids));

    IF p_branch_ids IS NOT NULL THEN
        FOREACH v_branch_id IN ARRAY p_branch_ids
        LOOP
            IF EXISTS (SELECT 1 FROM public.branches WHERE id = v_branch_id AND company_id = p_company_id) THEN
                INSERT INTO public.user_branch_access (user_id, branch_id, status)
                VALUES (v_target_user_id, v_branch_id, 'active')
                ON CONFLICT (user_id, branch_id) DO UPDATE
                SET status = 'active';
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_target_user_id,
        'message', 'Usuário vinculado com sucesso à empresa.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.link_user_by_email(UUID, TEXT, TEXT, UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_user_by_email(UUID, TEXT, TEXT, UUID, UUID[]) TO authenticated;

-- 4. Função RPC atômica para vincular usuário à empresa e filiais por ID (assign_user_to_company)
CREATE OR REPLACE FUNCTION public.assign_user_to_company(
    p_company_id UUID,
    p_target_user_id UUID,
    p_role TEXT,
    p_role_id UUID DEFAULT NULL,
    p_branch_ids UUID[] DEFAULT '{}'::UUID[]
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
    -- Verifica privilégios do chamador se estiver autenticado
    IF auth.uid() IS NOT NULL THEN
        SELECT role INTO v_caller_role
        FROM public.user_company_access
        WHERE user_id = auth.uid() AND company_id = p_company_id AND status = 'active';

        IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Acesso negado: apenas administradores da empresa podem vincular membros.';
        END IF;

        IF p_role = 'owner' AND v_caller_role <> 'owner' THEN
            RAISE EXCEPTION 'Apenas o proprietário pode conceder privilégios de proprietário.';
        END IF;
    END IF;

    -- Insere ou atualiza o vínculo na empresa
    INSERT INTO public.user_company_access (user_id, company_id, role, role_id, status)
    VALUES (p_target_user_id, p_company_id, p_role, p_role_id, 'active')
    ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role,
        role_id = EXCLUDED.role_id,
        status = 'active',
        updated_at = now();

    -- Atualiza as filiais autorizadas
    DELETE FROM public.user_branch_access uba
    WHERE uba.user_id = p_target_user_id
      AND uba.branch_id IN (
          SELECT b.id FROM public.branches b WHERE b.company_id = p_company_id
      )
      AND (p_branch_ids IS NULL OR uba.branch_id <> ALL(p_branch_ids));

    IF p_branch_ids IS NOT NULL AND array_length(p_branch_ids, 1) > 0 THEN
        FOREACH v_branch_id IN ARRAY p_branch_ids
        LOOP
            IF EXISTS (SELECT 1 FROM public.branches WHERE id = v_branch_id AND company_id = p_company_id) THEN
                INSERT INTO public.user_branch_access (user_id, branch_id, status)
                VALUES (p_target_user_id, v_branch_id, 'active')
                ON CONFLICT (user_id, branch_id) DO UPDATE
                SET status = 'active';
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_target_user_id,
        'message', 'Usuário vinculado com sucesso à empresa.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_to_company(UUID, UUID, TEXT, UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_user_to_company(UUID, UUID, TEXT, UUID, UUID[]) TO authenticated;

-- 5. Atualização da RPC finalize_pos_sale (Correção: remoção da coluna legada is_active e validação por status = 'active')
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

