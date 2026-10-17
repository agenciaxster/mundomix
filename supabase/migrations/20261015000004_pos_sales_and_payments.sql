-- ==============================================================================
-- MIGRATION: 20261015000004_pos_sales_and_payments.sql
-- DESCRIÇÃO: ETAPA 9 — Ponto de Venda (PDV), Formas de Pagamento, 
--            Baixa Atômica de Estoque, Idempotência e Integração com Orçamentos.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SEQUÊNCIA NUMÉRICA PARA VENDAS (Ex: VND-001001)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.sale_number_seq START WITH 1001;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA PRINCIPAL DE VENDAS (sales)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    customer_document VARCHAR(30),
    sale_number BIGINT NOT NULL DEFAULT nextval('public.sale_number_seq'),
    code VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_type VARCHAR(10) NOT NULL DEFAULT 'value' CHECK (discount_type IN ('percentage', 'value')),
    discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_value >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    payment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (payment_amount >= 0),
    change_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (change_amount >= 0),
    quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_sales_company_code UNIQUE (company_id, code),
    CONSTRAINT uq_sales_idempotency UNIQUE (company_id, idempotency_key)
);

COMMENT ON TABLE public.sales IS 'Cabeçalho de vendas faturadas no PDV / Frente de Caixa';

CREATE INDEX IF NOT EXISTS idx_sales_company ON public.sales(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON public.sales(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON public.sales(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_code ON public.sales(company_id, code);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABELA DE ITENS DA VENDA (sale_items)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    product_barcode VARCHAR(100),
    unit VARCHAR(20) NOT NULL DEFAULT 'UN',
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    price_type VARCHAR(20) NOT NULL DEFAULT 'retail' CHECK (price_type IN ('retail', 'wholesale', 'custom')),
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sale_items IS 'Itens e produtos faturados em uma venda do PDV';

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_company ON public.sale_items(company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABELA DE FORMAS DE PAGAMENTO DA VENDA (sale_payments)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sale_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    payment_method VARCHAR(30) NOT NULL CHECK (
        payment_method IN ('cash', 'pix', 'credit_card', 'debit_card', 'store_credit', 'other')
    ),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    received_amount NUMERIC(12, 2) DEFAULT 0.00 CHECK (received_amount >= 0),
    change_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (change_amount >= 0),
    installments INTEGER NOT NULL DEFAULT 1 CHECK (installments >= 1),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sale_payments IS 'Formas e valores de pagamento utilizados para liquidar a venda no PDV';

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON public.sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_company ON public.sale_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_method ON public.sale_payments(company_id, payment_method);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. POLÍTICAS RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

-- Políticas para sales
DROP POLICY IF EXISTS "sales_select_policy" ON public.sales;
CREATE POLICY "sales_select_policy" ON public.sales
    FOR SELECT TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "sales_insert_policy" ON public.sales;
CREATE POLICY "sales_insert_policy" ON public.sales
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "sales_update_policy" ON public.sales;
CREATE POLICY "sales_update_policy" ON public.sales
    FOR UPDATE TO authenticated
    USING (public.user_is_company_admin(company_id));

DROP POLICY IF EXISTS "sales_delete_policy" ON public.sales;
CREATE POLICY "sales_delete_policy" ON public.sales
    FOR DELETE TO authenticated
    USING (public.user_is_company_admin(company_id));

-- Políticas para sale_items
DROP POLICY IF EXISTS "sale_items_select_policy" ON public.sale_items;
CREATE POLICY "sale_items_select_policy" ON public.sale_items
    FOR SELECT TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "sale_items_insert_policy" ON public.sale_items;
CREATE POLICY "sale_items_insert_policy" ON public.sale_items
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "sale_items_update_policy" ON public.sale_items;
CREATE POLICY "sale_items_update_policy" ON public.sale_items
    FOR UPDATE TO authenticated
    USING (public.user_is_company_admin(company_id));

DROP POLICY IF EXISTS "sale_items_delete_policy" ON public.sale_items;
CREATE POLICY "sale_items_delete_policy" ON public.sale_items
    FOR DELETE TO authenticated
    USING (public.user_is_company_admin(company_id));

-- Políticas para sale_payments
DROP POLICY IF EXISTS "sale_payments_select_policy" ON public.sale_payments;
CREATE POLICY "sale_payments_select_policy" ON public.sale_payments
    FOR SELECT TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "sale_payments_insert_policy" ON public.sale_payments;
CREATE POLICY "sale_payments_insert_policy" ON public.sale_payments
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_company_access(company_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FUNÇÃO RPC TRANSACIONAL ATÔMICA: finalize_pos_sale
-- Executa com isolamento ACID estrito:
-- 1. Validação de usuário, empresa e filial
-- 2. Idempotência (evita duplicidade em clique duplo)
-- 3. Validação de produtos, recálculo seguro de atacado/varejo e descontos
-- 4. Verificação de saldo de estoque por filial (FOR UPDATE com bloqueio)
-- 5. Inserção do cabeçalho da venda e itens
-- 6. Baixa do saldo em branch_stock
-- 7. Registro de auditoria em stock_movements (tipo 'exit')
-- 8. Registro das formas de pagamento (1 ou 2) e troco
-- 9. Conversão atômica de orçamento vinculado (se informado)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finalize_pos_sale(
    p_company_id UUID,
    p_branch_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_customer_name VARCHAR DEFAULT NULL,
    p_customer_document VARCHAR DEFAULT NULL,
    p_discount_type VARCHAR DEFAULT 'value',
    p_discount_value NUMERIC DEFAULT 0,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_payments JSONB DEFAULT '[]'::jsonb,
    p_quote_id UUID DEFAULT NULL,
    p_idempotency_key VARCHAR DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_existing_sale RECORD;
    v_sale_id UUID;
    v_sale_number BIGINT;
    v_sale_code VARCHAR(50);

    -- Totais
    v_subtotal NUMERIC(12, 2) := 0.00;
    v_discount_amount NUMERIC(12, 2) := 0.00;
    v_total NUMERIC(12, 2) := 0.00;
    v_payments_total NUMERIC(12, 2) := 0.00;
    v_total_change NUMERIC(12, 2) := 0.00;

    -- Iteradores de itens
    v_item JSONB;
    v_prod RECORD;
    v_prod_stock RECORD;
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

    -- Validação de filial
    IF NOT (public.user_is_company_admin(p_company_id) OR public.user_has_branch_access(p_branch_id)) THEN
        RAISE EXCEPTION 'Usuário não possui permissão para operar nesta filial.';
    END IF;

    -- 2. Verificação de Idempotência
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        SELECT * INTO v_existing_sale
        FROM public.sales
        WHERE company_id = p_company_id AND idempotency_key = TRIM(p_idempotency_key);

        IF v_existing_sale.id IS NOT NULL THEN
            -- Retorna a venda existente imediatamente sem reprocessar
            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'sale_id', v_existing_sale.id,
                'sale_code', v_existing_sale.code,
                'sale_number', v_existing_sale.sale_number,
                'total', v_existing_sale.total,
                'change_amount', v_existing_sale.change_amount
            );
        END IF;
    END IF;

    -- 3. Verificação de Orçamento Vinculado
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

    -- 4. Validação da Lista de Itens
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'A venda deve conter pelo menos 1 item no carrinho.';
    END IF;

    -- 5. Validação das Formas de Pagamento (mínimo 1, máximo 2 formas)
    IF jsonb_array_length(p_payments) = 0 THEN
        RAISE EXCEPTION 'Informe ao menos 1 forma de pagamento.';
    END IF;

    IF jsonb_array_length(p_payments) > 2 THEN
        RAISE EXCEPTION 'O PDV permite no máximo 2 formas de pagamento por venda.';
    END IF;

    -- 6. Primeira passagem: Validação de produtos, cálculo seguro de preços e subtotal
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::NUMERIC, 0);
        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Quantidade inválida para o produto. Deve ser maior que zero.';
        END IF;

        -- Carrega produto com lock de leitura
        SELECT * INTO v_prod
        FROM public.products
        WHERE id = (v_item->>'product_id')::UUID AND company_id = p_company_id;

        IF v_prod.id IS NULL THEN
            RAISE EXCEPTION 'Produto não cadastrado ou não pertence à empresa.';
        END IF;

        IF v_prod.status <> 'active' THEN
            RAISE EXCEPTION 'O produto "%" está inativo para vendas.', v_prod.name;
        END IF;

        -- Regra de atacado do backend:
        -- Se wholesale_price configurado > 0 e quantidade atinge wholesale_min_qty (ou >= 5 se min_qty for 0 ou nulo)
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

        -- Validação de desconto por item
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

    -- 7. Cálculo do Desconto Geral e Total Líquido
    IF p_discount_type = 'percentage' THEN
        v_discount_amount := ROUND(v_subtotal * (LEAST(GREATEST(p_discount_value, 0), 100) / 100), 2);
    ELSE
        v_discount_amount := LEAST(GREATEST(p_discount_value, 0), v_subtotal);
    END IF;

    v_total := ROUND(GREATEST(0, v_subtotal - v_discount_amount), 2);

    -- 8. Validação dos Pagamentos contra o Total da Venda
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

        -- Regra de dinheiro e troco
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

    -- A soma das formas de pagamento deve ser igual ao total da venda (tolerância de 1 centavo para arredondamento)
    IF ABS(v_payments_total - v_total) > 0.01 THEN
        RAISE EXCEPTION 'A soma dos pagamentos (R$ %) difere do total da venda (R$ %).',
            v_payments_total, v_total;
    END IF;

    -- 9. Geração do Número e Código da Venda
    v_sale_number := nextval('public.sale_number_seq');
    v_sale_code := 'VND-' || lpad(v_sale_number::text, 6, '0');

    -- 10. Inserção do Cabeçalho da Venda (sales)
    INSERT INTO public.sales (
        company_id, branch_id, user_id,
        customer_id, customer_name, customer_document,
        sale_number, code, status,
        subtotal, discount_type, discount_value, discount_amount, total,
        payment_amount, change_amount, quote_id, idempotency_key, notes
    ) VALUES (
        p_company_id, p_branch_id, v_user_id,
        p_customer_id, p_customer_name, p_customer_document,
        v_sale_number, v_sale_code, 'completed',
        v_subtotal, p_discount_type, p_discount_value, v_discount_amount, v_total,
        v_payments_total, v_total_change, p_quote_id, p_idempotency_key, p_notes
    ) RETURNING id INTO v_sale_id;

    -- 11. Inserção dos Itens e Baixa Atômica de Estoque
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

        -- Inserção do item da venda
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

        -- Bloqueio e verificação do estoque da filial (branch_stock)
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

        -- Baixa do estoque
        UPDATE public.branch_stock
        SET quantity = quantity - v_qty,
            last_movement_at = now(),
            updated_at = now()
        WHERE branch_id = p_branch_id AND product_id = v_prod.id;

        -- Registro de movimentação no histórico imutável (stock_movements)
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

    -- 12. Inserção das Formas de Pagamento (sale_payments)
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

    -- 13. Conversão de Orçamento (se vinculado)
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

    -- 14. Retorno de Sucesso com Resumo da Venda
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
        'created_at', now()
    );
END;
$$;

-- Permissões de execução para usuários autenticados
REVOKE ALL ON FUNCTION public.finalize_pos_sale FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_pos_sale TO authenticated;
