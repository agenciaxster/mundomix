# DOCUMENTAÇÃO TÉCNICA — ETAPA 10: IMPRESSÃO DE COMPROVANTE NÃO FISCAL

Este documento detalha a implementação completa da **Etapa 10**, responsável pela emissão, pré-visualização interativa, formatação e impressão de comprovantes não fiscais de vendas realizadas no Ponto de Venda (PDV), com suporte nativo a impressoras térmicas comerciais nos formatos **80 mm** e **58 mm**.

---

## 1. Visão Geral da Arquitetura e Fluxo de Impressão

A emissão de comprovantes térmicos foi desenvolvida com foco em agilidade no balcão, fidelidade visual e isolamento de estilos, garantindo que os elementos da aplicação web (menus, modais, botões e cabeçalhos) não sejam impressos na bobina.

### 1.1 Fluxos Operacionais Suportados

1. **Impressão Instantânea Pós-Venda (Frente de Caixa / PDV)**:
   - Ao finalizar uma venda atômica no PDV (`PdvPage.tsx`), o operador visualiza o modal de sucesso (`SaleSuccessModal.tsx`).
   - O operador pode pressionar a tecla **`P`** ou clicar em **"Imprimir (P)"** para visualizar/imprimir o comprovante imediatamente.
   - Pressionar **`Enter`** continua iniciando uma "Nova Venda", sem interromper o ritmo ágil de atendimento de filas.

2. **Reimpressão pelo Histórico de Vendas (`/comercial/vendas`)**:
   - Na listagem de vendas (`SalesListPage.tsx`), cada linha da tabela dispõe de um botão de ação com ícone de impressora (`Printer`).
   - O operador ou gerente clica no ícone para abrir a pré-visualização completa com a marcação em destaque: `*** REIMPRESSÃO ***`.
   - Também disponível dentro do modal de detalhes da venda (`SaleDetailsModal.tsx`).

3. **Pré-visualização Interativa (`ReceiptPreviewModal.tsx`)**:
   - Apresenta uma réplica fiel da bobina térmica em tempo real.
   - Permite comutar dinamicamente entre **80 mm** e **58 mm**.
   - Permite alternar entre **1 via** ou **2 vias** (Cliente e Estabelecimento).
   - Permite personalizar a mensagem de rodapé e selecionar os campos visíveis.
   - Salvar as preferências selecionadas como padrão da empresa com um clique.

4. **Cancelamento Seguro**:
   - Pressionar `ESC` ou clicar em "Cancelar" fecha a janela de impressão sem qualquer efeito colateral: **a venda, o estoque, os pagamentos e orçamentos permanecem estritamente inalterados**.

---

## 2. Formatos e Especificações Técnicas das Bobinas

