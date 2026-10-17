# Módulo de Controle de Caixa: Abertura, Movimentações e Fechamento

**Sistema:** ERP MundoMix  
**Módulo:** Gestão de Frente de Caixa e Tesouraria  
**Versão:** 1.0 (Etapa 11)  
**Tecnologias:** React, TypeScript, Vite, Tailwind CSS, PostgreSQL, Supabase  

---

## 1. Visão Geral

O Módulo de **Controle de Caixa** fornece rastreabilidade completa e segura de todas as operações monetárias realizadas no ponto de venda (PDV) e tesouraria. Garante a integridade dos fundos, o vínculo transacional de cada venda ao turno ativo do operador, o registro auditável de suprimentos e sangrias, e a conciliação precisa no fechamento de caixa diário.

---

## 2. Estrutura do Banco de Dados

### 2.1. Tabela `public.cash_sessions` (Sessões de Caixa)

Armazena as aberturas, fechamentos e conferências de cada turno de caixa.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `UUID (PK)` | Identificador único da sessão |
| `company_id` | `UUID (FK)` | Empresa ativa |
| `branch_id` | `UUID (FK)` | Filial da abertura |
| `session_number` | `INTEGER` | Número sequencial legível para a empresa |
| `terminal_name` | `TEXT` | Identificação do caixa/terminal (ex: "Caixa 01") |
| `operator_id` | `UUID (FK)` | Usuário responsável pela sessão de caixa |
| `opened_at` | `TIMESTAMPTZ` | Data e hora da abertura |
| `initial_amount` | `NUMERIC(12,2)` | Fundo de troco inicial informado |
| `opening_notes` | `TEXT` | Observações opcionais no início do turno |
| `closed_at` | `TIMESTAMPTZ` | Data e hora do encerramento |
| `closed_by` | `UUID (FK)` | Usuário que executou o fechamento |
| `counted_cash_amount` | `NUMERIC(12,2)` | Dinheiro físico contado pelo operador |
| `expected_cash_amount` | `NUMERIC(12,2)` | Total em dinheiro calculado pelo sistema |
| `cash_difference` | `NUMERIC(12,2)` | Diferença apurada (`counted - expected`) |
| `status` | `TEXT` | `'open'`, `'closed'`, `'balanced'`, `'shortage'`, `'surplus'` |
| `difference_justification`| `TEXT` | Justificativa do operador em caso de divergência |
| `verified_at` | `TIMESTAMPTZ` | Data e hora da auditoria gerencial |
| `verified_by` | `UUID (FK)` | Usuário gerente/administrador que conferiu |
| `verification_notes` | `TEXT` | Parecer da auditoria |

#### Índices de Concorrência e Integridade
```sql
-- Impede mais de uma sessão aberta para o mesmo operador na mesma filial
CREATE UNIQUE INDEX idx_unique_open_session_per_operator
  ON public.cash_sessions (company_id, branch_id, operator_id)
  WHERE status = 'open';

-- Impede mais de uma sessão aberta para o mesmo terminal na mesma filial
CREATE UNIQUE INDEX idx_unique_open_session_per_terminal
  ON public.cash_sessions (company_id, branch_id, terminal_name)
  WHERE status = 'open';
```

---

### 2.2. Tabela `public.cash_movements` (Movimentações de Caixa)

Registra todas as entradas e saídas físicas manuais de dinheiro durante o expediente (Suprimento, Sangria e Despesas autorizadas).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `UUID (PK)` | Identificador da movimentação |
| `company_id` | `UUID (FK)` | Empresa |
| `branch_id` | `UUID (FK)` | Filial |
| `cash_session_id` | `UUID (FK)` | Sessão de caixa aberta vinculada |
| `movement_type` | `TEXT` | `'supply'` (suprimento), `'bleed'` (sangria), `'expense'` (despesa) |
| `amount` | `NUMERIC(12,2)` | Valor positivo da operação |
| `reason` | `TEXT` | Motivo/justificativa obrigatória |
| `created_by` | `UUID (FK)` | Usuário operador responsável |
| `authorized_by` | `UUID (FK)` | Usuário que autorizou (gerente/responsável) |
| `created_at` | `TIMESTAMPTZ` | Timestamp auditável de registro |

