# DOCUMENTAÇÃO TÉCNICA — ETAPA 9: PONTO DE VENDA (PDV), PAGAMENTOS E FINALIZAÇÃO DE VENDAS

Este documento detalha a implementação completa da **Etapa 9**, responsável pela operação de frente de caixa e Ponto de Venda (PDV), incluindo seleção de produtos via leitor de código de barras ou catálogo, suporte a multiplicadores de quantidade, regras automáticas de atacado vs varejo, múltiplas formas de pagamento (1 ou 2 combinadas), cálculo em tempo real de troco, prevenção contra duplicidade por idempotência, baixa de estoque atômica com auditoria imutável e integração consistente com orçamentos comerciais prévios.

---

## 1. Visão Geral da Arquitetura e Fluxo de Venda

### 1.1 Terminal de Vendas Rápido (`/comercial/pdv`)
Projetado para máxima agilidade operacional no balcão e em computadores de caixa com leitor de código de barras USB (emulação de teclado):

1. **Identificação e Contexto**:
   - Exibe a empresa ativa (`activeCompany`) e a filial operacional (`activeBranch`).
   - Apresenta o nome do operador de caixa autenticado e seu perfil de acesso (`activeRole`).
   - Relógio em tempo real com segundos e status do caixa ("Operacional / Caixa Aberto").
   - Suporte a modo tela cheia (`Fullscreen`) com atalho visual.

2. **Entrada de Produtos com Foco Contínuo**:
   - Campo dedicado de leitura de código de barras (`barcodeRef.current?.focus()`).
   - **Leitor de Código de Barras USB**: Lê código EAN/SKU e insere com pressionamento automático de Enter.
   - **Sintaxe de Multiplicador Rápido**: O operador pode digitar `3*789001` para adicionar diretamente 3 unidades do produto de uma só vez sem precisar usar o mouse.
   - **Scanner por Câmera**: Botão integrado com leitor de QR Code e código de barras via webcam ou câmera do dispositivo (`QrCameraScannerModal`).
   - **Modal de Catálogo com Navegação por Teclado (`F2`)**: Permite pesquisar produtos por nome, marca ou SKU, navegando com as setas `↑` e `↓` e selecionando com `Enter`.

3. **Carrinho de Compras e Regra de Varejo vs Atacado**:
   - Cada item adicionado acumula sua quantidade no carrinho.
   - **Aplicação Automática da Regra de Atacado**: Se a quantidade acumulada do item atingir a quantidade mínima configurada no produto (`wholesale_min_qty`) ou o padrão de 5 unidades, o preço unitário comuta automaticamente para `wholesale_price` e exibe o badge visual "Preço Atacado". Caso a quantidade seja reduzida para baixo do limite, retorna imediatamente para `sale_price` (Varejo).
   - Validação visual de saldo da filial: Alerta caso a quantidade solicitada exceda o estoque disponível na filial ativa (`branch_stock.quantity`).
   - Controles de quantidade rápidos (`+` e `-`), campo numérico direto e botão de exclusão de item.

4. **Identificação do Cliente (`F4`)**:
   - Permite venda rápida a **Consumidor Final (Não Identificado)** por padrão.
   - Permite pesquisar e vincular clientes da base, exibindo limite de crédito e situação financeira.
   - Permite informar Nome e CPF avulso na nota quando solicitado.

5. **Formas de Pagamento e Troco (`F10`)**:
   - Suporta liquidar o valor total em **1 forma** ou **dividir em 2 formas** de pagamento.
   - Métodos suportados: **Dinheiro (`cash`)**, **Pix (`pix`)**, **Cartão de Débito (`debit_card`)**, **Cartão de Crédito (`credit_card`)**, **Crediário / Convênio (`store_credit`)** e **Outros (`other`)**.
   - Para pagamentos em dinheiro, dispõe de atalhos rápidos de cédulas (+R$10, +R$20, +R$50, +R$100, +R$200 e "Valor Exato").
   - O troco é calculado e exibido em tempo real em destaque no modal.
   - O sistema valida no frontend e no backend que a soma exata dos pagamentos corresponde ao total líquido da venda (tolerância de arredondamento de até 1 centavo).

