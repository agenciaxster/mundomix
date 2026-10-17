# DOCUMENTAÇÃO TÉCNICA — ETAPA 8: CONSULTA DE PRODUTOS E ORÇAMENTOS PELO VENDEDOR

Este documento detalha a implementação completa da **Etapa 8**, responsável pela consulta de catálogo de produtos com saldo isolado por filial, suporte a leitores de código de barras USB em modo teclado, precificação diferenciada (Varejo vs Atacado) e gestão de orçamentos comerciais com ciclo de vida, histórico de auditoria e recálculo seguro no backend.

---

## 1. Visão Geral da Arquitetura

O módulo atende diretamente aos requisitos operacionais do vendedor no balcão e no atendimento comercial:

1. **Terminal de Consulta de Produtos (`/cadastros/produtos`)**:
   - Pesquisa ágil e instantânea por Nome, SKU, Código de Barras (EAN), Categoria e Marca.
   - **Isolamento Estrito de Estoque por Filial**: O saldo apresentado consulta a tabela `branch_stock` com filtro exclusivo na filial ativa (`activeBranch.id`). Saldo de outra unidade operacional nunca é apresentado como saldo da unidade atual.
   - **Leitor de Código de Barras USB**: Campo de escaneamento rápido compatível com qualquer pistola ou leitor óptico USB emulando teclado.
   - **Preço de Varejo vs Atacado**: Exibição clara do preço unitário de varejo e do preço de atacado com sua quantidade mínima ativadora.
   - Ação rápida para iniciar cotação a partir do item.

2. **Criação e Edição de Orçamentos (`/comercial/orcamentos/novo` e `/comercial/orcamentos/:id/editar`)**:
   - Associação com Filial e Vendedor responsável (`auth.uid()`).
   - Identificação do Cliente: cliente selecionado da base (com limite de crédito e status em tempo real) ou cliente avulso.
   - Carrinho dinâmico de produtos com adição via leitor USB ou catálogo.
   - **Regra Automática de Atacado**: Quando a quantidade acumulada do mesmo item no orçamento atinge o valor de `wholesale_min_qty`, o sistema altera o preço unitário para `wholesale_price` e marca a regra como `Atacado`. Se a quantidade diminuir para baixo do limite, retorna automaticamente para `Varejo`.
   - Desconto por item e desconto geral (em percentual `%` ou valor monetário `R$`).
   - Recálculo seguro no backend: totais enviados pelo navegador são conferidos e recalculados no banco de dados através da função RPC `save_quote`.
   - O orçamento **não** baixa e **não** reserva estoque nesta etapa.

3. **Gestão de Ciclo de Vida e Histórico (`/comercial/orcamentos`)**:
   - Painel com KPIs em tempo real (Total de Orçamentos, Rascunhos, Enviados, Aprovados, Convertidos, Taxa de Conversão e Volume Negociado).
   - Filtros por Filial, Status, Período de emissão e busca textual.
   - Modal completo de detalhes com impressão de proposta comercial.
   - **Linha do tempo de auditoria**: Tabela `quote_status_history` rastreia quem alterou o status, quando e a justificativa.
   - **Imutabilidade de Orçamentos Convertidos**: Triggers no banco de dados barram qualquer `UPDATE` ou `DELETE` em orçamentos ou itens de orçamentos que já estejam com status `converted`.
   - Duplicação de orçamento: Permite duplicar qualquer orçamento existente como um novo rascunho com nova numeração.

---

## 2. Estrutura do Banco de Dados

### 2.1 Ampliação da Tabela `public.products`
```sql
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(12, 2) CHECK (wholesale_price >= 0),
    ADD COLUMN IF NOT EXISTS wholesale_min_qty NUMERIC(12, 3) DEFAULT 0 CHECK (wholesale_min_qty >= 0);
```

### 2.2 Tabela `public.quotes`
Armazena o cabeçalho do orçamento comercial:
- `id` (UUID, PK)
- `company_id` (UUID, FK -> companies)
- `branch_id` (UUID, FK -> branches)
- `quote_number` (BIGINT, via sequence `quote_number_seq`)
- `code` (VARCHAR(50), ex: `ORC-001001`, único por empresa)
- `customer_id` (UUID, FK -> customers, opcional)
- `customer_name`, `customer_document`, `customer_email`, `customer_phone` (Snapshots)
- `user_id` (UUID, FK -> auth.users, vendedor responsável)
- `status` (`draft`, `sent`, `approved`, `rejected`, `expired`, `converted`)
- `subtotal` (NUMERIC(12, 2))
- `discount_type` (`percentage` ou `value`)
- `discount_value` (NUMERIC(12, 2))
- `discount_amount` (NUMERIC(12, 2))
- `total` (NUMERIC(12, 2))
- `notes` (TEXT)
- `valid_until` (DATE, padrão: data atual + 7 dias)
- `converted_at` (TIMESTAMPTZ, preenchido quando aprovado/faturado)
- `converted_to_sale_id` (UUID, preparado para o PDV da Etapa 9)
- `created_at` e `updated_at` (TIMESTAMPTZ)

