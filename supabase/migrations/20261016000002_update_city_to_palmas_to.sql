-- ==============================================================================
-- MIGRATION: 20261016000002_update_city_to_palmas_to.sql
-- DESCRIÇÃO: Atualiza cidades e estados padrão de empresas e filiais para Palmas - TO
-- ==============================================================================

-- 1. Atualiza empresas com cidade São Paulo ou nula para Palmas - TO
UPDATE public.companies
SET city = 'Palmas',
    state = 'TO'
WHERE city ILIKE '%s_o paulo%' OR city IS NULL;

-- 2. Atualiza filiais com cidade São Paulo ou nula para Palmas - TO
UPDATE public.branches
SET city = 'Palmas',
    state = 'TO'
WHERE city ILIKE '%s_o paulo%' OR city IS NULL;
