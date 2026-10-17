# Módulo de Vendas a Prazo, Crediário e Contas a Receber

**Sistema:** ERP MundoMix  
**Módulo:** Gestão Financeira — Vendas a Prazo, Crediário e Contas a Receber  
**Versão:** 1.0 (Etapa 12)  
**Tecnologias:** React, TypeScript, Vite, Tailwind CSS, PostgreSQL, Supabase  

---

## 1. Visão Geral

O Módulo de **Vendas a Prazo e Contas a Receber** implementa o ciclo financeiro completo de concessão de crediário próprio, parcelamento flexível de vendas no PDV, controle rigoroso de limites de crédito de clientes, liquidação e amortização de parcelas, e integração fluida com o módulo de controle de caixa.

---

## 2. Estrutura do Banco de Dados

### 2.1. Tabela `public.accounts_receivable` (Títulos e Obrigações a Receber)

Registra a obrigação financeira global gerada a partir de uma venda a prazo no PDV ou de um lançamento financeiro avulso.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `UUID (PK)` | Identificador único do título |
| `company_id` | `UUID (FK)` | Empresa ativa |
| `branch_id` | `UUID (FK)` | Filial responsável |
| `customer_id` | `UUID (FK)` | Cliente devedor |
| `sale_id` | `UUID (FK)` | Venda de origem (opcional) |
| `document_number` | `VARCHAR(100)` | Código legível do documento (ex: "TIT-VND-000001", "REC-123456") |
| `description` | `TEXT` | Descrição/finalidade do título |
| `issue_date` | `DATE` | Data de emissão |
| `total_amount` | `NUMERIC(12,2)` | Valor total negociado |
| `down_payment` | `NUMERIC(12,2)` | Valor de entrada quitado no ato |
| `balance_amount` | `NUMERIC(12,2)` | Saldo devedor remanescente a receber |
| `paid_amount` | `NUMERIC(12,2)` | Total amortizado até o momento |
| `installments_count`| `INTEGER` | Quantidade total de parcelas |
| `status` | `VARCHAR(30)` | `'open'`, `'partially_paid'`, `'paid'`, `'overdue'`, `'cancelled'` |
| `notes` | `TEXT` | Observações contratuais |
| `created_by` | `UUID (FK)` | Usuário responsável pelo lançamento |

---

### 2.2. Tabela `public.accounts_receivable_installments` (Parcelas Individuais)

Controla cada parcela com seu respectivo vencimento e saldo devedor individual.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `UUID (PK)` | Identificador da parcela |
| `receivable_id` | `UUID (FK)` | Título pai |
| `installment_number` | `INTEGER` | Número sequencial da parcela (ex: 1, 2, 3...) |
| `due_date` | `DATE` | Data de vencimento |
| `original_amount` | `NUMERIC(12,2)` | Valor original da parcela (distribuído em centavos) |
| `paid_amount` | `NUMERIC(12,2)` | Total já amortizado na parcela |
| `balance_amount` | `NUMERIC(12,2)` | Saldo em aberto da parcela |
| `status` | `VARCHAR(30)` | `'open'`, `'partially_paid'`, `'paid'`, `'overdue'`, `'cancelled'` |

---

### 2.3. Tabela `public.receivable_payments` (Histórico Auditável de Recebimentos)

Registra cada quitação total ou parcial de parcela realizada pelo operador de caixa ou tesouraria.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `UUID (PK)` | Identificador do recebimento |
| `receivable_id` | `UUID (FK)` | Título pai |
| `installment_id` | `UUID (FK)` | Parcela liquidada |
| `customer_id` | `UUID (FK)` | Cliente pagador |
| `cash_session_id` | `UUID (FK)` | Sessão de caixa aberta vinculada (se em dinheiro no PDV) |
| `amount_paid` | `NUMERIC(12,2)` | Valor recebido |
| `payment_method` | `VARCHAR(50)` | `'cash'`, `'pix'`, `'debit_card'`, `'credit_card'`, `'bank_transfer'` |
| `payment_date` | `TIMESTAMPTZ` | Timestamp do recebimento |
| `received_by` | `UUID (FK)` | Operador autenticado |
| `idempotency_key` | `VARCHAR(100)` | Chave para evitar baixas duplicadas |

