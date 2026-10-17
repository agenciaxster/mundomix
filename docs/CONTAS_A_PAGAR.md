# Módulo de Contas a Pagar e Despesas

**Sistema:** ERP MundoMix  
**Módulo:** Gestão Financeira — Contas a Pagar e Despesas Operacionais  
**Versão:** 1.0  
**Tecnologias:** React, TypeScript, Vite, Tailwind CSS, PostgreSQL, Supabase  

---

## 1. Visão Geral

O módulo de **Contas a Pagar** é o centro de controle financeiro das obrigações da empresa. Ele gerencia pagamentos a fornecedores, despesas operacionais recorrentes (aluguel, água, energia, internet/telecom, folha de pagamento, impostos, manutenção e serviços contratados), parcelamentos em centavos exatos, liquidações totais ou parciais e integração direta com o controle de caixa.

---

## 2. Estrutura do Banco de Dados

### 2.1. Tabela `public.financial_categories` (Categorias de Despesa)

Categorias financeiras configuráveis por empresa:
- `id` (UUID PK)
- `company_id` (UUID FK)
- `name` (VARCHAR)
- `code` (VARCHAR)
- `type` (`'expense'`, `'income'`)
- `color` (VARCHAR)
- `status` (`'active'`, `'inactive'`)

Categorias padrão criadas automaticamente:
1. Aluguel
2. Água e Energia
3. Internet e Telefone
4. Fornecedores e Mercadorias
5. Serviços Contratados
6. Folha de Pagamento
7. Impostos e Taxas
8. Manutenção
9. Outras Despesas

---

### 2.2. Tabela `public.accounts_payable` (Obrigação Principal)

Registra a obrigação financeira global:
- `id` (UUID PK)
- `company_id` (UUID FK)
- `branch_id` (UUID FK)
- `supplier_id` (UUID FK para `suppliers`)
- `category_id` (UUID FK para `financial_categories`)
- `document_number` (VARCHAR) — número da NF, boleto ou recibo
- `description` (VARCHAR) — descrição da despesa
- `issue_date` (DATE) — data de emissão
- `competence_date` (DATE) — data de competência contábil
- `due_date` (DATE) — primeiro vencimento
- `original_amount` (NUMERIC) — valor nominal
- `discount_amount` (NUMERIC) — desconto
- `interest_amount` (NUMERIC) — juros
- `fine_amount` (NUMERIC) — multa
- `total_amount` (NUMERIC) — valor final devido
- `paid_amount` (NUMERIC) — valor pago acumulado
- `balance_amount` (NUMERIC) — saldo devedor remanescente
- `installments_count` (INTEGER) — quantidade de parcelas
- `status` (`'pending'`, `'partially_paid'`, `'paid'`, `'overdue'`, `'cancelled'`)
- `cancellation_reason` (TEXT) — justificativa auditável de cancelamento
- `cancelled_by` (UUID FK)
- `cancelled_at` (TIMESTAMPTZ)
- `notes` (TEXT)
- `attachment_url` (TEXT)

---

### 2.3. Tabela `public.accounts_payable_installments` (Parcelas Individuais)

Registra cada parcela individual com vencimento e saldo próprio:
- `id` (UUID PK)
- `payable_id` (UUID FK para `accounts_payable`)
- `company_id` (UUID FK)
- `branch_id` (UUID FK)
- `supplier_id` (UUID FK)
- `installment_number` (INTEGER)
- `due_date` (DATE)
- `amount` (NUMERIC) — valor da parcela distribuído em centavos
- `paid_amount` (NUMERIC)
- `balance_amount` (NUMERIC)
- `status` (`'pending'`, `'partially_paid'`, `'paid'`, `'overdue'`, `'cancelled'`)

---

### 2.4. Tabela `public.payable_payments` (Histórico Auditável de Baixas)

Registros de pagamento estritamente imutáveis protegidos por trigger:
- `id` (UUID PK)
- `company_id` (UUID FK)
- `branch_id` (UUID FK)
- `payable_id` (UUID FK)
- `installment_id` (UUID FK)
- `supplier_id` (UUID FK)
- `cash_session_id` (UUID FK para `cash_sessions`)
- `cash_movement_id` (UUID FK para `cash_movements`)
- `amount_paid` (NUMERIC)
- `discount_applied` (NUMERIC)
- `interest_applied` (NUMERIC)
- `fine_applied` (NUMERIC)
- `payment_method` (`'cash'`, `'pix'`, `'bank_transfer'`, `'credit_card'`, `'bank_slip'`, `'other'`)
- `payment_date` (TIMESTAMPTZ)
- `paid_by` (UUID FK)
- `notes` (TEXT)
- `idempotency_key` (VARCHAR)

---

## 3. Regras de Negócio e Cálculos

### 3.1. Divisão Exata de Parcelas em Centavos
Garante que a soma de todas as parcelas corresponda com exatidão ao valor financiado:
$$BaseCents = \lfloor \frac{TotalCents}{N} \rfloor$$
$$RemainderCents = TotalCents - (BaseCents \times N)$$
A sobra em centavos ($RemainderCents$) é atribuída à primeira parcela, eliminando qualquer dízima periódica ou divergência contábil.

### 3.2. Integração com o Controle de Caixa
- **Pagamento em Dinheiro (`cash`) com Caixa Aberto**:
  Cria automaticamente uma movimentação do tipo `expense` na tabela `cash_movements` vinculada à sessão aberta do operador, reduzindo o saldo físico em dinheiro para o fechamento de caixa do turno.
- **Pagamentos via Pix, Transferência, Cartão ou Boleto**:
  Liquidada a obrigação no contas a pagar sem alterar indevidamente a gaveta física de dinheiro em espécie.

### 3.3. Cancelamento e Auditoria
- Uma conta a pagar só pode ser cancelada se seu saldo pago for igual a zero ($paid\_amount \le 0.009$).
- O cancelamento exige obrigatoriamente um motivo que fica registrado permanentemente para fins de auditoria (`cancellation_reason`, `cancelled_by`, `cancelled_at`).

---

## 4. Telas e Componentes

1. **`AccountsPayablePage.tsx`**:
   - KPIs: Total em Aberto, Total Vencido, Vence Hoje, A Vencer em 7 Dias, Total Pago.
   - Abas de status: *Todas as Contas, Pendentes, Parcialmente Pagas, Vencidas, Pagas, Canceladas*.
   - Filtros: Busca textual (descrição, fornecedor, documento), Categoria financeira e período de vencimento.
2. **`PayInstallmentModal.tsx`**:
   - Quitação total ou parcial de parcela.
   - Descontos, juros e multas.
   - Integração com o caixa físico aberto se a forma de pagamento for dinheiro.
3. **`CreatePayableModal.tsx`**:
   - Criação de despesas avulsas ou parceladas.
   - Seleção de fornecedores cadastrados.
   - Criação rápida de novas categorias financeiras.
   - Pré-visualização do cronograma de parcelas com cálculo exato em centavos.
4. **`PayableDetailsModal.tsx`**:
   - Visualização dos dados da conta, parcelas e linha do tempo de pagamentos efetuados com auditoria do operador.
