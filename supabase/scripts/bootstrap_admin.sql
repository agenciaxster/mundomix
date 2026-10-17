-- ==============================================================================
-- SCRIPT DE INICIALIZAÇÃO SEGURA DO PRIMEIRO ADMINISTRADOR (BOOTSTRAP)
-- Execute este script no SQL Editor do painel do Supabase
-- ==============================================================================

-- 1. Substitua pelo e-mail do usuário que você cadastrou no Supabase Auth:
DO $$
DECLARE
    v_user_email TEXT := 'admin@mundomix.com.br'; -- << ALTERE AQUI
    v_user_id UUID;
    v_user_name TEXT;
    v_company_id UUID;
    v_branch_id UUID;
BEGIN
    -- Busca o ID do usuário criado em auth.users
    SELECT id, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
    INTO v_user_id, v_user_name
    FROM auth.users
    WHERE email = v_user_email;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário % não encontrado em auth.users. Crie-o primeiro via painel Authentication → Users!', v_user_email;
    END IF;

    -- Garante que o perfil existe em public.profiles
    -- (caso o trigger handle_new_user não tenha criado, ex: usuário criado antes das migrations)
    INSERT INTO public.profiles (id, full_name, email, status)
    VALUES (v_user_id, v_user_name, v_user_email, 'active')
    ON CONFLICT (id) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            email     = EXCLUDED.email,
            status    = 'active';

    RAISE NOTICE 'Perfil garantido para: % (%)', v_user_name, v_user_email;

    -- Cria ou obtém a empresa inicial
    INSERT INTO public.companies (
        legal_name,
        trade_name,
        cnpj,
        email,
        phone,
        status
    )
    VALUES (
        'MundoMix Comércio e Distribuição Ltda',
        'MundoMix Matriz',
        '12.345.678/0001-90',
        'contato@mundomix.com.br',
        '(11) 3000-0000',
        'active'
    )
    ON CONFLICT (cnpj) DO UPDATE
        SET trade_name = EXCLUDED.trade_name
    RETURNING id INTO v_company_id;

    RAISE NOTICE 'Empresa criada/atualizada. ID: %', v_company_id;

    -- Cria ou obtém a filial matriz
    INSERT INTO public.branches (
        company_id,
        name,
        code,
        branch_type,
        city,
        state,
        status
    )
    VALUES (
        v_company_id,
        'Matriz Principal',
        'MTZ001',
        'matriz',
        'Palmas',
        'TO',
        'active'
    )
    ON CONFLICT (company_id, code) DO UPDATE
        SET name = EXCLUDED.name
    RETURNING id INTO v_branch_id;

    RAISE NOTICE 'Filial criada/atualizada. ID: %', v_branch_id;

    -- Concede acesso de owner à empresa
    INSERT INTO public.user_company_access (user_id, company_id, role)
    VALUES (v_user_id, v_company_id, 'owner')
    ON CONFLICT (user_id, company_id) DO UPDATE
        SET role = 'owner';

    RAISE NOTICE 'Acesso à empresa concedido com papel: owner';

    -- Concede acesso à filial matriz
    INSERT INTO public.user_branch_access (user_id, branch_id)
    VALUES (v_user_id, v_branch_id)
    ON CONFLICT (user_id, branch_id) DO NOTHING;

    RAISE NOTICE 'Acesso à filial matriz concedido.';

    RAISE NOTICE '=== BOOTSTRAP CONCLUÍDO COM SUCESSO ===';
    RAISE NOTICE 'Usuário: % | Empresa ID: % | Filial ID: %', v_user_email, v_company_id, v_branch_id;
END;
$$;
