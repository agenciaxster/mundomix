# ETAPA 6 — CONTROLE DE ESTOQUE POR FILIAL

## 1. VISÃO GERAL DA ARQUITETURA

O módulo de **Controle de Estoque por Filial** do ERP MundoMix foi arquitetado com base no princípio de que o saldo operacional de mercadorias nunca reside de forma genérica ou centralizada na tabela de produtos, e sim segregado estritamente por cada unidade de negócio (`branch_stock`), com histórico de movimentações persistente e append-only (`stock_movements`), e controle transacional de remessas entre matriz e filiais (`stock_transfers`).

---

## 2. MODELO DE DADOS

### 2.1 Tabela `public.products` (Catálogo e Referência)
Mantém as especificações cadastrais da mercadoria pertencente à empresa:
- `id` (UUID, PK)
- `company_id` (UUID, FK `companies.id` ON DELETE CASCADE)
- `name` (VARCHAR)
- `sku` (VARCHAR, UNIQUE por empresa)
- `barcode` (VARCHAR, código de barras)
- `category` (VARCHAR)
- `unit` (VARCHAR, default 'UN')
- `cost_price` / `sale_price` (NUMERIC(12,2))
- `min_stock` (NUMERIC(12,3), estoque mínimo padrão do cadastro)
- `status` (VARCHAR: 'active' | 'inactive')

### 2.2 Tabela `public.branch_stock` (Saldo por Filial)
Garante a segregação física e operacional de saldo por unidade:
- `id` (UUID, PK)
- `company_id` (UUID, FK `companies.id`)
- `branch_id` (UUID, FK `branches.id`)
- `product_id` (UUID, FK `products.id`)
- `quantity` (NUMERIC(12,3), saldo físico em estoque >= 0)
- `reserved_quantity` (NUMERIC(12,3), saldo empenhado em pedidos/reservas >= 0)
- `min_stock` (NUMERIC(12,3), estoque mínimo específico da unidade)
- `last_movement_at` (TIMESTAMPTZ, timestamp do último evento)
- `created_at` / `updated_at` (TIMESTAMPTZ)
- **Constraint de Unicidade**: `CONSTRAINT uq_branch_product_stock UNIQUE (branch_id, product_id)`
- **Constraint de Integridade**: `CHECK (quantity >= 0)` e `CHECK (reserved_quantity >= 0)` (impede estoque negativo no nível de banco)

### 2.3 Tabela `public.stock_movements` (Histórico Auditável e Append-Only)
Registra cada alteração de saldo individualmente com snapshot do saldo anterior e posterior:
- `id` (UUID, PK)
- `company_id` / `branch_id` / `product_id` (UUIDs, FKs)
- `movement_type` (`entry`, `exit`, `adjustment`, `transfer_out`, `transfer_in`, `reversal`)
- `quantity` (NUMERIC(12,3), sempre positivo no log)
- `balance_before` (NUMERIC(12,3), saldo pré-movimentação)
- `balance_after` (NUMERIC(12,3), saldo pós-movimentação)
- `reason` (VARCHAR, motivo obrigatório)
- `notes` (TEXT, observações complementares e justificativas)
- `user_id` (UUID, FK `auth.users(id)`)
- `reference_id` (UUID, vínculo com transferências, compras ou vendas)
- `reference_type` (VARCHAR, ex: `stock_transfers`, `manual_entry`, `manual_exit`)
- `created_at` (TIMESTAMPTZ, data/hora da ocorrência)
- **Trigger de Imutabilidade**: `prevent_stock_movement_mutation` impede qualquer `UPDATE` ou `DELETE` nesta tabela.