6. **Feedback e Reset Instantâneo**:
   - Após a conclusão da venda, exibe modal de confirmação com o identificador (`VND-001001`), valor pago, troco entregue e operador.
   - Pressionar `Enter` fecha o modal, limpa o carrinho e devolve o foco imediatamente para o campo de código de barras para o próximo cliente da fila.
   - Conforme especificação da Etapa 9, **não** foi implementada a impressão de comprovantes, funcionalidade reservada para a Etapa 10.

---

## 2. Regras de Preços, Descontos e Pagamentos

### 2.1 Regra de Preços (Varejo x Atacado)
- **Varejo**: Aplicado por padrão utilizando o valor `sale_price` do produto.
- **Atacado**: Se o produto possuir `wholesale_price > 0`:
  - Se possuir `wholesale_min_qty > 0`, aplica atacado quando `quantidade >= wholesale_min_qty`.
  - Se `wholesale_min_qty` for nulo ou zero, aplica atacado quando `quantidade >= 5` unidades (regra padrão do projeto).
- O backend **recalcula** os preços e o tipo de preço de cada item na função RPC `finalize_pos_sale`, impedindo que alterações maliciosas no navegador adulterem os preços unitários.

### 2.2 Descontos
- Desconto por item: Deduzido do subtotal do item.
- Desconto geral da venda: Em percentual (`%`) ou valor monetário (`R$`).
- O backend valida que descontos negativos não sejam aceitos e que o desconto nunca exceda o subtotal da venda.

### 2.3 Pagamentos e Troco
- Mínimo de 1 e máximo de 2 formas de pagamento por transação.
- Para pagamentos em dinheiro: `received_amount >= amount`, sendo `change_amount = received_amount - amount`.
- Se o modo dividido (`split`) for acionado: `amount_1 + amount_2 == total_venda`.
- Se houver divergência, o botão de confirmação é bloqueado no frontend e rejeitado pelo backend com mensagem de erro explicativa.

---

## 3. Estrutura do Banco de Dados e Migrations

