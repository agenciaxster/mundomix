-- ==============================================================================
-- MIGRATION: 20261014000008_quotes_and_product_inquiry.sql
-- DESCRIÇÃO: ETAPA 8 — Consulta de Produtos e Criação de Orçamentos
-- ==============================================================================

-- 1. Ampliação da Tabela products (Marca, Imagem, Atacado e Mínimo para Atacado)
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(12, 2) CHECK (wholesale_price >= 0),
    ADD COLUMN IF NOT EXISTS wholesale_min_qty NUMERIC(12, 3) DEFAULT 0 CHECK (wholesale_min_qty >= 0);

COMMENT ON COLUMN public.products.brand IS 'Marca ou fabricante do produto';
COMMENT ON COLUMN public.products.image_url IS 'URL da foto do produto para catálogo do vendedor';
COMMENT ON COLUMN public.products.wholesale_price IS 'Preço de atacado aplicável quando atinge a quantidade mínima';
COMMENT ON COLUMN public.products.wholesale_min_qty IS 'Quantidade mínima de itens para acionar o preço de atacado';

CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- 2. Sequência Numérica para Orçamentos
CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq START WITH 1001;

-- 3. Tabela: quotes (Cabeçalho de Orçamentos Comerciais)
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    quote_number BIGINT NOT NULL DEFAULT nextval('public.quote_number_seq'),
    code VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    customer_document VARCHAR(30),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(25),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired', 'converted')),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_type VARCHAR(10) NOT NULL DEFAULT 'value' CHECK (discount_type IN ('percentage', 'value')),
    discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_value >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    notes TEXT,
    valid_until DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
    converted_at TIMESTAMPTZ,
    converted_to_sale_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_quotes_company_code UNIQUE (company_id, code)
);

COMMENT ON TABLE public.quotes IS 'Orçamentos e propostas comerciais emitidos por vendedores para clientes';