### 2.4 Tabelas `public.stock_transfers` e `public.stock_transfer_items`
Controlam transferências entre filiais da mesma empresa:
- `stock_transfers`:
  - `id` (UUID, PK)
  - `company_id` (UUID, FK `companies.id`)
  - `code` (VARCHAR, ex: `TRF-YYYYMMDD-XXXX`, UNIQUE por empresa)
  - `origin_branch_id` (UUID, FK `branches.id`, Origem da mercadoria)
  - `destination_branch_id` (UUID, FK `branches.id`, Destino da mercadoria)
  - `status` (`draft` | `in_transit` | `received` | `cancelled`)
  - `notes` (TEXT)
  - `shipped_by` / `shipped_at` (Rastreabilidade da expedição)
  - `received_by` / `received_at` (Rastreabilidade do recebimento)
  - `cancelled_by` / `cancelled_at` (Rastreabilidade do cancelamento)
- `stock_transfer_items`:
  - `id` (UUID, PK)
  - `transfer_id` (UUID, FK `stock_transfers.id`)
  - `product_id` (UUID, FK `products.id`)
  - `quantity_sent` (NUMERIC(12,3))
  - `quantity_received` (NUMERIC(12,3))

---

## 3. TRANSAÇÕES ATÔMICAS E FUNÇÕES RPC (POSTGRESQL)

Todas as alterações de saldo são processadas exclusivamente pelo PostgreSQL em funções transacionais com bloqueio pessimista (`FOR UPDATE`) para eliminar qualquer condição de corrida (*race condition*):

### 3.1 `public.execute_stock_movement`
- **Assinatura**:
  `execute_stock_movement(p_company_id, p_branch_id, p_product_id, p_movement_type, p_quantity, p_reason, p_notes, p_reference_id, p_reference_type)`
- **Fluxo Atômico**:
  1. Valida se o usuário autenticado (`auth.uid()`) possui acesso administrativo ou acesso específico à filial.
  2. Valida se a filial e o produto pertencem à empresa ativa.
  3. Insere ou localiza o registro em `branch_stock` com `FOR UPDATE`.
  4. Valida se há saldo suficiente para saídas (impede estoque negativo).
  5. Atualiza o saldo `branch_stock.quantity` e `last_movement_at`.
  6. Insere o registro no log `stock_movements`.
  7. Retorna `jsonb` com o ID da movimentação e os saldos anterior/posterior calculados.

### 3.2 `public.ship_stock_transfer` (Expedição / Trânsito)
- **Assinatura**: `ship_stock_transfer(p_transfer_id, p_notes)`
- **Fluxo Atômico**:
  1. Valida status da transferência (`draft`).
  2. Itera sobre cada item bloqueando `branch_stock` da filial de origem com `FOR UPDATE`.
  3. Valida saldo suficiente na origem; se insuficiente, aborta e faz rollback de tudo.
  4. Debita o saldo físico da filial de origem.
  5. Gera movimentação `transfer_out` vinculada à remessa.
  6. Altera o status da transferência para `in_transit`.
  - **Estratégia de Custódia**: A mercadoria sai da disponibilidade da origem, mas **NÃO** entra no saldo do destino até a confirmação física de recebimento.

### 3.3 `public.receive_stock_transfer` (Recebimento no Destino)
- **Assinatura**: `receive_stock_transfer(p_transfer_id, p_notes)`
- **Fluxo Atômico**:
  1. Valida status (`in_transit`) e permissão na filial de destino.
  2. Para cada item, credita na `branch_stock` do destino com `FOR UPDATE`.
  3. Registra movimentação de entrada `transfer_in` com referência da remessa.
  4. Atualiza `quantity_received` nos itens e marca status como `received`.

### 3.4 `public.cancel_stock_transfer` (Cancelamento e Estorno)
- **Assinatura**: `cancel_stock_transfer(p_transfer_id, p_notes)`
- **Fluxo Atômico**:
  1. Se a transferência estiver em `draft`, apenas marca como `cancelled`.
  2. Se a transferência estiver `in_transit`, estorna atomicamente a mercadoria devolvendo o saldo para a filial de origem, registrando movimentação do tipo `reversal`.
  3. Se já tiver sido `received`, impede o cancelamento (exige transferência reversa).

---

## 4. POLÍTICAS DE SEGURANÇA (RLS)