#### Garantia de Imutabilidade
Um trigger `trg_prevent_cash_movement_tampering` no PostgreSQL bloqueia tentativas de `UPDATE` e `DELETE` na tabela `cash_movements`, garantindo histórico inalterável de tesouraria.

---

### 2.3. Vínculo com a Tabela `public.sales`

A tabela `sales` recebeu a coluna:
```sql
ALTER TABLE public.sales
  ADD COLUMN cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL;
```
Permite rastrear cada venda concluída ao respectivo caixa e operador. Vendas históricas (anteriores ao módulo) permanecem intactas com valor `NULL`.

---

## 3. Funções Transacionais (RPCs de Banco)

Para segurança máxima e prevenção de manipulações no frontend, as operações críticas são processadas via rotinas `SECURITY DEFINER`:

1. **`open_cash_session`**:
   - Valida autorização do usuário e status da empresa/filial.
   - Verifica se já existe sessão aberta para o operador ou para o terminal.
   - Gera número sequencial atômico de sessão.
   - Registra o fundo inicial (não contabilizado como venda).

2. **`add_cash_movement`**:
   - Valida se a sessão de caixa informada ainda está com status `'open'`.
   - Exige valor positivo (`> 0`) e motivo descritivo.
   - Associa os identificadores de auditoria.

3. **`close_cash_session`**:
   - Bloqueia concorrentemente a linha da sessão (`FOR UPDATE`).
   - Calcula os pagamentos líquidos em dinheiro realizados nas vendas vinculadas:
     `net_cash_sales = SUM(received_amount - change_amount)`
   - Computa os suprimentos, sangrias e despesas registradas.
   - Calcula o **Dinheiro Esperado**:
     $$\text{Esperado} = \text{Fundo Inicial} + \text{Vendas em Dinheiro Líquidas} + \text{Suprimentos} - \text{Sangrias} - \text{Despesas}$$
   - Calcula a **Diferença**:
     $$\text{Diferença} = \text{Dinheiro Contado} - \text{Dinheiro Esperado}$$
   - Classifica o status final:
     - Diferença $= 0$: `balanced` (Conferido)
     - Diferença $> 0$: `surplus` (Sobra de Caixa)
     - Diferença $< 0$: `shortage` (Falta de Caixa)
   - Marca a sessão como encerrada com data/hora e operador do fechamento.

4. **`verify_cash_session`**:
   - Permite que gerentes e administradores analisem divergências e aprovem a conferência com notas de auditoria.

5. **`finalize_pos_sale` (Atualizada)**:
   - Valida no backend a existência e abertura da sessão de caixa (`cash_session_id`).
   - Associa a venda concluída à sessão ativa dentro da mesma transação de baixa de estoque e registro financeiro.

---

## 4. Fórmulas de Cálculo e Tratamento de Pagamentos

### 4.1. Dinheiro Físico Esperado
$$\text{Dinheiro Esperado} = \text{Fundo Inicial} + \text{Recebimentos Líquidos em Dinheiro} + \text{Suprimentos} - \text{Sangrias} - \text{Despesas em Dinheiro}$$

### 4.2. Tratamento Correto do Troco
Quando o cliente paga uma compra de R$ 30,00 com uma cédula de R$ 50,00:
- Valor recebido: R$ 50,00
- Troco devolvido: R$ 20,00
- **Acréscimo líquido ao caixa físico:** R$ 30,00.
O sistema calcula o acréscimo líquido subtraindo o troco devolvido, evitando inflar indevidamente o saldo em espécie.

### 4.3. Segregação de Meios Digitais e a Prazo
Os seguintes meios de pagamento **NÃO** entram no cômputo de dinheiro físico do caixa:
- **Pix** (recebimento bancário direto na conta corrente)
- **Cartão de Débito** (crédito em domicílio bancário)
- **Cartão de Crédito** (liquidação futura na operadora)
- **Crediário / A Prazo** (título a receber)
- **Boleto / Outros**