#### Garantia de Imutabilidade
O trigger `trg_prevent_receivable_payment_tampering` no PostgreSQL bloqueia tentativas de `UPDATE` e `DELETE` em recebimentos confirmados, garantindo rastreabilidade e histórico fiscal inalterável.

---

## 3. Funções Transacionais (RPCs de Banco)

### 3.1. `get_customer_credit_profile(p_company_id, p_customer_id)`
Calcula em tempo real a situação de crédito do cliente:
- **Limite Cadastrado** (`credit_limit`).
- **Saldo Utilizado** ($\sum \text{balance\_amount}$ de títulos em aberto).
- **Limite Disponível** ($\text{Disponível} = \max(0, \text{Limite} - \text{Utilizado})$).
- **Parcelas Vencidas** ($\sum \text{balance\_amount}$ onde $\text{due\_date} < \text{hoje}$).
- **Bloqueio** (`credit_status = 'blocked'` ou cliente inativo).

### 3.2. `receive_installment_payment(...)`
Executa o recebimento atômico e idempotente:
- Bloqueia concorrentemente a linha da parcela (`FOR UPDATE`).
- Valida que o valor pago não ultrapassa o saldo devedor.
- Se o pagamento for em **dinheiro** e houver caixa aberto ativo (`cash_session_id`), gera uma movimentação de entrada/suprimento no caixa (`add_cash_movement`), aumentando fisicamente a gaveta do operador de caixa.
- Atualiza o saldo e status da parcela e do título pai.
- Registra a transação em `receivable_payments`.

### 3.3. `finalize_pos_sale(...)` (Atualizada com Suporte a Crediário)
- Permite vendas mistas (ex: Entrada em dinheiro ou cartão + Restante no Crediário) ou 100% no Crediário.
- Valida que o cliente está identificado e possui limite disponível.
- Se houver `store_credit`:
  - O valor a prazo **não** entra como dinheiro recebido na gaveta do caixa.
  - Gera automaticamente o título em `accounts_receivable`.
  - Gera as $N$ parcelas em `accounts_receivable_installments`, dividindo os centavos com exatidão matemática ($\sum \text{parcelas} = \text{valor financiado}$).

---

## 4. Geração de Parcelas e Divisão de Centavos

Para garantir que a soma das parcelas seja rigorosamente idêntica ao valor financiado, sem perda ou acréscimo de centavos:
$$\text{Base} = \lfloor \frac{\text{Total}}{N} \times 100 \rfloor / 100$$
$$\text{Resto} = \text{Total} - (\text{Base} \times N)$$
- A **1ª parcela** absorve o resto em centavos: $\text{Parcela}_1 = \text{Base} + \text{Resto}$.
- As demais parcelas ($2 \dots N$) recebem o valor $\text{Base}$.

---

## 5. Integração com o Controle de Caixa

1. **Venda a Prazo Realizada:** O valor do crediário não soma nas cédulas físicas da gaveta do caixa; é registrado apenas no totalizador gerencial de crediário do relatório diário.
2. **Recebimento de Parcela em Dinheiro no Turno:** Quando um cliente paga uma parcela no balcão com o caixa aberto, o sistema registra uma movimentação de entrada/suprimento de crediário no caixa, atualizando o saldo esperado de dinheiro na gaveta.
3. **Recebimento em Pix/Cartão:** Registrado no histórico da parcela sem inflar o dinheiro físico da gaveta.

---

## 6. Telas e Componentes Desenvolvidos