O sistema disponibiliza formatação monoespaçada de alto contraste (#000 puro sobre fundo branco), eliminando serrilhados e artefatos térmicos cinzas.

| Formato | Largura Física Nominal | Largura Útil Imprimível | Resolução Típica | Equipamentos Recomendados |
|---|---|---|---|---|
| **80 mm** | 80 mm (3.15") | ~72 mm (48 a 72 colunas) | 203 DPI | Epson TM-T20X, Elgin i9, Elgin i7, Bematech MP-4200 TH, Daruma DR800 |
| **58 mm** | 58 mm (2.28") | ~48 mm (32 a 36 colunas) | 203 DPI | Mini impressoras Bluetooth/USB, terminais POS portáteis, impressoras de 2 polegadas |

### 2.1 Estrutura e Diagramação do Comprovante

```
+------------------------------------------+
|          MUNDOMIX EXPRESS                | <- Nome Fantasia (configurável)
|    MundoMix Comércio Varejista Ltda      | <- Razão Social (se diferente)
|         CNPJ: 12.345.678/0001-95         | <- CNPJ formatado
| Rua das Flores, 123 - Centro, Palmas - TO| <- Endereço completo
|           Tel: (11) 98765-4321           | <- Telefone de contato
|         Filial: Centro (FL-01)           | <- Identificação da filial
|------------------------------------------|
|       *** COMPROVANTE NÃO FISCAL ***     | <- Destaque obrigatório
|   NÃO É DOCUMENTO FISCAL • SEM VALOR     |
|             [ 1ª VIA - CLIENTE ]         | <- Indicação de via (se 2 vias)
|------------------------------------------|
| VENDA: VND-001001    16/10/2026 09:30:15 | <- Código único e data/hora
| OPERADOR: Carlos Silva                   | <- Identificação do operador
| CLIENTE: Ana Maria / CPF: 123.456.789-00 | <- Cliente ou Consumidor Final
|------------------------------------------|
| # CÓD DESCRIÇÃO | QTD x UNIT = TOTAL     |
| 01 [CAF-001] Café Torrado Especial 500g  |
|    2 UN x R$ 25,00               R$ 50,00|
| 02 [FLT-002] Filtro de Papel Descartável |
|    1 CX x R$ 25,00 (-R$ 5,00)    R$ 20,00|
|------------------------------------------|
| QTD. TOTAL DE ITENS: 2 itens (3 un)      |
| SUBTOTAL:                        R$ 75,00|
| DESCONTO:                      - R$  5,00|
| TOTAL A PAGAR:                   R$ 70,00| <- Destaque em negrito
|------------------------------------------|
| FORMA(S) DE PAGAMENTO                    |
| Dinheiro:                        R$ 70,00|
|   Valor Recebido:               R$ 100,00|
| TROCO DEVOLVIDO:                 R$ 30,00| <- Troco destacado
|------------------------------------------|
| Obrigado pela preferência! Volte sempre! | <- Mensagem configurável
|   ERP MundoMix • Sistema Comercial e PDV |
+------------------------------------------+
```

---

## 3. Gestão de Configurações da Empresa

As preferências de impressão podem ser ajustadas em dois locais:
1. Diretamente no modal de impressão (`ReceiptPreviewModal.tsx`), através do botão "Salvar como Padrão da Empresa".
2. Na página dedicada de administração: **`Admin > Configurações da Empresa`** (`/admin/configuracoes-empresa`).

### 3.1 Parâmetros Disponíveis

- **`paper_width`**: Formato padrão da bobina (`'80mm'` ou `'58mm'`).
- **`copies_count`**: Quantidade de vias emitidas (`1` via única ou `2` vias com corte intermediário).
- **`show_trade_name`**: Exibir ou ocultar o Nome Fantasia no cabeçalho.
- **`show_legal_name`**: Exibir ou ocultar a Razão Social.
- **`show_cnpj`**: Exibir ou ocultar o CNPJ.
- **`show_phone`**: Exibir ou ocultar o telefone da unidade.
- **`show_address`**: Exibir ou ocultar o logradouro, número, bairro, cidade e CEP.
- **`show_operator`**: Exibir ou ocultar o nome do operador de caixa.
- **`show_customer`**: Exibir ou ocultar os dados do cliente (quando não informado, exibe "CONSUMIDOR FINAL").
- **`show_item_discounts`**: Exibir ou ocultar a discriminação de desconto concedido por item.
- **`footer_message`**: Mensagem de agradecimento configurável (texto livre).

### 3.2 Persistência e Fallback Seguro

- **Supabase**: Tabela relacional `public.company_receipt_settings` com isolamento multi-tenant via **Row Level Security (RLS)** (`public.user_has_company_access(company_id)` para visualização e `public.user_is_company_admin(company_id)` para modificação).
- **Fallback LocalStorage**: Caso a tabela ainda não tenha sido criada no console remoto do banco, o serviço armazena e recupera localmente no navegador (`erp_receipt_settings_<company_id>`), permitindo que a operação nunca seja interrompida.

---

## 4. Compatibilidade e Limitações

### 4.1 Mecanismo de Impressão via Iframe Isolado (`thermal-print.ts`)
A impressão não depende de drivers proprietários ou softwares pesados instalados localmente. O sistema injeta o comprovante formatado em um elemento `<iframe>` invisível e isolado do DOM da aplicação:
- As regras de `@page { margin: 0; size: auto; }` eliminam cabeçalhos de URL e rodapés de data do navegador.
- Não há vazamento de estilos do Tailwind CSS, sidebars, cabeçalhos ou scrollbars.
- Funciona em qualquer navegador moderno (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari e navegadores baseados em Chromium).

### 4.2 Recomendações de Configuração no Navegador
Na janela de diálogo de impressão do navegador:
1. **Destino / Impressora**: Selecionar a impressora térmica conectada (via USB, Ethernet/Rede ou Bluetooth).
2. **Margens**: Definir como **"Nenhuma" (None)**.
3. **Opções**: Desmarcar **"Cabeçalhos e rodapés"**.
4. **Tamanho do papel**: Selecionar `Roll Paper 80 x 297 mm` ou tamanho de bobina correspondente da impressora.

> **Nota:** A largura física final em milímetros depende da combinação de driver, spooler do sistema operacional e mecanismo de corte da impressora. O sistema garante o dimensionamento CSS milimétrico preciso (`72mm` e `48mm`).

---

## 5. Segurança e Integridade Operacional

- **Imutabilidade**: A reimpressão de comprovantes realiza estritamente consultas do tipo `SELECT`. Nenhuma baixa de estoque, movimentação financeira ou alteração de status é disparada ao imprimir.
- **Isolamento Multi-tenant**: A busca de detalhes da venda valida explicitamente a empresa ativa (`.eq('company_id', companyId)`). Não é possível emitir ou visualizar vendas pertencentes a outra empresa.
- **Carregamento Completo**: Ao solicitar impressão, o serviço `saleService.getSale(saleId, companyId)` recupera os itens faturados, formas de pagamento, troco e dados de endereço da filial cadastrada.

---

## 6. Resultados dos Testes Automatizados

Foi criada e executada uma suíte de testes automatizados (`scripts/test_receipt_features.mjs`) cobrindo todos os cenários solicitados:

1. **Formatadores e Máscaras**:
   - `formatCurrency`: formatação monetária padrão BRL (R$ 10,00, R$ 1.250,50).
   - `maskCnpj`, `maskCpf`, `maskPhone`: aplicação correta de pontuação brasileira.
2. **Layout 80 mm com 1 Pagamento e Troco**:
   - Cabeçalho, destaque `*** COMPROVANTE NÃO FISCAL ***`, produtos, cálculo de troco e rodapé validados.
3. **Layout 58 mm com 2 Pagamentos, 2 Vias e Nomes Longos**:
   - Quebra de linha em nomes extensos sem overflow horizontal.
   - Geração correta da 1ª via (Cliente) e 2ª via (Estabelecimento) com linha de corte tracejada intermediária.
   - Discriminação de múltiplas formas combinadas (Pix + Cartão de Crédito parcelado).
4. **Ocultação de Dados Ausentes**:
   - Ausência de palavras literais `null` ou `undefined`.
   - Omissão de linhas de telefone, CEP e documento quando não informados.
5. **Garantia de Imutabilidade**:
   - Venda submetida a múltiplas impressões sucessivas mantendo total, subtotal, pagamentos e itens 100% inalterados.
6. **Verificação de Compilação e Tipagem**:
   - `oxlint`: 0 erros encontrados.
   - `tsc -b`: 0 erros de tipagem estrita com TypeScript 6.
   - `vite build`: bundle de produção gerado com sucesso.

---

## 7. Arquivos Criados e Modificados

### Arquivos Criados
- `supabase/migrations/20261016000001_receipt_settings.sql`: Migration para persistência das preferências de impressão.
- `src/types/receipt.ts`: Definições TypeScript para formatos, configurações e dados imprimíveis.
- `src/lib/services/receipt-settings.service.ts`: Serviço de leitura/escrita com cache local e persistência remota.
- `src/lib/utils/thermal-print.ts`: Utilitário de disparo de impressão em iframe isolado.
- `src/features/pos/receipt/receipt-formatter.ts`: Motor de formatação de comprovantes em 80mm e 58mm.
- `src/features/pos/receipt/ThermalReceipt.tsx`: Componente visual de bobina térmica para pré-visualização.
- `src/features/pos/modals/ReceiptPreviewModal.tsx`: Modal interativo com controles rápidos e botão de impressão.
- `src/features/admin/settings/CompanySettingsPage.tsx`: Página administrativa de configurações de comprovante e empresa.
- `scripts/test_receipt_features.mjs`: Script de validação automatizada dos cenários de teste.
- `docs/IMPRESSAO_COMPROVANTES.md`: Documentação técnica completa da Etapa 10.

### Arquivos Modificados
- `src/features/pos/PdvPage.tsx`: Integração com pré-visualização, atalho `P` e abertura pós-venda.
- `src/features/pos/modals/SaleSuccessModal.tsx`: Adição do botão "Imprimir (P)" e atalho de teclado.
- `src/features/pos/modals/SaleDetailsModal.tsx`: Adição de botão para reimprimir comprovante.
- `src/features/pos/SalesListPage.tsx`: Adição de ação de impressão na tabela e integração com modal.
- `src/lib/services/sale.service.ts`: Enriquecimento da query `getSale` para incluir endereço completo da filial e operador.
- `src/app/router.tsx`: Registro da rota `/admin/configuracoes-empresa`.
- `src/app/navigation.ts`: Ativação do item de menu "Configurações da Empresa" como implementado.
- `src/index.css`: Regras `@media print` para supressão de elementos de interface na impressão.