Esses valores são totalizados e apresentados individualmente no fechamento e nos relatórios, sem distorcer a contagem de cédulas e moedas do operador.

---

## 5. Interface e Telas Criadas

1. **PDV (`/pdv`)**:
   - Header dinâmico com badge de status do Caixa (Verde = Aberto, Vermelho = Fechado).
   - Exibição do terminal e valor do fundo inicial.
   - Botões de atalho rápido no header: **Suprimento**, **Sangria**, **Fechar Caixa**.
   - Bloqueio inteligente: se o caixa estiver fechado, ao tentar cobrar (F10) o sistema impede a venda e abre o fluxo guiado de abertura de caixa.
   - Atalho direto para a tela de **Gestão do Caixa**.

2. **Tela de Gestão e Histórico de Caixas (`/comercial/caixa` e `/financeiro/caixa`)**:
   - Cards de resumo: Sessão ativa do operador, Vendas acumuladas em dinheiro e outros meios, Suprimentos e Sangrias do dia.
   - Tabela com filtros de data, filial, operador e status (Aberto, Conferido, Falta, Sobra).
   - Histórico completo de turnos anteriores.
   - Ação de **Auditar/Conferir** para gerentes e administradores.
   - Botão para emissão de **Relatório do Caixa**.

3. **Modais Especializados**:
   - `OpenCashSessionModal`: Abertura com operador logado, filial ativa, terminal e fundo inicial.
   - `CashMovementModal`: Operações de Suprimento e Sangria com valor positivo e motivo obrigatório.
   - `CloseCashSessionModal`: Painel comparativo em tempo real, campo obrigatório para contagem física do dinheiro, cálculo automático da diferença e justificativa para divergências.
   - `CashAuditModal`: Aprovação e visto gerencial com parecer de auditoria.
   - `CashReportModal`: Visualização detalhada do fechamento com impressão nos formatos **A4** e **Comprovante Compacto 80mm**.

---

## 6. Resultados dos Testes Automatizados

O script `scripts/test_cash_register.mjs` executou a bateria completa de 10 testes com êxito:

```
=====================================================
🚀 INICIANDO TESTES DO MÓDULO DE CONTROLE DE CAIXA
=====================================================

🔹 Teste 1: Abertura e Fundo de Caixa Inicial
  ✅ Fundo inicial de R$ 150,00 registrado sem contabilizar como venda.

🔹 Teste 2: Venda em Dinheiro e Troco
  ✅ Troco de R$ 25,00 deduzido corretamente; entrada líquida de R$ 75,00.

🔹 Teste 3: Segregação de Pix, Cartão e Crediário do Caixa Físico
  ✅ Pix (R$ 120), Cartões (R$ 430) e Crediário (R$ 200) separados do dinheiro físico.

🔹 Teste 4: Pagamento Dividido (Dinheiro + Pix + Cartão)
  ✅ Pagamento dividido de R$ 300 processou exatamente R$ 100 para o caixa físico.

🔹 Teste 5: Movimentações (Suprimento, Sangria, Despesa)
  ✅ Dinheiro esperado calculado com perfeição: R$ 455.00

🔹 Teste 6: Fechamento Sem Divergência (Conferido)
  ✅ Caixa conferido: Contado R$ 455,00 == Esperado R$ 455,00 (Diferença: R$ 0,00)

🔹 Teste 7: Fechamento com Sobra de Caixa
  ✅ Sobra de Caixa detectada: +R$ 20,00 (status: surplus)

🔹 Teste 8: Fechamento com Falta de Caixa
  ✅ Falta de Caixa detectada: -R$ 25,00 (status: shortage)

🔹 Teste 9: Validação de Concorrência e Regra Anti-Duplicidade
  ✅ Regras de índice exclusivo e restrições de concorrência validadas com sucesso.

🔹 Teste 10: Bloqueio de Venda PDV Sem Caixa Aberto
  ✅ Validação de obrigatoriedade de caixa aberto antes da venda aprovada.

=====================================================
🎉 TODOS OS 10 TESTES DE CONTROLE DE CAIXA PASSARAM!
=====================================================
```
