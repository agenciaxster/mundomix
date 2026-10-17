-- ==============================================================================
-- MIGRATION: 20261015000001_product_max_discount.sql
-- DESCRIÇÃO: Adiciona margem máxima de desconto do produto para vendedores
-- ==============================================================================

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS max_discount_percentage NUMERIC(5, 2) DEFAULT 0 CHECK (max_discount_percentage >= 0 AND max_discount_percentage <= 100);

COMMENT ON COLUMN public.products.max_discount_percentage IS 'Percentual máximo de desconto autorizado ao vendedor no PDV / Orçamento';
