-- ==============================================================================
-- ETAPA 2: MIGRATION 02 - CRIAÇÃO SEGURA DO PERFIL (TRIGGER EM AUTH.USERS)
-- Garante criação idempotente do perfil sem concessão automática de privilégios
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_full_name TEXT;
    v_phone TEXT;
BEGIN
    -- Sanitiza os metadados brutos enviados no cadastro
    v_full_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), '');
    v_phone := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');

    -- Se não houver nome informado, utiliza a parte local do e-mail
    IF v_full_name IS NULL THEN
        v_full_name := split_part(NEW.email, '@', 1);
    END IF;

    -- Criação idempotente do perfil.
    -- ATENÇÃO DE SEGURANÇA:
    -- 1. Nenhum papel (role) administrativo é atribuído aqui.
    -- 2. Nenhum vínculo com empresa ou filial é criado automaticamente.
    -- 3. A autorização em empresas e filiais deve ser atribuída exclusivamente por um gestor autorizado.
    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        phone,
        status,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        v_full_name,
        NEW.email,
        v_phone,
        'active',
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = CASE
            WHEN profiles.full_name IS NULL OR profiles.full_name = '' THEN EXCLUDED.full_name
            ELSE profiles.full_name
        END,
        updated_at = now();

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Registra o erro no log do servidor PostgreSQL sem travar o cadastro no GoTrue
        RAISE WARNING 'Falha ao sincronizar profile para user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Registra o trigger em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