CREATE INDEX IF NOT EXISTS idx_quotes_company ON public.quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_branch ON public.quotes(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON public.quotes(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user ON public.quotes(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(company_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON public.quotes(company_id, created_at DESC);

-- 4. Tabela: quote_items (Itens do Orçamento com suporte a Varejo e Atacado)
CREATE TABLE IF NOT EXISTS public.quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    product_barcode VARCHAR(100),
    unit VARCHAR(20) NOT NULL DEFAULT 'UN',
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    price_type VARCHAR(20) NOT NULL DEFAULT 'retail' CHECK (price_type IN ('retail', 'wholesale', 'custom')),
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quote_items IS 'Itens e produtos contidos em um orçamento comercial';

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON public.quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_product ON public.quote_items(product_id);

-- 5. Tabela: quote_status_history (Auditoria imutável de transições de status)
CREATE TABLE IF NOT EXISTS public.quote_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    reason TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quote_status_history IS 'Histórico auditável e imutável de transições de status de orçamentos';

CREATE INDEX IF NOT EXISTS idx_quote_history_quote ON public.quote_status_history(quote_id, created_at DESC);

-- 6. Triggers de Integridade e Proteção contra Alteração de Orçamentos Convertidos
CREATE OR REPLACE FUNCTION public.check_quote_editable()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Se o orçamento já estava convertido em venda, impede qualquer modificação nos valores ou itens
        IF OLD.status = 'converted' THEN
            RAISE EXCEPTION 'Não é permitido alterar um orçamento já convertido em venda.';
        END IF;

        -- Impede converter para venda se já estava convertido (proteção contra conversão duplicada)
        IF OLD.status = 'converted' AND NEW.status = 'converted' THEN
            RAISE EXCEPTION 'Este orçamento já foi convertido em venda anteriormente.';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'converted' THEN
            RAISE EXCEPTION 'Não é permitido excluir um orçamento já convertido em venda.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_quote_editable ON public.quotes;
CREATE TRIGGER trg_check_quote_editable
    BEFORE UPDATE OR DELETE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.check_quote_editable();

-- Trigger para bloquear alteração em itens de orçamentos convertidos
CREATE OR REPLACE FUNCTION public.check_quote_item_editable()
RETURNS TRIGGER AS $$
DECLARE
    v_status VARCHAR(20);
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        SELECT status INTO v_status FROM public.quotes WHERE id = OLD.quote_id;
        IF v_status = 'converted' THEN
            RAISE EXCEPTION 'Não é permitido modificar itens de um orçamento já convertido em venda.';
        END IF;
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        SELECT status INTO v_status FROM public.quotes WHERE id = NEW.quote_id;
        IF v_status = 'converted' THEN
            RAISE EXCEPTION 'Não é permitido adicionar itens a um orçamento já convertido em venda.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_quote_item_editable ON public.quote_items;
CREATE TRIGGER trg_check_quote_item_editable
    BEFORE INSERT OR UPDATE OR DELETE ON public.quote_items
    FOR EACH ROW
    EXECUTE FUNCTION public.check_quote_item_editable();

-- Trigger de updated_at para quotes
DROP TRIGGER IF EXISTS trg_quotes_updated_at ON public.quotes;
CREATE TRIGGER trg_quotes_updated_at
    BEFORE UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 7. Função RPC Atômica para Salvar/Recalcular Orçamento no Backend com Segurança
CREATE OR REPLACE FUNCTION public.save_quote(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_quote_id UUID;
    v_company_id UUID;
    v_branch_id UUID;
    v_code VARCHAR(50);
    v_customer_id UUID;
    v_customer_name VARCHAR(255);
    v_customer_doc VARCHAR(30);
    v_customer_email VARCHAR(255);
    v_customer_phone VARCHAR(25);
    v_notes TEXT;
    v_valid_until DATE;
    v_discount_type VARCHAR(10);
    v_discount_value NUMERIC(12, 2);
    v_discount_amount NUMERIC(12, 2) := 0;
    v_status VARCHAR(20);
    v_old_status VARCHAR(20) := NULL;
    v_item RECORD;
    v_prod RECORD;
    v_item_unit_price NUMERIC(12, 2);
    v_item_price_type VARCHAR(20);
    v_item_subtotal NUMERIC(12, 2);
    v_item_discount NUMERIC(12, 2);
    v_item_total NUMERIC(12, 2);
    v_calculated_subtotal NUMERIC(12, 2) := 0;
    v_calculated_total NUMERIC(12, 2) := 0;
    v_quote_number BIGINT;
    v_items_json JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    v_company_id := (p_payload->>'company_id')::UUID;
    v_branch_id := (p_payload->>'branch_id')::UUID;

    IF v_company_id IS NULL OR v_branch_id IS NULL THEN
        RAISE EXCEPTION 'Empresa e filial são obrigatórias para o orçamento.';
    END IF;

    IF NOT public.user_has_company_access(v_company_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado para esta empresa.';
    END IF;

    v_items_json := p_payload->'items';
    IF v_items_json IS NULL OR jsonb_array_length(v_items_json) = 0 THEN
        RAISE EXCEPTION 'O orçamento precisa conter pelo menos um produto.';
    END IF;

    v_status := COALESCE(p_payload->>'status', 'draft');
    IF v_status NOT IN ('draft', 'sent', 'approved', 'rejected', 'expired') THEN
        v_status := 'draft';
    END IF;

    v_notes := p_payload->>'notes';
    v_valid_until := COALESCE((p_payload->>'valid_until')::DATE, CURRENT_DATE + INTERVAL '7 days');
    v_discount_type := COALESCE(p_payload->>'discount_type', 'value');
    v_discount_value := COALESCE((p_payload->>'discount_value')::NUMERIC, 0);
    IF v_discount_value < 0 THEN
        v_discount_value := 0;
    END IF;

    -- Dados do cliente (se fornecido)
    IF p_payload->>'customer_id' IS NOT NULL AND p_payload->>'customer_id' <> '' THEN
        v_customer_id := (p_payload->>'customer_id')::UUID;
        SELECT name, document, email, phone INTO v_customer_name, v_customer_doc, v_customer_email, v_customer_phone
        FROM public.customers WHERE id = v_customer_id AND company_id = v_company_id;
    ELSE
        v_customer_id := NULL;
        v_customer_name := p_payload->>'customer_name';
        v_customer_doc := p_payload->>'customer_document';
        v_customer_email := p_payload->>'customer_email';
        v_customer_phone := p_payload->>'customer_phone';
    END IF;

    -- Se já for uma edição de orçamento existente
    IF p_payload->>'id' IS NOT NULL AND p_payload->>'id' <> '' THEN
        v_quote_id := (p_payload->>'id')::UUID;
        SELECT status, code INTO v_old_status, v_code FROM public.quotes WHERE id = v_quote_id AND company_id = v_company_id;

        IF v_old_status IS NULL THEN
            RAISE EXCEPTION 'Orçamento não encontrado.';
        END IF;

        IF v_old_status = 'converted' THEN
            RAISE EXCEPTION 'Não é permitido editar um orçamento que já foi convertido em venda.';
        END IF;

        -- Remove itens antigos para reinserção calculada
        DELETE FROM public.quote_items WHERE quote_id = v_quote_id;
    ELSE
        v_quote_number := nextval('public.quote_number_seq');
        v_code := 'ORC-' || lpad(v_quote_number::text, 6, '0');

        INSERT INTO public.quotes (
            company_id, branch_id, quote_number, code,
            customer_id, customer_name, customer_document, customer_email, customer_phone,
            user_id, status, subtotal, discount_type, discount_value, discount_amount, total,
            notes, valid_until
        ) VALUES (
            v_company_id, v_branch_id, v_quote_number, v_code,
            v_customer_id, v_customer_name, v_customer_doc, v_customer_email, v_customer_phone,
            v_user_id, v_status, 0, v_discount_type, v_discount_value, 0, 0,
            v_notes, v_valid_until
        ) RETURNING id INTO v_quote_id;

        -- Grava primeiro registro de histórico
        INSERT INTO public.quote_status_history (
            quote_id, company_id, previous_status, new_status, reason, user_id
        ) VALUES (
            v_quote_id, v_company_id, NULL, v_status, 'Criação inicial do orçamento', v_user_id
        );
    END IF;

    -- Processa e recalcula cada item com validação no catálogo de produtos
    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_items_json) AS x(
        product_id UUID,
        quantity NUMERIC,
        unit_price NUMERIC,
        discount NUMERIC,
        notes TEXT
    ) LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'A quantidade do item deve ser maior que zero.';
        END IF;

        SELECT id, name, sku, barcode, unit, sale_price, wholesale_price, wholesale_min_qty
        INTO v_prod
        FROM public.products
        WHERE id = v_item.product_id AND company_id = v_company_id;

        IF v_prod.id IS NULL THEN
            RAISE EXCEPTION 'Produto não cadastrado ou inativo: %', v_item.product_id;
        END IF;

        -- Regra de atacado: se a quantidade do item atender ao mínimo de atacado do produto
        IF v_prod.wholesale_price IS NOT NULL AND v_prod.wholesale_price > 0
           AND v_prod.wholesale_min_qty IS NOT NULL AND v_prod.wholesale_min_qty > 0
           AND v_item.quantity >= v_prod.wholesale_min_qty THEN
            v_item_unit_price := v_prod.wholesale_price;
            v_item_price_type := 'wholesale';
        ELSE
            -- Preço de varejo cadastrado ou preço unitário informado (não pode ser negativo)
            v_item_unit_price := COALESCE(v_item.unit_price, v_prod.sale_price);
            IF v_item_unit_price < 0 THEN
                v_item_unit_price := v_prod.sale_price;
            END IF;
            v_item_price_type := 'retail';
        END IF;

        v_item_discount := COALESCE(v_item.discount, 0);
        IF v_item_discount < 0 THEN v_item_discount := 0; END IF;

        v_item_subtotal := round(v_item_unit_price * v_item.quantity, 2);
        v_item_total := round(v_item_subtotal - v_item_discount, 2);
        IF v_item_total < 0 THEN v_item_total := 0; END IF;

        v_calculated_subtotal := v_calculated_subtotal + v_item_subtotal;

        INSERT INTO public.quote_items (
            quote_id, product_id, product_name, product_sku, product_barcode,
            unit, quantity, unit_price, price_type, discount, subtotal, total, notes
        ) VALUES (
            v_quote_id, v_prod.id, v_prod.name, v_prod.sku, v_prod.barcode,
            v_prod.unit, v_item.quantity, v_item_unit_price, v_item_price_type,
            v_item_discount, v_item_subtotal, v_item_total, v_item.notes
        );
    END LOOP;

    -- Cálculo do desconto geral do orçamento
    IF v_discount_type = 'percentage' THEN
        v_discount_amount := round((v_calculated_subtotal * (v_discount_value / 100.0)), 2);
    ELSE
        v_discount_amount := v_discount_value;
    END IF;

    IF v_discount_amount > v_calculated_subtotal THEN
        v_discount_amount := v_calculated_subtotal;
    END IF;

    v_calculated_total := round(v_calculated_subtotal - v_discount_amount, 2);
    IF v_calculated_total < 0 THEN v_calculated_total := 0; END IF;

    -- Atualiza cabeçalho do orçamento com os totais recalculados com precisão
    UPDATE public.quotes
    SET customer_id = v_customer_id,
        customer_name = v_customer_name,
        customer_document = v_customer_doc,
        customer_email = v_customer_email,
        customer_phone = v_customer_phone,
        status = v_status,
        subtotal = v_calculated_subtotal,
        discount_type = v_discount_type,
        discount_value = v_discount_value,
        discount_amount = v_discount_amount,
        total = v_calculated_total,
        notes = v_notes,
        valid_until = v_valid_until,
        updated_at = now()
    WHERE id = v_quote_id;

    -- Se houve transição de status na edição
    IF v_old_status IS NOT NULL AND v_old_status <> v_status THEN
        INSERT INTO public.quote_status_history (
            quote_id, company_id, previous_status, new_status, reason, user_id
        ) VALUES (
            v_quote_id, v_company_id, v_old_status, v_status, 'Atualização de status na edição do orçamento', v_user_id
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'quote_id', v_quote_id,
        'code', v_code,
        'status', v_status,
        'subtotal', v_calculated_subtotal,
        'discount_amount', v_discount_amount,
        'total', v_calculated_total
    );
END;
$$;

-- 8. Função RPC Atômica para Transição de Status de Orçamento
CREATE OR REPLACE FUNCTION public.update_quote_status(
    p_quote_id UUID,
    p_new_status VARCHAR,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_quote RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
    IF v_quote.id IS NULL THEN
        RAISE EXCEPTION 'Orçamento não encontrado.';
    END IF;

    IF NOT public.user_has_company_access(v_quote.company_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado para esta empresa.';
    END IF;

    IF v_quote.status = 'converted' THEN
        RAISE EXCEPTION 'Este orçamento já foi convertido em venda e seu status não pode ser alterado.';
    END IF;

    IF p_new_status NOT IN ('draft', 'sent', 'approved', 'rejected', 'expired', 'converted') THEN
        RAISE EXCEPTION 'Status inválido: %', p_new_status;
    END IF;

    UPDATE public.quotes
    SET status = p_new_status,
        converted_at = CASE WHEN p_new_status = 'converted' THEN now() ELSE converted_at END,
        updated_at = now()
    WHERE id = p_quote_id;

    INSERT INTO public.quote_status_history (
        quote_id, company_id, previous_status, new_status, reason, user_id
    ) VALUES (
        p_quote_id, v_quote.company_id, v_quote.status, p_new_status,
        COALESCE(p_reason, 'Transição de status do orçamento'), v_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'quote_id', p_quote_id,
        'previous_status', v_quote.status,
        'new_status', p_new_status
    );
END;
$$;

-- 9. Função RPC para Duplicar Orçamento como Novo Rascunho
CREATE OR REPLACE FUNCTION public.duplicate_quote(p_quote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_orig RECORD;
    v_new_quote_id UUID;
    v_quote_number BIGINT;
    v_new_code VARCHAR(50);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT * INTO v_orig FROM public.quotes WHERE id = p_quote_id;
    IF v_orig.id IS NULL THEN
        RAISE EXCEPTION 'Orçamento original não encontrado.';
    END IF;

    IF NOT public.user_has_company_access(v_orig.company_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado para esta empresa.';
    END IF;

    v_quote_number := nextval('public.quote_number_seq');
    v_new_code := 'ORC-' || lpad(v_quote_number::text, 6, '0');

    INSERT INTO public.quotes (
        company_id, branch_id, quote_number, code,
        customer_id, customer_name, customer_document, customer_email, customer_phone,
        user_id, status, subtotal, discount_type, discount_value, discount_amount, total,
        notes, valid_until
    ) VALUES (
        v_orig.company_id, v_orig.branch_id, v_quote_number, v_new_code,
        v_orig.customer_id, v_orig.customer_name, v_orig.customer_document, v_orig.customer_email, v_orig.customer_phone,
        v_user_id, 'draft', v_orig.subtotal, v_orig.discount_type, v_orig.discount_value, v_orig.discount_amount, v_orig.total,
        v_orig.notes, (CURRENT_DATE + INTERVAL '7 days')
    ) RETURNING id INTO v_new_quote_id;

    -- Copia os itens
    INSERT INTO public.quote_items (
        quote_id, product_id, product_name, product_sku, product_barcode,
        unit, quantity, unit_price, price_type, discount, subtotal, total, notes
    )
    SELECT
        v_new_quote_id, product_id, product_name, product_sku, product_barcode,
        unit, quantity, unit_price, price_type, discount, subtotal, total, notes
    FROM public.quote_items
    WHERE quote_id = p_quote_id;

    -- Histórico inicial
    INSERT INTO public.quote_status_history (
        quote_id, company_id, previous_status, new_status, reason, user_id
    ) VALUES (
        v_new_quote_id, v_orig.company_id, NULL, 'draft',
        'Duplicado a partir do orçamento ' || v_orig.code, v_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_quote_id', v_new_quote_id,
        'new_code', v_new_code
    );
END;
$$;

-- 10. Políticas RLS (Row Level Security) para Orçamentos
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_status_history ENABLE ROW LEVEL SECURITY;

-- Políticas para quotes
DROP POLICY IF EXISTS "quotes_select_policy" ON public.quotes;
CREATE POLICY "quotes_select_policy" ON public.quotes
    FOR SELECT TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "quotes_insert_policy" ON public.quotes;
CREATE POLICY "quotes_insert_policy" ON public.quotes
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "quotes_update_policy" ON public.quotes;
CREATE POLICY "quotes_update_policy" ON public.quotes
    FOR UPDATE TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "quotes_delete_policy" ON public.quotes;
CREATE POLICY "quotes_delete_policy" ON public.quotes
    FOR DELETE TO authenticated
    USING (public.user_is_company_admin(company_id));

-- Políticas para quote_items
DROP POLICY IF EXISTS "quote_items_select_policy" ON public.quote_items;
CREATE POLICY "quote_items_select_policy" ON public.quote_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = quote_items.quote_id
              AND public.user_has_company_access(q.company_id)
        )
    );

DROP POLICY IF EXISTS "quote_items_insert_policy" ON public.quote_items;
CREATE POLICY "quote_items_insert_policy" ON public.quote_items
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = quote_items.quote_id
              AND public.user_has_company_access(q.company_id)
        )
    );

DROP POLICY IF EXISTS "quote_items_update_policy" ON public.quote_items;
CREATE POLICY "quote_items_update_policy" ON public.quote_items
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = quote_items.quote_id
              AND public.user_has_company_access(q.company_id)
        )
    );

DROP POLICY IF EXISTS "quote_items_delete_policy" ON public.quote_items;
CREATE POLICY "quote_items_delete_policy" ON public.quote_items
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = quote_items.quote_id
              AND public.user_has_company_access(q.company_id)
        )
    );

-- Políticas para quote_status_history
DROP POLICY IF EXISTS "quote_history_select_policy" ON public.quote_status_history;
CREATE POLICY "quote_history_select_policy" ON public.quote_status_history
    FOR SELECT TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "quote_history_insert_policy" ON public.quote_status_history;
CREATE POLICY "quote_history_insert_policy" ON public.quote_status_history
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_company_access(company_id));
