-- ==============================================================================
-- MIGRATION: 20261014000005_stock_control_schema.sql
-- DESCRIÇÃO: ETAPA 6 — Controle de Estoque por Filial, Entradas, Saídas,
--            Ajustes e Transferências entre Unidades.
-- ==============================================================================

-- 1. Garante existência da tabela de produtos (compatibilidade Etapas 5 e 6)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    category VARCHAR(100),
    unit VARCHAR(20) NOT NULL DEFAULT 'UN',
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    sale_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (sale_price >= 0),
    min_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (min_stock >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_company_sku UNIQUE (company_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_company ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

-- 2. Tabela de Estoque por Filial (branch_stock)
CREATE TABLE IF NOT EXISTS public.branch_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (quantity >= 0),
    reserved_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (reserved_quantity >= 0),
    min_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (min_stock >= 0),
    last_movement_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_branch_product_stock UNIQUE (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_stock_company ON public.branch_stock(company_id);
CREATE INDEX IF NOT EXISTS idx_branch_stock_branch ON public.branch_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_stock_product ON public.branch_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_branch_stock_low_stock ON public.branch_stock(branch_id, quantity, min_stock);

-- 3. Histórico Persistente de Movimentações (stock_movements)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    movement_type VARCHAR(30) NOT NULL CHECK (
        movement_type IN ('entry', 'exit', 'adjustment', 'transfer_out', 'transfer_in', 'reversal')
    ),
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    balance_before NUMERIC(12, 3) NOT NULL,
    balance_after NUMERIC(12, 3) NOT NULL,
    reason VARCHAR(150) NOT NULL,
    notes TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_branch ON public.stock_movements(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON public.stock_movements(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON public.stock_movements(reference_id, reference_type);

-- 4. Trigger de Imutabilidade das Movimentações (Histórico Append-Only)
CREATE OR REPLACE FUNCTION public.prevent_stock_movement_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Movimentações de estoque confirmadas são imutáveis e não podem ser editadas ou excluídas. Realize um ajuste ou estorno.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_stock_movement_mutation ON public.stock_movements;
CREATE TRIGGER trg_prevent_stock_movement_mutation
    BEFORE UPDATE OR DELETE ON public.stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_stock_movement_mutation();

-- 5. Tabelas de Transferências entre Filiais (stock_transfers e stock_transfer_items)
CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    origin_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    destination_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'in_transit', 'received', 'cancelled')
    ),
    notes TEXT,
    shipped_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    shipped_at TIMESTAMPTZ,
    received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_company_transfer_code UNIQUE (company_id, code),
    CONSTRAINT chk_transfer_branches_different CHECK (origin_branch_id != destination_branch_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_company ON public.stock_transfers(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_origin ON public.stock_transfers(origin_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_destination ON public.stock_transfers(destination_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(status);

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity_sent NUMERIC(12, 3) NOT NULL CHECK (quantity_sent > 0),
    quantity_received NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (quantity_received >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_transfer_item_product UNIQUE (transfer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON public.stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_product ON public.stock_transfer_items(product_id);

-- 6. Funções RPC Atômicas e Concorrência-Seguras (PostgreSQL)

-- 6.1 Execução de Movimentação de Estoque (Entrada, Saída, Ajuste)
CREATE OR REPLACE FUNCTION public.execute_stock_movement(
    p_company_id UUID,
    p_branch_id UUID,
    p_product_id UUID,
    p_movement_type VARCHAR,
    p_quantity NUMERIC,
    p_reason VARCHAR,
    p_notes TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_reference_type VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_branch_company UUID;
    v_product_company UUID;
    v_current_stock NUMERIC(12, 3);
    v_new_stock NUMERIC(12, 3);
    v_product_min_stock NUMERIC(12, 3);
    v_movement_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Validação de quantidade positiva
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'A quantidade movimentada deve ser maior que zero.';
    END IF;

    -- Validação de escopo da filial
    SELECT company_id INTO v_branch_company FROM public.branches WHERE id = p_branch_id;
    IF v_branch_company IS NULL OR v_branch_company != p_company_id THEN
        RAISE EXCEPTION 'A filial indicada não pertence à empresa selecionada.';
    END IF;

    -- Validação de escopo do produto
    SELECT company_id, min_stock INTO v_product_company, v_product_min_stock FROM public.products WHERE id = p_product_id;
    IF v_product_company IS NULL OR v_product_company != p_company_id THEN
        RAISE EXCEPTION 'O produto selecionado não pertence à empresa.';
    END IF;

    -- Validação de acesso do usuário à filial
    IF NOT (public.user_is_company_admin(p_company_id) OR public.user_has_branch_access(p_branch_id)) THEN
        RAISE EXCEPTION 'Usuário não possui autorização de acesso para operar nesta filial.';
    END IF;

    -- Garante que o registro de estoque existe e bloqueia a linha (FOR UPDATE) para evitar race condition
    INSERT INTO public.branch_stock (company_id, branch_id, product_id, quantity, min_stock, updated_at)
    VALUES (p_company_id, p_branch_id, p_product_id, 0.000, COALESCE(v_product_min_stock, 0.000), now())
    ON CONFLICT (branch_id, product_id) DO NOTHING;

    SELECT quantity INTO v_current_stock
    FROM public.branch_stock
    WHERE branch_id = p_branch_id AND product_id = p_product_id
    FOR UPDATE;

    -- Cálculo do novo saldo de acordo com o tipo
    IF p_movement_type IN ('entry', 'transfer_in') THEN
        v_new_stock := v_current_stock + p_quantity;
    ELSIF p_movement_type IN ('exit', 'transfer_out') THEN
        IF v_current_stock < p_quantity THEN
            RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Solicitado: %', v_current_stock, p_quantity;
        END IF;
        v_new_stock := v_current_stock - p_quantity;
    ELSIF p_movement_type = 'adjustment' THEN
        -- Ajuste pode ser direto para um novo saldo ou incremento/decremento.
        -- Aqui p_quantity representa o delta ou o ajuste efetuado
        v_new_stock := v_current_stock + p_quantity;
        IF v_new_stock < 0 THEN
            RAISE EXCEPTION 'O ajuste resultaria em saldo negativo (%). Operação abortada.', v_new_stock;
        END IF;
    ELSIF p_movement_type = 'reversal' THEN
        v_new_stock := v_current_stock + p_quantity;
    ELSE
        RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_movement_type;
    END IF;

    -- Atualiza o saldo e data da última movimentação
    UPDATE public.branch_stock
    SET quantity = v_new_stock,
        last_movement_at = now(),
        updated_at = now()
    WHERE branch_id = p_branch_id AND product_id = p_product_id;

    -- Registra no histórico persistente imutável
    INSERT INTO public.stock_movements (
        company_id,
        branch_id,
        product_id,
        movement_type,
        quantity,
        balance_before,
        balance_after,
        reason,
        notes,
        user_id,
        reference_id,
        reference_type
    ) VALUES (
        p_company_id,
        p_branch_id,
        p_product_id,
        p_movement_type,
        ABS(p_quantity),
        v_current_stock,
        v_new_stock,
        p_reason,
        p_notes,
        v_user_id,
        p_reference_id,
        p_reference_type
    ) RETURNING id INTO v_movement_id;

    RETURN jsonb_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'balance_before', v_current_stock,
        'balance_after', v_new_stock
    );
END;
$$;

-- 6.2 Despacho de Transferência (ship_stock_transfer)
CREATE OR REPLACE FUNCTION public.ship_stock_transfer(
    p_transfer_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_transfer RECORD;
    v_item RECORD;
    v_current_stock NUMERIC(12, 3);
    v_new_stock NUMERIC(12, 3);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT * INTO v_transfer FROM public.stock_transfers WHERE id = p_transfer_id FOR UPDATE;
    IF v_transfer.id IS NULL THEN
        RAISE EXCEPTION 'Transferência não encontrada.';
    END IF;

    IF v_transfer.status != 'draft' THEN
        RAISE EXCEPTION 'Apenas transferências em rascunho podem ser enviadas. Status atual: %', v_transfer.status;
    END IF;

    -- Validação de acesso à filial de origem
    IF NOT (public.user_is_company_admin(v_transfer.company_id) OR public.user_has_branch_access(v_transfer.origin_branch_id)) THEN
        RAISE EXCEPTION 'Usuário não possui permissão para expedir transferências desta filial.';
    END IF;

    -- Valida e debita o saldo na filial de origem para cada item
    FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id FOR UPDATE LOOP
        -- Bloqueia a linha de estoque da origem
        SELECT quantity INTO v_current_stock
        FROM public.branch_stock
        WHERE branch_id = v_transfer.origin_branch_id AND product_id = v_item.product_id
        FOR UPDATE;

        IF v_current_stock IS NULL OR v_current_stock < v_item.quantity_sent THEN
            RAISE EXCEPTION 'Saldo insuficiente na filial de origem para o produto %. Disponível: %, Solicitado: %',
                v_item.product_id, COALESCE(v_current_stock, 0), v_item.quantity_sent;
        END IF;

        v_new_stock := v_current_stock - v_item.quantity_sent;

        UPDATE public.branch_stock
        SET quantity = v_new_stock,
            last_movement_at = now(),
            updated_at = now()
        WHERE branch_id = v_transfer.origin_branch_id AND product_id = v_item.product_id;

        -- Registra movimentação de saída por transferência
        INSERT INTO public.stock_movements (
            company_id,
            branch_id,
            product_id,
            movement_type,
            quantity,
            balance_before,
            balance_after,
            reason,
            notes,
            user_id,
            reference_id,
            reference_type
        ) VALUES (
            v_transfer.company_id,
            v_transfer.origin_branch_id,
            v_item.product_id,
            'transfer_out',
            v_item.quantity_sent,
            v_current_stock,
            v_new_stock,
            'Expedição de transferência ' || v_transfer.code,
            COALESCE(p_notes, v_transfer.notes),
            v_user_id,
            v_transfer.id,
            'stock_transfers'
        );
    END LOOP;

    -- Atualiza status da transferência para em trânsito
    UPDATE public.stock_transfers
    SET status = 'in_transit',
        shipped_by = v_user_id,
        shipped_at = now(),
        updated_at = now(),
        notes = COALESCE(p_notes, notes)
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object('success', true, 'status', 'in_transit');
END;
$$;

-- 6.3 Recebimento de Transferência (receive_stock_transfer)
CREATE OR REPLACE FUNCTION public.receive_stock_transfer(
    p_transfer_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_transfer RECORD;
    v_item RECORD;
    v_current_stock NUMERIC(12, 3);
    v_new_stock NUMERIC(12, 3);
    v_prod_min_stock NUMERIC(12, 3);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT * INTO v_transfer FROM public.stock_transfers WHERE id = p_transfer_id FOR UPDATE;
    IF v_transfer.id IS NULL THEN
        RAISE EXCEPTION 'Transferência não encontrada.';
    END IF;

    IF v_transfer.status != 'in_transit' THEN
        RAISE EXCEPTION 'Apenas transferências em trânsito podem ser recebidas. Status atual: %', v_transfer.status;
    END IF;

    -- Validação de acesso à filial de destino
    IF NOT (public.user_is_company_admin(v_transfer.company_id) OR public.user_has_branch_access(v_transfer.destination_branch_id)) THEN
        RAISE EXCEPTION 'Usuário não possui permissão para receber transferências nesta filial.';
    END IF;

    -- Credita no destino cada item
    FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id FOR UPDATE LOOP
        SELECT min_stock INTO v_prod_min_stock FROM public.products WHERE id = v_item.product_id;

        INSERT INTO public.branch_stock (company_id, branch_id, product_id, quantity, min_stock, updated_at)
        VALUES (v_transfer.company_id, v_transfer.destination_branch_id, v_item.product_id, 0.000, COALESCE(v_prod_min_stock, 0.000), now())
        ON CONFLICT (branch_id, product_id) DO NOTHING;

        SELECT quantity INTO v_current_stock
        FROM public.branch_stock
        WHERE branch_id = v_transfer.destination_branch_id AND product_id = v_item.product_id
        FOR UPDATE;

        v_new_stock := v_current_stock + v_item.quantity_sent;

        UPDATE public.branch_stock
        SET quantity = v_new_stock,
            last_movement_at = now(),
            updated_at = now()
        WHERE branch_id = v_transfer.destination_branch_id AND product_id = v_item.product_id;

        UPDATE public.stock_transfer_items
        SET quantity_received = v_item.quantity_sent
        WHERE id = v_item.id;

        -- Registra movimentação de entrada por transferência
        INSERT INTO public.stock_movements (
            company_id,
            branch_id,
            product_id,
            movement_type,
            quantity,
            balance_before,
            balance_after,
            reason,
            notes,
            user_id,
            reference_id,
            reference_type
        ) VALUES (
            v_transfer.company_id,
            v_transfer.destination_branch_id,
            v_item.product_id,
            'transfer_in',
            v_item.quantity_sent,
            v_current_stock,
            v_new_stock,
            'Recebimento de transferência ' || v_transfer.code,
            COALESCE(p_notes, v_transfer.notes),
            v_user_id,
            v_transfer.id,
            'stock_transfers'
        );
    END LOOP;

    -- Atualiza status da transferência para recebida
    UPDATE public.stock_transfers
    SET status = 'received',
        received_by = v_user_id,
        received_at = now(),
        updated_at = now(),
        notes = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || E'\n' || p_notes, p_notes) ELSE notes END
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object('success', true, 'status', 'received');
END;
$$;

-- 6.4 Cancelamento de Transferência (cancel_stock_transfer)
CREATE OR REPLACE FUNCTION public.cancel_stock_transfer(
    p_transfer_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_transfer RECORD;
    v_item RECORD;
    v_current_stock NUMERIC(12, 3);
    v_new_stock NUMERIC(12, 3);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT * INTO v_transfer FROM public.stock_transfers WHERE id = p_transfer_id FOR UPDATE;
    IF v_transfer.id IS NULL THEN
        RAISE EXCEPTION 'Transferência não encontrada.';
    END IF;

    IF v_transfer.status = 'received' THEN
        RAISE EXCEPTION 'Transferências já recebidas não podem ser canceladas. Realize uma transferência de retorno.';
    END IF;

    IF v_transfer.status = 'cancelled' THEN
        RAISE EXCEPTION 'Esta transferência já está cancelada.';
    END IF;

    -- Validação de acesso (admin ou acesso à filial de origem)
    IF NOT (public.user_is_company_admin(v_transfer.company_id) OR public.user_has_branch_access(v_transfer.origin_branch_id)) THEN
        RAISE EXCEPTION 'Usuário não possui autorização para cancelar esta transferência.';
    END IF;

    -- Se já estava em trânsito, estorna o estoque para a origem
    IF v_transfer.status = 'in_transit' THEN
        FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id FOR UPDATE LOOP
            SELECT quantity INTO v_current_stock
            FROM public.branch_stock
            WHERE branch_id = v_transfer.origin_branch_id AND product_id = v_item.product_id
            FOR UPDATE;

            v_new_stock := v_current_stock + v_item.quantity_sent;

            UPDATE public.branch_stock
            SET quantity = v_new_stock,
                last_movement_at = now(),
                updated_at = now()
            WHERE branch_id = v_transfer.origin_branch_id AND product_id = v_item.product_id;

            -- Registra movimentação de estorno
            INSERT INTO public.stock_movements (
                company_id,
                branch_id,
                product_id,
                movement_type,
                quantity,
                balance_before,
                balance_after,
                reason,
                notes,
                user_id,
                reference_id,
                reference_type
            ) VALUES (
                v_transfer.company_id,
                v_transfer.origin_branch_id,
                v_item.product_id,
                'reversal',
                v_item.quantity_sent,
                v_current_stock,
                v_new_stock,
                'Estorno por cancelamento de transferência ' || v_transfer.code,
                COALESCE(p_notes, 'Cancelamento da transferência'),
                v_user_id,
                v_transfer.id,
                'stock_transfers'
            );
        END LOOP;
    END IF;

    UPDATE public.stock_transfers
    SET status = 'cancelled',
        cancelled_by = v_user_id,
        cancelled_at = now(),
        updated_at = now(),
        notes = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || E'\n' || p_notes, p_notes) ELSE notes END
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

-- 7. Habilitação de RLS e Políticas de Segurança

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- 7.1 Políticas para Products
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
CREATE POLICY "products_select_policy" ON public.products
    FOR SELECT TO authenticated
    USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
CREATE POLICY "products_insert_policy" ON public.products
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_is_company_admin(company_id)
        OR public.user_has_company_access(company_id)
    );

DROP POLICY IF EXISTS "products_update_policy" ON public.products;
CREATE POLICY "products_update_policy" ON public.products
    FOR UPDATE TO authenticated
    USING (
        public.user_is_company_admin(company_id)
        OR public.user_has_company_access(company_id)
    );

-- 7.2 Políticas para branch_stock
DROP POLICY IF EXISTS "branch_stock_select_policy" ON public.branch_stock;
CREATE POLICY "branch_stock_select_policy" ON public.branch_stock
    FOR SELECT TO authenticated
    USING (
        public.user_is_company_admin(company_id)
        OR public.user_has_branch_access(branch_id)
    );

DROP POLICY IF EXISTS "branch_stock_insert_policy" ON public.branch_stock;
CREATE POLICY "branch_stock_insert_policy" ON public.branch_stock
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_is_company_admin(company_id)
        OR public.user_has_branch_access(branch_id)
    );

DROP POLICY IF EXISTS "branch_stock_update_policy" ON public.branch_stock;
CREATE POLICY "branch_stock_update_policy" ON public.branch_stock
    FOR UPDATE TO authenticated
    USING (
        public.user_is_company_admin(company_id)
        OR public.user_has_branch_access(branch_id)
    );

-- 7.3 Políticas para stock_movements
DROP POLICY IF EXISTS "stock_movements_select_policy" ON public.stock_movements;
CREATE POLICY "stock_movements_select_policy" ON public.stock_movements
    FOR SELECT TO authenticated
    USING (
        public.user_is_company_admin(company_id)
        OR public.user_has_branch_access(branch_id)
    );

DROP POLICY IF EXISTS "stock_movements_insert_policy" ON public.stock_movements;
CREATE POLICY "stock_movements_insert_policy" ON public.stock_movements
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_is_company_admin(company_id)
        OR public.user_has_branch_access(branch_id)
    );

-- 7.4 Políticas para stock_transfers
DROP POLICY IF EXISTS "stock_transfers_select_policy" ON public.stock_transfers;
CREATE POLICY "stock_transfers_select_policy" ON public.stock_transfers
    FOR SELECT TO authenticated
    USING (
        public.user_is_company_admin(company_id)
        OR public.user_has_branch_access(origin_branch_id)
        OR public.user_has_branch_access(destination_branch_id)
    );

DROP POLICY IF EXISTS "stock_transfers_insert_policy" ON public.stock_transfers;
CREATE POLICY "stock_transfers_insert_policy" ON public.stock_transfers
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_is_company_admin(company_id)
        OR public.user_has_branch_access(origin_branch_id)
    );

DROP POLICY IF EXISTS "stock_transfers_update_policy" ON public.stock_transfers;
CREATE POLICY "stock_transfers_update_policy" ON public.stock_transfers
    FOR UPDATE TO authenticated
    USING (
        public.user_is_company_admin(company_id)
        OR public.user_has_branch_access(origin_branch_id)
        OR public.user_has_branch_access(destination_branch_id)
    );

-- 7.5 Políticas para stock_transfer_items
DROP POLICY IF EXISTS "stock_transfer_items_select_policy" ON public.stock_transfer_items;
CREATE POLICY "stock_transfer_items_select_policy" ON public.stock_transfer_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.stock_transfers t
            WHERE t.id = stock_transfer_items.transfer_id
              AND (
                  public.user_is_company_admin(t.company_id)
                  OR public.user_has_branch_access(t.origin_branch_id)
                  OR public.user_has_branch_access(t.destination_branch_id)
              )
        )
    );

DROP POLICY IF EXISTS "stock_transfer_items_insert_policy" ON public.stock_transfer_items;
CREATE POLICY "stock_transfer_items_insert_policy" ON public.stock_transfer_items
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.stock_transfers t
            WHERE t.id = stock_transfer_items.transfer_id
              AND (
                  public.user_is_company_admin(t.company_id)
                  OR public.user_has_branch_access(t.origin_branch_id)
              )
        )
    );

DROP POLICY IF EXISTS "stock_transfer_items_update_policy" ON public.stock_transfer_items;
CREATE POLICY "stock_transfer_items_update_policy" ON public.stock_transfer_items
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.stock_transfers t
            WHERE t.id = stock_transfer_items.transfer_id
              AND (
                  public.user_is_company_admin(t.company_id)
                  OR public.user_has_branch_access(t.origin_branch_id)
                  OR public.user_has_branch_access(t.destination_branch_id)
              )
        )
    );
