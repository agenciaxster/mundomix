-- ==============================================================================
-- MIGRATION: 20261014000006_ensure_headquarter_branch.sql
-- DESCRIÇÃO: Garante que toda empresa possua obrigatoriamente sua unidade
--            MATRIZ cadastrada na tabela branches, e cria trigger automático.
-- ==============================================================================

-- 1. Insere filial Matriz para qualquer empresa cadastrada que não possua
INSERT INTO public.branches (
    company_id,
    name,
    code,
    cnpj,
    branch_type,
    status,
    zip_code,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    phone
)
SELECT
    c.id,
    c.trade_name || ' (Matriz)',
    'MATRIZ',
    c.cnpj,
    'matriz',
    'active',
    c.zip_code,
    c.street,
    c.number,
    c.complement,
    c.neighborhood,
    COALESCE(c.city, 'Palmas'),
    COALESCE(c.state, 'TO'),
    c.phone
FROM public.companies c
WHERE NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.company_id = c.id
      AND b.branch_type = 'matriz'
);

-- 2. Função e Trigger para criar automaticamente a unidade Matriz ao cadastrar empresa
CREATE OR REPLACE FUNCTION public.create_company_headquarter_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.branches (
        company_id,
        name,
        code,
        cnpj,
        branch_type,
        status,
        zip_code,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        phone
    ) VALUES (
        NEW.id,
        NEW.trade_name || ' (Matriz)',
        'MATRIZ',
        NEW.cnpj,
        'matriz',
        'active',
        NEW.zip_code,
        NEW.street,
        NEW.number,
        NEW.complement,
        NEW.neighborhood,
        COALESCE(NEW.city, 'Palmas'),
        COALESCE(NEW.state, 'TO'),
        NEW.phone
    )
    ON CONFLICT (company_id, code) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_company_headquarter ON public.companies;
CREATE TRIGGER trg_create_company_headquarter
    AFTER INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.create_company_headquarter_trigger();
