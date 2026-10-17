-- ==============================================================================
-- MIGRATION: 20261016000006_financial_delete_policies_and_procedures.sql
-- DESCRIÇÃO: Habilita políticas de exclusão (DELETE) no Supabase RLS e procedures
--            atômicas de exclusão para Contas a Pagar e Contas a Receber,
--            garantindo que registros excluídos sumam do banco e do Dashboard.
-- ==============================================================================

-- 1. POLÍTICAS DE DELETE PARA CONTAS A PAGAR (accounts_payable e parcelas)
DROP POLICY IF EXISTS "accounts_payable_delete_policy" ON public.accounts_payable;
CREATE POLICY "accounts_payable_delete_policy" ON public.accounts_payable
    FOR DELETE TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
        OR public.user_has_company_access(company_id)
    );

DROP POLICY IF EXISTS "accounts_payable_inst_delete_policy" ON public.accounts_payable_installments;
CREATE POLICY "accounts_payable_inst_delete_policy" ON public.accounts_payable_installments
    FOR DELETE TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
        OR public.user_has_company_access(company_id)
    );

-- 2. POLÍTICAS DE DELETE PARA CONTAS A RECEBER (accounts_receivable e parcelas)
DROP POLICY IF EXISTS "accounts_receivable_delete_policy" ON public.accounts_receivable;
CREATE POLICY "accounts_receivable_delete_policy" ON public.accounts_receivable
    FOR DELETE TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
        OR public.user_has_company_access(company_id)
    );

DROP POLICY IF EXISTS "accounts_receivable_inst_delete_policy" ON public.accounts_receivable_installments;
CREATE POLICY "accounts_receivable_inst_delete_policy" ON public.accounts_receivable_installments
    FOR DELETE TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
        OR public.user_has_company_access(company_id)
    );

-- 3. POLÍTICA DE DELETE PARA CATEGORIAS FINANCEIRAS
DROP POLICY IF EXISTS "financial_categories_delete_policy" ON public.financial_categories;
CREATE POLICY "financial_categories_delete_policy" ON public.financial_categories
    FOR DELETE TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.user_company_access
            WHERE user_id = auth.uid() AND status = 'active'
        )
        OR public.user_has_company_access(company_id)
    );

-- 4. PROCEDURE ATÔMICA PARA EXCLUSÃO DE CONTA A PAGAR (delete_accounts_payable)
CREATE OR REPLACE FUNCTION public.delete_accounts_payable(
    p_company_id UUID,
    p_payable_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_access BOOLEAN := FALSE;
    v_payments_count INT := 0;
    v_payments_sum NUMERIC(12, 2) := 0;
BEGIN
    -- Validação de acesso à empresa
    SELECT EXISTS (
        SELECT 1 FROM public.user_company_access
        WHERE user_id = auth.uid() AND company_id = p_company_id AND status = 'active'
    ) INTO v_has_access;

    IF NOT v_has_access AND NOT public.user_has_company_access(p_company_id) THEN
        RAISE EXCEPTION 'Acesso negado: usuário não possui permissão na empresa informada.';
    END IF;

    -- Verifica se conta existe
    IF NOT EXISTS (
        SELECT 1 FROM public.accounts_payable
        WHERE id = p_payable_id AND company_id = p_company_id
    ) THEN
        RAISE EXCEPTION 'Conta a pagar não encontrada.';
    END IF;

    -- Verifica se existem pagamentos registrados
    SELECT COUNT(*), COALESCE(SUM(amount_paid), 0)
    INTO v_payments_count, v_payments_sum
    FROM public.payable_payments
    WHERE payable_id = p_payable_id AND company_id = p_company_id;

    IF v_payments_count > 0 THEN
        RAISE EXCEPTION 'Não é possível excluir esta conta a pagar pois existem % pagamento(s) realizados (total R$ %). Estorne os pagamentos antes de excluir.', v_payments_count, v_payments_sum;
    END IF;

    -- Remove as parcelas
    DELETE FROM public.accounts_payable_installments
    WHERE payable_id = p_payable_id AND company_id = p_company_id;

    -- Remove a conta a pagar principal
    DELETE FROM public.accounts_payable
    WHERE id = p_payable_id AND company_id = p_company_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Conta a pagar e parcelas excluídas com sucesso do banco de dados.'
    );
END;
$$;

-- 5. PROCEDURE ATÔMICA PARA EXCLUSÃO DE CONTA A RECEBER (delete_accounts_receivable)
CREATE OR REPLACE FUNCTION public.delete_accounts_receivable(
    p_company_id UUID,
    p_receivable_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_access BOOLEAN := FALSE;
    v_payments_count INT := 0;
    v_payments_sum NUMERIC(12, 2) := 0;
BEGIN
    -- Validação de acesso à empresa
    SELECT EXISTS (
        SELECT 1 FROM public.user_company_access
        WHERE user_id = auth.uid() AND company_id = p_company_id AND status = 'active'
    ) INTO v_has_access;

    IF NOT v_has_access AND NOT public.user_has_company_access(p_company_id) THEN
        RAISE EXCEPTION 'Acesso negado: usuário não possui permissão na empresa informada.';
    END IF;

    -- Verifica se título existe
    IF NOT EXISTS (
        SELECT 1 FROM public.accounts_receivable
        WHERE id = p_receivable_id AND company_id = p_company_id
    ) THEN
        RAISE EXCEPTION 'Conta a receber não encontrada.';
    END IF;

    -- Verifica se existem recebimentos registrados
    SELECT COUNT(*), COALESCE(SUM(amount_paid), 0)
    INTO v_payments_count, v_payments_sum
    FROM public.receivable_payments
    WHERE receivable_id = p_receivable_id AND company_id = p_company_id;

    IF v_payments_count > 0 THEN
        RAISE EXCEPTION 'Não é possível excluir este título a receber pois existem % recebimento(s) registrados (total R$ %). Estorne os recebimentos antes de excluir.', v_payments_count, v_payments_sum;
    END IF;

    -- Remove as parcelas
    DELETE FROM public.accounts_receivable_installments
    WHERE receivable_id = p_receivable_id AND company_id = p_company_id;

    -- Remove o título a receber principal
    DELETE FROM public.accounts_receivable
    WHERE id = p_receivable_id AND company_id = p_company_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Conta a receber e parcelas excluídas com sucesso do banco de dados.'
    );
END;
$$;

-- 6. Notifica o PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