1. **Gestão de Contas a Receber ([`AccountsReceivablePage.tsx`](file:///c:/Users/Xster%20Software%20House/Desktop/erp-mundomix/src/features/receivables/AccountsReceivablePage.tsx))**:
   - KPIs: Total a Receber, Vencidos em Atraso, Vencimento Hoje, Total de Títulos.
   - Abas de status: Todas, Em Aberto, Parcialmente Pagas, Vencidas, Quitadas.
   - Filtros por cliente, filial, datas e busca textual.
   - Tabela com ações rápidas: "Receber" e "Ver Detalhes".
2. **Modal de Recebimento ([`ReceivePaymentModal.tsx`](file:///c:/Users/Xster%20Software%20House/Desktop/erp-mundomix/src/features/receivables/modals/ReceivePaymentModal.tsx))**:
   - Quitação integral ou amortização parcial.
   - Seleção do meio de pagamento.
   - Vínculo automático com o caixa aberto atual do operador.
3. **Modal de Detalhes ([`ReceivableDetailsModal.tsx`](file:///c:/Users/Xster%20Software%20House/Desktop/erp-mundomix/src/features/receivables/modals/ReceivableDetailsModal.tsx))**:
   - Resumo da dívida e dados do cliente.
   - Histórico de todos os pagamentos auditados já recebidos para a parcela.
4. **Modal de Novo Título Manual ([`CreateReceivableModal.tsx`](file:///c:/Users/Xster%20Software%20House/Desktop/erp-mundomix/src/features/receivables/modals/CreateReceivableModal.tsx))**:
   - Lançamento financeiro com entrada e parcelamento personalizado.
5. **Painel de Crédito no PDV ([`PaymentModal.tsx`](file:///c:/Users/Xster%20Software%20House/Desktop/erp-mundomix/src/features/pos/modals/PaymentModal.tsx))**:
   - Exibição de limite e contas em atraso do cliente no momento da venda.
   - Seletor de parcelas e primeiro vencimento.
6. **Painel Financeiro no Cadastro de Clientes ([`CustomerFormPage.tsx`](file:///c:/Users/Xster%20Software%20House/Desktop/erp-mundomix/src/features/customers/CustomerFormPage.tsx))**:
   - Apresentação em tempo real do limite total, saldo utilizado, saldo disponível e contas vencidas.

---

## 7. Resultados dos Testes Automatizados

Script: [`scripts/test_accounts_receivable.mjs`](file:///c:/Users/Xster%20Software%20House/Desktop/erp-mundomix/scripts/test_accounts_receivable.mjs)

```
=================================================================
🚀 INICIANDO TESTES DO MÓDULO DE CONTAS A RECEBER E CREDIÁRIO
=================================================================

🔹 Teste 1: Venda 100% a Prazo no Crediário
  ✅ Venda a prazo registrada sem simular entrada no caixa físico.

🔹 Teste 2: Venda com Entrada + Saldo no Crediário
  ✅ Entrada de R$ 100 computada no caixa e R$ 400 destinados ao crediário.

🔹 Teste 3: Soma das Parcelas em Centavos (Exemplo R$ 100,00 em 3x)
  ✅ 3 parcelas geradas: [33.34, 33.33, 33.33] -> Soma R$ 100.00

🔹 Teste 4: Recebimento / Quitação Integral de Parcela
  ✅ Parcela liquidada integralmente (status: paid, saldo: R$ 0,00).

🔹 Teste 5: Recebimento Parcial
  ✅ Recebimento parcial inicial (R$ 80) e liquidação final (R$ 120) executados com precisão.

🔹 Teste 6: Bloqueio de Recebimento Excessivo
  ✅ Tentativa de receber R$ 60 em dívida de R$ 50 bloqueada com sucesso.

🔹 Teste 7: Prevenção de Recebimento Duplicado (Idempotência)
  ✅ Idempotência validada contra repetição indevida de requisições de pagamento.

🔹 Teste 8: Validação de Limite de Crédito do Cliente
  ✅ Limite Total R$ 1.000, Usado R$ 750 -> Venda de R$ 200 aprovada, R$ 300 bloqueada.

🔹 Teste 9: Bloqueio de Clientes com Status Restritivo
  ✅ Clientes bloqueados e inativos impedidos de realizar compras a prazo.

🔹 Teste 10: Detecção de Parcelas Vencidas em Atraso
  ✅ 2 parcelas vencidas detectadas totalizando R$ 150.00 em atraso.

🔹 Teste 11: Recebimento em Dinheiro no Caixa Aberto
  ✅ Recebimento em dinheiro aumentou gaveta para R$ 225; Pix registrado sem alterar cédulas.

🔹 Teste 12: Garantia de Imutabilidade e Auditoria
  ✅ Registros de pagamentos confirmados blindados contra edições silenciosas.

=================================================================
🎉 TODOS OS 12 TESTES DE CONTAS A RECEBER E CREDIÁRIO PASSARAM!
=================================================================
```
