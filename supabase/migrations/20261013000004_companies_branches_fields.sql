-- ==============================================================================
-- ETAPA 3: MIGRATION 04 — CAMPOS COMPLEMENTARES EM companies E branches
-- Adiciona campos de endereço, inscrição estadual e e-mail à tabela branches
-- Todos os comandos são incrementais e não destroem dados existentes
-- ==============================================================================

-- 1. Adiciona inscrição estadual às empresas (caso não exista)
ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS state_registration TEXT,
    ADD COLUMN IF NOT EXISTS zip_code           VARCHAR(10),
    ADD COLUMN IF NOT EXISTS street             TEXT,
    ADD COLUMN IF NOT EXISTS number             TEXT,
    ADD COLUMN IF NOT EXISTS complement         TEXT,
    ADD COLUMN IF NOT EXISTS neighborhood       TEXT,
    ADD COLUMN IF NOT EXISTS city               TEXT,
    ADD COLUMN IF NOT EXISTS state              VARCHAR(2);

-- 2. Adiciona campos faltantes na tabela branches
ALTER TABLE public.branches
    ADD COLUMN IF NOT EXISTS state_registration TEXT,
    ADD COLUMN IF NOT EXISTS email              TEXT;

-- 3. Comentários nos novos campos de companies
COMMENT ON COLUMN public.companies.state_registration IS 'Inscrição Estadual da empresa (opcional)';
COMMENT ON COLUMN public.companies.zip_code IS 'CEP da sede da empresa';
COMMENT ON COLUMN public.companies.street IS 'Logradouro da sede da empresa';
COMMENT ON COLUMN public.companies.number IS 'Número do endereço da sede';
COMMENT ON COLUMN public.companies.complement IS 'Complemento do endereço da sede (opcional)';
COMMENT ON COLUMN public.companies.neighborhood IS 'Bairro da sede da empresa';
COMMENT ON COLUMN public.companies.city IS 'Cidade da sede da empresa';
COMMENT ON COLUMN public.companies.state IS 'UF da sede da empresa (2 letras)';

-- 4. Comentários nos novos campos de branches
COMMENT ON COLUMN public.branches.state_registration IS 'Inscrição Estadual da unidade (opcional)';
COMMENT ON COLUMN public.branches.email IS 'E-mail de contato da unidade';

-- 5. Adiciona índices úteis para busca por cidade e estado
CREATE INDEX IF NOT EXISTS idx_companies_city  ON public.companies(city);
CREATE INDEX IF NOT EXISTS idx_companies_state ON public.companies(state);
CREATE INDEX IF NOT EXISTS idx_branches_city   ON public.branches(city);
CREATE INDEX IF NOT EXISTS idx_branches_state  ON public.branches(state);
CREATE INDEX IF NOT EXISTS idx_branches_status ON public.branches(status);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);
