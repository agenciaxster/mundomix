# ETAPA 7 — CADASTRO DE CLIENTES E LIMITES DE CRÉDITO

## 1. VISÃO GERAL DA ARQUITETURA

O módulo de **Clientes e Limites de Crédito** do ERP MundoMix estabelece o cadastro unificado de pessoas físicas e jurídicas por empresa, integrando políticas de crédito, auditoria imutável de limites concedidos e compartilhamento operacional entre todas as filiais do grupo empresarial.

---

## 2. REGRAS DE MULTIEMPRESA E COMPARTILHAMENTO ENTRE FILIAIS

- **Escopo Centralizado na Empresa (`company_id`)**:  
  O cadastro do cliente pertence diretamente à empresa (`companies.id`), e não a uma filial isolada.  
  *Justificativa*: Evita a duplicação do mesmo cliente em cada unidade, unifica o histórico comercial e centraliza a concessão e consumo do limite de crédito. Um cliente cadastrado na Matriz pode comprar ou ter crédito consultado na Filial 1 sem atrito e sem duplicidade de limite.
- **Rastreabilidade da Filial de Origem (`origin_branch_id`)**:  
  Cada cliente pode registrar a filial de atendimento/captação original onde realizou o primeiro contato ou compra.
- **Unicidade de Documento**:  
  O CPF ou CNPJ é validado matematicamente com dígitos verificadores e possui índice único por empresa:
  `CREATE UNIQUE INDEX uq_customers_company_document ON public.customers (company_id, document) WHERE document IS NOT NULL AND document <> '';`

---

## 3. MODELO DE DADOS

### 3.1 Tabela `public.customers` (Cadastro Unificado)
- `id` (UUID, Chave Primária)
- `company_id` (UUID, FK `companies.id` ON DELETE CASCADE)
- `origin_branch_id` (UUID, FK `branches.id` ON DELETE SET NULL)
- `person_type` (`individual` | `company`, PF ou PJ)
- `name` (VARCHAR, Nome completo ou Razão Social)
- `trade_name` (VARCHAR, Nome Fantasia para PJ ou apelido)
- `document` (VARCHAR, CPF ou CNPJ limpo apenas com dígitos)
- `state_registration` (VARCHAR, Inscrição Estadual ou RG)
- `email` (VARCHAR, E-mail para faturamento e cobrança)
- `phone` / `whatsapp` (VARCHAR, Telefones de contato com formatação)
- `zip_code`, `street`, `number`, `complement`, `neighborhood`, `city`, `state` (Endereço com preenchimento automático por CEP)
- `credit_limit` (NUMERIC(12, 2), limite de crédito concedido >= 0)
- `credit_status` (`available` | `blocked` | `under_review`, situação do crédito)
- `status` (`active` | `inactive`, soft delete operacional)
- `notes` (TEXT, observações comerciais e restrições)
- `created_by` (UUID, FK `auth.users(id)`)
- `created_at` / `updated_at` (TIMESTAMPTZ)

### 3.2 Tabela `public.customer_credit_history` (Log Auditável e Imutável)
- `id` (UUID, Chave Primária)
- `company_id` (UUID, FK `companies.id`)
- `customer_id` (UUID, FK `customers.id` ON DELETE CASCADE)
- `previous_limit` (NUMERIC(12, 2), valor anterior)
- `new_limit` (NUMERIC(12, 2), novo valor concedido)
- `reason` (TEXT, justificativa obrigatória)
- `user_id` (UUID, FK `auth.users(id)`)
- `created_at` (TIMESTAMPTZ)
- **Trigger de Proteção**: `prevent_credit_history_mutation` impede qualquer `UPDATE` ou `DELETE` nesta tabela, garantindo rastreabilidade pericial.

---

## 4. REGRAS E GESTÃO DO LIMITE DE CRÉDITO

1. **Fórmula de Crédito Disponível**:  
   $$\text{Crédito Disponível} = \text{Limite de Crédito Concedido} - \text{Compromissos Financeiros em Aberto}$$
2. **Saldo Utilizado Transparente**:  
   Nesta etapa, como as vendas a prazo e o módulo de contas a receber ainda não foram implantados, o saldo utilizado é apresentado com total transparência como **R$ 0,00**, sem dados fictícios.
3. **Transação Atômica via PostgreSQL**:  
   A alteração de limite de crédito é realizada exclusivamente através da função RPC `update_customer_credit_limit`, que:
   - Bloqueia a linha do cliente com `FOR UPDATE`.
   - Valida se o novo limite é $\ge 0$.
   - Exige justificativa textual obrigatória.
   - Grava o histórico de auditoria e atualiza o cadastro atomicamente.

---

## 5. POLÍTICAS DE SEGURANÇA (RLS)

- **`customers`**:
  - `SELECT`: Permitido para qualquer usuário autenticado com acesso à empresa correspondente (`user_has_company_access(company_id)`).
  - `INSERT / UPDATE`: Usuários autorizados na empresa com permissão no módulo comercial (`sales`).
  - `DELETE`: Restrito a administradores e proprietários da empresa (`user_is_company_admin(company_id)`).
- **`customer_credit_history`**:
  - `SELECT`: Usuários com acesso à empresa.
  - `INSERT`: Via função RPC atômica (`SECURITY DEFINER`) ou admins.
  - `UPDATE / DELETE`: Bloqueados no RLS e no trigger.

---

## 6. TELAS E COMPONENTES IMPLEMENTADOS

1. **Listagem de Clientes (`/cadastros/clientes`)**:
   - 4 Cards com KPIs reais da base: Total de clientes, Clientes ativos, Clientes com limite de crédito e Crédito total concedido.
   - Filtros dinâmicos: Busca textual com debounce por nome, documento ou telefone; filtro por tipo (PF/PJ), status e situação de crédito.
   - Tabela com ações rápidas para Ajuste de Crédito, Edição cadastral e Inativação/Ativação.
   - Paginação completa.

2. **Formulário de Cadastro e Edição (`/cadastros/clientes/novo` e `/cadastros/clientes/:id`)**:
   - Alternância fluida entre Pessoa Física e Jurídica.
   - Validação matemática de CPF e CNPJ com máscaras aplicadas.
   - Consulta e preenchimento de endereço automático via CEP (ViaCEP).
   - Definição de limite de crédito inicial e filial de atendimento.

3. **Modal de Ajuste de Limite de Crédito (`CreditLimitModal`)**:
   - Apresentação da posição de crédito (concedido, utilizado e disponível).
   - Alteração com justificativa obrigatória e seletor de status do crédito.
   - Histórico em tempo real de alterações anteriores com data e motivo.

---

## 7. COMO APLICAR A MIGRATION NO SUPABASE

Abra o painel do seu projeto Supabase, acesse o **SQL Editor** e execute o script localizado em:
`supabase/migrations/20261014000007_customers_and_credit_limits.sql`

---

## 8. PENDÊNCIAS PARA A FUTURA INTEGRAÇÃO FINANCEIRA (ETAPAS POSTERIORES)

- Na etapa de **PDV / Vendas a Prazo (Crediário)**, a finalização de uma venda no crediário deverá invocar uma validação no backend que consome o saldo de `credit_limit`.
- Na etapa de **Contas a Receber**, a liquidação ou quitação de títulos baixará o compromisso em aberto do cliente, recompondo automaticamente seu crédito disponível.

---

## 9. CONFIRMAÇÃO DO ESCOPO

- **Etapa 7**: Concluída com sucesso.
- **Etapa 8**: **NÃO INICIADA** (aguardando autorização do usuário).
