# Documentação Técnica — Etapa 13: Relatórios e Dashboards Gerenciais

O módulo de Relatórios e Dashboards Gerenciais do ERP MundoMix consolida dados reais do banco de dados relacional (PostgreSQL via Supabase), garantindo isolamento multitenant (RLS), consistência contábil e exportação nativa em Excel (.xlsx), CSV e Impressão (PDF).

---

## 1. Relatórios e Telas Implementadas

| Rota | Descrição | Origem dos Dados |
| :--- | :--- | :--- |
| `/` | **Dashboard Executivo**: Visão holística da empresa/filial, faturamento líquido, quantidade de pedidos, ticket médio, descontos, timeline de vendas diárias, meios de pagamento, conciliação e alertas críticos. | `sales`, `sale_payments`, `accounts_receivable`, `accounts_payable`, `branch_stock` |
| `/relatorios/vendas` | **Relatório Analítico de Vendas**: Consulta detalhada de cupons/pedidos emitidos, formas de pagamento, status de conclusão/cancelamento e abertura de itens da venda. | `sales`, `sale_payments`, `sale_items`, `profiles`, `branches` |
| `/relatorios/produtos` | **Produtos Mais Vendidos & Curva ABC**: Ranking por volume de saída e faturamento gerado, custo unitário e custo total estimado. | `sale_items`, `products`, `sales` |
| `/relatorios/estoque` | **Posição e Valoração de Estoque**: Saldos físicos, reservas, saldo disponível para venda, produtos abaixo do estoque mínimo, zerados e valoração contábil por custo cadastrado. | `branch_stock`, `products`, `branches` |
| `/relatorios/financeiro` | **Relatório Financeiro (Previsto vs Realizado)**: Recebimentos efetivos, pagamentos efetivos de despesas, saldos a receber/pagar em aberto e auditoria de fechamento de caixas (sobras/faltas). | `receivable_payments`, `payable_payments`, `accounts_receivable`, `accounts_payable`, `cash_sessions` |
| `/relatorios/desempenho-vendedores` | **Desempenho da Equipe Comercial**: Quantidade de vendas por operador, faturamento bruto, descontos concedidos, faturamento líquido e ticket médio. | `sales`, `profiles`, `branches` |

---

## 2. Fórmulas e Regras de Negócio dos Indicadores

### 2.1 Vendas e Faturamento
- **Faturamento Bruto**: $\sum \text{subtotal}$ de todas as vendas com `status = 'completed'` no período filtrado.
- **Descontos Concedidos**: $\sum \text{discount\_amount}$ das vendas concluídas.
- **Faturamento Líquido**: $\sum \text{total}$ das vendas concluídas (exclui cancelamentos).
- **Ticket Médio**: $\frac{\text{Faturamento Líquido}}{\text{Quantidade de Vendas Concluídas}}$.
- **Vendas Canceladas**: Apuradas em card e contador dedicados, **sem inflar** o faturamento líquido.
- **Crescimento vs Período Anterior**: $\frac{\text{Líquido Atual} - \text{Líquido Período Anterior}}{\text{Líquido Período Anterior}} \times 100$.

### 2.2 Distinção Financeira (Previsto vs Realizado)
- **Venda a Prazo (Crediário)**: Não é considerada dinheiro em caixa. Gera título em `accounts_receivable` e só é contabilizada como recurso realizado na quitação da parcela (`receivable_payments`).
- **Recebimentos Efetivos no Período**: $\sum \text{amount}$ de `receivable_payments` com `payment_date` no período.
- **Pagamentos Efetivos no Período**: $\sum \text{amount}$ de `payable_payments` com `payment_date` no período.
- **Títulos Vencidos**: Contas em aberto onde a data de vencimento é inferior à data corrente.

### 2.3 Estoque e Valoração
- **Saldo Disponível**: $\max(0, \text{quantity} - \text{reserved\_quantity})$.
- **Alerta de Estoque Baixo**: $\text{min\_stock} > 0 \land \text{quantity} < \text{min\_stock}$.
- **Alerta de Estoque Zerado**: $\text{quantity} \le 0$.
- **Valoração Estimada**: $\text{quantity} \times \text{cost\_price}$.
- **Tratamento de Custo Ausente**: Itens com custo zerado ou nulo são marcados como `"Não Informado / Sem Custo"` e contabilizados no card de advertência, evitando distorções contábeis fictícias.

### 2.4 Auditoria de Caixas (Sobras e Faltas)
- **Diferença de Caixa**: $\text{counted\_cash} - \text{expected\_cash}$.
  - Se $> 0$: **Sobra de caixa** (destacado em ciano).
  - Se $< 0$: **Falta de caixa** (destacado em vermelho/rosa com justificativa auditável).
  - Se $= 0$: **Caixa conferido perfeitamente**.

---

## 3. Filtros Consolidados (`ReportFilterBar`)

Todas as páginas de relatórios utilizam o componente `ReportFilterBar`, padronizando:
1. **Períodos Rápidos**: Hoje, Últimos 7 dias, Últimos 30 dias, Este Mês e Mês Passado.
2. **Intervalo Personalizado**: `dateFrom` e `dateTo` com seletores de data.
3. **Filtro de Filial**: Seleção de filial autorizada pelo perfil do usuário ou consolidação multiloja (`all`).
4. **Filtro de Vendedor**: Vínculo do operador registrado na venda (`sales.user_id`).
5. **Filtro de Forma de Pagamento**: Dinheiro, PIX, Cartão de Crédito, Débito, Crediário ou Outros.

---

## 4. Exportação e Impressão (`report-export.ts`)

- **Excel (.xlsx)**: Gera planilhas formatadas via `xlsx` com cabeçalho contendo nome da empresa, período, filtros aplicados e data/hora de extração.
- **CSV UTF-8**: Exporta com BOM (`\uFEFF`) e delimitador `;`, compatível diretamente com Excel brasileiro.
- **Impressão / PDF**: Dispara estilização limpa para diálogo nativo do navegador via `window.print()`.

---

## 5. Testes Automatizados Executados

Executado o script `scripts/test_reports_module.mjs`:
- ✅ Teste 1: Diferenciação entre Bruto, Desconto e Líquido (exclusão de canceladas).
- ✅ Teste 2: Cálculo de Crescimento vs Período Anterior (+45%).
- ✅ Teste 3: Distribuição Percentual de Formas de Pagamento.
- ✅ Teste 4: Não Equivalência entre Venda a Prazo e Dinheiro em Caixa.
- ✅ Teste 5: Valoração de Estoque e Identificação de Custo Ausente.
- ✅ Teste 6: Auditoria de Fechamento de Caixa (Apuração de Sobras/Faltas).
- ✅ Validação de Build: `npm run build` compilado com 0 erros.