Migration criada: [`supabase/migrations/20261015000004_pos_sales_and_payments.sql`](file:///c:/Users/Xster%20Software%20House/Desktop/erp-mundomix/supabase/migrations/20261015000004_pos_sales_and_payments.sql)

### 3.1 Tabela `public.sales` (Cabeçalho da Venda)
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador único da venda |
| `company_id` | UUID (FK) | Empresa detentora da transação |
| `branch_id` | UUID (FK) | Filial física onde ocorreu a venda |
| `user_id` | UUID (FK) | Operador de caixa responsável (`auth.users`) |
| `customer_id` | UUID (FK) | Cliente cadastrado (opcional) |
| `customer_name` | VARCHAR(255) | Nome do cliente ou consumidor final |
| `customer_document` | VARCHAR(30) | CPF/CNPJ informado na venda |
| `sale_number` | BIGINT | Número sequencial gerado via sequence `sale_number_seq` |
| `code` | VARCHAR(50) | Código formatado da venda (Ex: `VND-001001`) |
| `status` | VARCHAR(20) | Situação (`completed`, `cancelled`) |
| `subtotal` | NUMERIC(12, 2) | Soma dos itens antes de descontos globais |
| `discount_type` | VARCHAR(10) | Tipo de desconto (`percentage` ou `value`) |
| `discount_value` | NUMERIC(12, 2) | Valor informado do desconto |
| `discount_amount` | NUMERIC(12, 2) | Montante monetário do desconto aplicado |
| `total` | NUMERIC(12, 2) | Valor líquido total da venda |
| `payment_amount` | NUMERIC(12, 2) | Total pago pelo cliente |
| `change_amount` | NUMERIC(12, 2) | Troco devolvido ao cliente |
| `quote_id` | UUID (FK) | Orçamento comercial de origem (se houver) |
| `idempotency_key` | VARCHAR(100) | Chave única para evitar vendas duplicadas |
| `notes` | TEXT | Observações da venda |
| `created_at` | TIMESTAMPTZ | Data e hora de faturamento |
| `updated_at` | TIMESTAMPTZ | Data e hora da última modificação |

### 3.2 Tabela `public.sale_items` (Itens Faturados)
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador do item |
| `sale_id` | UUID (FK) | Venda à qual o item pertence |
| `company_id` | UUID (FK) | Empresa do item |
| `branch_id` | UUID (FK) | Filial da venda |
| `product_id` | UUID (FK) | Produto faturado (`products`) |
| `product_name` | VARCHAR(255) | Snapshot do nome do produto |
| `product_sku` | VARCHAR(100) | Snapshot do SKU |
| `product_barcode` | VARCHAR(100) | Snapshot do código de barras |
| `unit` | VARCHAR(20) | Unidade de medida (UN, CX, KG, etc) |
| `quantity` | NUMERIC(12, 3) | Quantidade faturada (> 0) |
| `unit_price` | NUMERIC(12, 2) | Preço unitário validado pelo backend |
| `cost_price` | NUMERIC(12, 2) | Custo do produto no momento da venda |
| `price_type` | VARCHAR(20) | Regra aplicada (`retail`, `wholesale`, `custom`) |
| `discount` | NUMERIC(12, 2) | Desconto concedido no item |
| `subtotal` | NUMERIC(12, 2) | Quantidade * Preço unitário |
| `total` | NUMERIC(12, 2) | Subtotal - Desconto |

### 3.3 Tabela `public.sale_payments` (Formas de Pagamento)
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador do pagamento |
| `sale_id` | UUID (FK) | Venda faturada |
| `company_id` | UUID (FK) | Empresa |
| `payment_method` | VARCHAR(30) | Método (`cash`, `pix`, `credit_card`, `debit_card`, `store_credit`, `other`) |
| `amount` | NUMERIC(12, 2) | Valor destinado a esta forma (> 0) |
| `received_amount` | NUMERIC(12, 2) | Valor entregue pelo cliente (para cálculo de troco) |
| `change_amount` | NUMERIC(12, 2) | Troco correspondente a este pagamento |
| `installments` | INTEGER | Número de parcelas (para cartão de crédito) |

---

## 4. Segurança e Políticas RLS (Row Level Security)

Todas as tabelas novas possuem RLS ativo com checagem de multi-empresa:
- `sales`:
  - `SELECT`: Apenas usuários autenticados com acesso ativo à empresa (`public.user_has_company_access(company_id)`).
  - `INSERT`: Usuários autenticados com acesso à empresa.
  - `UPDATE` e `DELETE`: Restrito a administradores da empresa (`public.user_is_company_admin(company_id)`).
- `sale_items`: Protegido por RLS com validação de vínculo com a venda e acesso à empresa.
- `sale_payments`: Protegido por RLS com validação de acesso à empresa.

---

## 5. Finalização Atômica e Baixa de Estoque (RPC `finalize_pos_sale`)

A finalização da venda é processada no banco de dados através da função com privilégios `SECURITY DEFINER` **`public.finalize_pos_sale`**:

1. **Validação do Operador**:
   - Confirmação de usuário autenticado (`auth.uid()`).
   - Confirmação de permissão para operar na filial e na empresa.
2. **Idempotência**:
   - Se for fornecida uma `p_idempotency_key` e ela já constar na tabela `sales` da empresa, a transação retorna os dados da venda previamente processada sem duplicar registros ou baixar estoque novamente.
3. **Bloqueio Concorrência-Seguro (FOR UPDATE)**:
   - Para cada item da venda, o registro em `public.branch_stock` é selecionado com `FOR UPDATE`.
   - Se `current_stock < requested_quantity`, o banco emite uma exceção abortando a transação inteira:
     `Estoque insuficiente para o produto "X". Saldo disponível na filial: Y, Solicitado: Z`.
4. **Baixa do Saldo em `branch_stock`**:
   - O saldo da filial é decrementado de forma exata: `quantity = quantity - requested_quantity`.
5. **Auditoria Imutável em `stock_movements`**:
   - É inserido um registro de movimentação de saída (`movement_type = 'exit'`), registrando saldo anterior, saldo posterior, motivo (`Venda PDV VND-001001`), `reference_id = sale.id` e `user_id = auth.uid()`.
6. **Conversão de Orçamento Vinculado**:
   - Se a venda foi iniciada a partir de um orçamento (`p_quote_id`), o status do orçamento é atualizado atomicamente para `status = 'converted'`, `converted_at = now()` e `converted_to_sale_id = sale.id`, gerando o registro histórico em `quote_status_history`.
7. **Atomicidade Total**:
   - Todo o processo ocorre em uma transação única do PostgreSQL. Qualquer falha (saldo insuficiente, divergência de pagamentos, erro em item) reverte (`ROLLBACK`) integralmente todas as alterações.

---

## 6. Integração com Orçamentos Comerciais (Etapa 8)

1. **No PDV**:
   - Atalho **`F8`** ou botão "Orçamento (F8)" abre o modal de importação `ImportQuoteModal`.
   - Lista orçamentos da filial em aberto (`draft`, `sent`, `approved`).
   - Ao selecionar, carrega automaticamente o cliente, itens, descontos e valida novamente o estoque e os preços atuais na filial.
2. **Na Lista de Orçamentos (`/comercial/orcamentos`)**:
   - Cada linha de orçamento não convertido possui agora o botão de ação rápida **`Faturar no PDV`** (ícone da calculadora), redirecionando para `/comercial/pdv?quote_id=...`.
3. **No Detalhe do Orçamento (`QuoteDetailsModal`)**:
   - Botão em destaque verde **`Faturar no PDV`** para converter a proposta aprovada imediatamente em venda no caixa.
4. **Proteção contra Dupla Conversão**:
   - Se o orçamento já foi convertido anteriormente (`status == 'converted'`), a função RPC impede nova conversão com a mensagem: `"Este orçamento já foi convertido em venda anteriormente."`.

---

## 7. Telas e Histórico de Vendas

1. **Tela do PDV (`/comercial/pdv`)**:
   - Disponível no menu lateral em `Comercial -> PDV (Frente de Caixa)`.
   - Interface imersiva, moderna, com tema escuro e responsiva.
2. **Histórico de Vendas Faturadas (`/comercial/vendas`)**:
   - Disponível em `Comercial -> Vendas`.
   - KPIs do dia: Total Faturado Hoje, Quantidade de Vendas, Ticket Médio e Distribuição por Forma de Pagamento (Dinheiro, Pix, Cartão).
   - Filtros por Filial, Período de Datas e Pesquisa textual por código/cliente.
   - Modal com visão completa da venda, itens e pagamentos (`SaleDetailsModal`).

---

## 8. Testes Executados e Resultados

| Teste | Descrição | Resultado |
|---|---|---|
| **Compilação TypeScript** | `npx tsc --noEmit` executado em todo o projeto | **Aprovado (0 erros)** |
| **Análise Estática (Linter)** | `npm run lint` (`oxlint`) | **Aprovado (0 erros)** |
| **Build de Produção** | `npm run build` (`tsc -b && vite build`) | **Aprovado** |
| **Adição e Multiplicador** | Adição via código, SKU e sintaxe `3*CODIGO` | **Aprovado** |
| **Comutação Varejo/Atacado** | Quantidade atingindo limite de atacado comuta preço automaticamente | **Aprovado** |
| **Pagamento Integral (1 forma)** | Finalização em Dinheiro com troco e em Pix/Cartão | **Aprovado** |
| **Pagamento Dividido (2 formas)** | Divisão entre 2 formas (ex: R$40 Pix + R$60 Dinheiro com troco) | **Aprovado** |
| **Validação de Divergência** | Bloqueio de finalização se pagamentos != total da venda | **Aprovado** |
| **Idempotência** | Bloqueio de cliques duplos com geração de UUID idempotency_key | **Aprovado** |
| **Importação de Orçamento** | Carregamento de orçamento prévio e conversão consistente | **Aprovado** |