### 2.3 Tabela `public.quote_items`
Armazena os itens cotados:
- `id` (UUID, PK)
- `quote_id` (UUID, FK -> quotes ON DELETE CASCADE)
- `product_id` (UUID, FK -> products)
- `product_name`, `product_sku`, `product_barcode`, `unit`
- `quantity` (NUMERIC(12, 3) > 0)
- `unit_price` (NUMERIC(12, 2) >= 0)
- `price_type` (`retail`, `wholesale`, `custom`)
- `discount` (NUMERIC(12, 2) >= 0)
- `subtotal` (NUMERIC(12, 2) >= 0)
- `total` (NUMERIC(12, 2) >= 0)
- `notes` (TEXT)

### 2.4 Tabela `public.quote_status_history`
Registro imutável de transições de status para auditoria:
- `id` (UUID, PK)
- `quote_id` (UUID, FK -> quotes ON DELETE CASCADE)
- `company_id` (UUID, FK -> companies)
- `previous_status` (VARCHAR(20))
- `new_status` (VARCHAR(20))
- `reason` (TEXT)
- `user_id` (UUID, FK -> auth.users)
- `created_at` (TIMESTAMPTZ)

---

## 3. Triggers de Segurança e Integridade

1. **`trg_check_quote_editable`**:
   - Impede qualquer alteração (`UPDATE`) ou exclusão (`DELETE`) em orçamentos que já estejam com status `converted`.
   - Impede conversão duplicada.
2. **`trg_check_quote_item_editable`**:
   - Impede inserção, atualização ou exclusão de itens vinculados a um orçamento já convertido em venda.
3. **`trg_quotes_updated_at`**:
   - Mantém `updated_at` atualizado automaticamente a cada modificação permitida.

---

## 4. Funções RPC no Banco de Dados

1. **`public.save_quote(p_payload JSONB)`**:
   - Autentica o vendedor e valida autorização multiempresa.
   - Valida cada item contra o catálogo de produtos no banco.
   - Aplica a regra de atacado no banco: se `quantity >= wholesale_min_qty`, adota `wholesale_price`.
   - Recalcula subtotais de itens, desconta limites e calcula total líquido no servidor.
   - Grava ou atualiza `quotes`, `quote_items` e `quote_status_history` atomicamente.
2. **`public.update_quote_status(p_quote_id UUID, p_new_status VARCHAR, p_reason TEXT)`**:
   - Valida acesso e impede alterar orçamento já convertido.
   - Atualiza `status`, define `converted_at` e insere entrada na tabela `quote_status_history`.
3. **`public.duplicate_quote(p_quote_id UUID)`**:
   - Gera novo código sequencial `ORC-XXXXXX`, copia cabeçalho e itens como `draft`, renova a validade para 7 dias e cria histórico inicial.

---

## 5. Políticas RLS (Row Level Security)

RLS habilitado nas 3 tabelas (`quotes`, `quote_items`, `quote_status_history`):
- **SELECT**: Autorizado a usuários com vínculo ativo na empresa (`public.user_has_company_access(company_id)`).
- **INSERT**: Autorizado a usuários com vínculo ativo na empresa (`public.user_has_company_access(company_id)`).
- **UPDATE**: Autorizado a usuários com vínculo ativo na empresa (`public.user_has_company_access(company_id)`).
- **DELETE**: Restrito a administradores da empresa (`public.user_is_company_admin(company_id)`), sujeito adicionalmente ao trigger que barra exclusão se já convertido.

---

## 6. Telas e Componentes Implementados

| Rota | Componente | Descrição |
|---|---|---|
| `/cadastros/produtos` | `ProductsInquiryPage.tsx` | Consulta rápida com leitor de código de barras USB, estoque isolado por filial e preços Varejo/Atacado |
| `/comercial/orcamentos` | `QuotesListPage.tsx` | Gestão de orçamentos, KPIs, filtros por período/status/filial e paginação |
| `/comercial/orcamentos/novo` | `QuoteFormPage.tsx` | Criação de propostas, seleção de cliente, carrinho com leitor USB e cálculo automático de atacado |
| `/comercial/orcamentos/:id/editar` | `QuoteFormPage.tsx` | Edição de orçamento não convertido |
| Modal | `QuoteDetailsModal.tsx` | Visualização detalhada, linha do tempo de status, impressão e transições |

---

## 7. Verificação de Testes Executados

- **Compilação e Tipagem**: `tsc -b && vite build` executado com código de retorno 0 (zero erros).
- **Isolamento de Filiais**: O catálogo de produtos utiliza junção restrita à filial ativa no `BranchSelector`.
- **Prevenção de Edição em Convertidos**: Triggers `check_quote_editable` e `check_quote_item_editable` bloqueiam no banco qualquer mutação pós-conversão.
- **Leitor de Código de Barras USB**: Campo com `onKeyDown` captura o caractere Enter enviado pelo leitor óptico e localiza instantaneamente o SKU ou EAN.