O Row Level Security (RLS) foi ativado em todas as tabelas:
- **`branch_stock`**:
  - `SELECT`: Permitido para `public.user_is_company_admin(company_id)` ou `public.user_has_branch_access(branch_id)`.
  - `INSERT / UPDATE`: Restrito a admins ou usuários vinculados à respectiva filial.
- **`stock_movements`**:
  - `SELECT`: Usuários autorizados na respectiva filial ou admins da empresa.
  - `INSERT`: Via backend/RPC autenticada com acesso à filial.
  - `UPDATE / DELETE`: Bloqueados no RLS e no trigger.
- **`stock_transfers` & `stock_transfer_items`**:
  - Visíveis e operáveis somente por quem tem acesso à empresa e a ao menos uma das filiais (origem ou destino).

---

## 5. TELAS E INTERFACES IMPLEMENTADAS

1. **Visão Geral do Estoque (`/estoque`)**:
   - Indicador contextual da filial ativa (`activeBranch.name` e código).
   - 4 Cards de KPIs com dados reais:
     - Produtos com Saldo.
     - Produtos Abaixo do Estoque Mínimo (alerta visual).
     - Produtos Zerados (sem saldo físico).
     - Transferências a Receber (cargas em trânsito com destino para esta filial).
   - Filtros dinâmicos rápidos por tabs ("Todos", "Estoque Baixo", "Sem Saldo").
   - Campo de busca em tempo real com debounce por Nome, SKU ou leitor de Código de Barras.
   - Tabela detalhada com colunas: Produto, Categoria, Estoque Físico, Reservado, Disponível, Mínimo e Status.
   - Ações rápidas em linha para Entrada, Saída e Ajuste.

2. **Histórico de Movimentações (`/estoque/movimentacoes`)**:
   - Extrato auditável e cronológico de movimentações.
   - Filtro por Tipo (`Entrada`, `Saída`, `Ajuste`, `Transf. Saída`, `Transf. Entrada`, `Estorno`).
   - Filtro por Período (Data Inicial e Data Final).
   - Pesquisa por Nome de Produto, SKU ou Motivo.
   - Colunas com Saldo Anterior ➔ Saldo Posterior, Quantidade com sinal e destaque de cores, Motivo, Justificativas e Referências.

3. **Gestão de Transferências entre Filiais (`/estoque/transferencias`)**:
   - Listagem com abas por status (`Todas`, `Em Trânsito`, `Rascunhos`, `Recebidas`, `Canceladas`).
   - Visualização clara do fluxo: `Origem ➔ Destino`, produtos e volumes totais.
   - Botões contextuais para:
     - "Despachar" (quando rascunho na origem).
     - "Receber" (quando em trânsito no destino).
     - "Detalhes" (para auditoria completa de itens e datas).

4. **Modais Especializados**:
   - `StockEntryModal`: Entrada manual com seleção de filial, pesquisa de produto, quantidade positiva e motivo de negócio.
   - `StockExitAdjustmentModal`: Saídas manuais e ajustes com checagem de saldo disponível em tempo real e bloqueio de saldos negativos.
   - `NewTransferModal`: Montagem de transferências entre filiais da mesma empresa com múltiplos itens e validação do saldo de origem.
   - `TransferDetailsModal`: Visualização completa dos itens da remessa, conferência de volumes e ações de despacho, recebimento e cancelamento seguro.

---

## 6. COMO APLICAR A MIGRATION NO SUPABASE

Abra o painel do seu projeto Supabase, acesse o **SQL Editor** e execute o script localizado em:
`supabase/migrations/20261014000005_stock_control_schema.sql`

O script é idempotente (`IF NOT EXISTS`, `OR REPLACE`) e criará as tabelas, índices, triggers, funções RPC atômicas e políticas RLS.

---

## 7. CONFIRMAÇÃO DO ESCOPO

- **Etapa 6**: Concluída com sucesso.
- **Etapa 7**: **NÃO INICIADA** (aguardando autorização explícita do usuário).
