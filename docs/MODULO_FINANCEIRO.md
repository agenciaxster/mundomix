# Arquitetura e Consolidação do Módulo Financeiro

**Sistema:** ERP MundoMix  
**Módulo:** Gestão Financeira Integrada  
**Versão:** 2.0 (Consolidação e Expansão)  
**Tecnologias:** React, TypeScript, Vite, Tailwind CSS, PostgreSQL, Supabase  

---

## 1. Visão Geral e Resolução da Duplicidade

Anteriormente, o sistema exibia dois itens de menu e duas rotas com funcionalidades semelhantes:
- **Contas a Receber** (`/financeiro/contas-receber`)
- **Fiado e Crediário** (`/financeiro/crediario`)

Ambos apontavam para o mesmo componente `AccountsReceivablePage` e exibiam cards idênticos, criando duplicação visual e operacional desnecessária no menu lateral.

### Como a Duplicidade foi Resolvida:
1. **Página Oficial Unificada**: A rota `/financeiro/contas-receber` foi consolidada como o único destino oficial de todas as operações de **vendas a prazo, crediário, fiado, parcelas de clientes e liquidações**.
2. **Redirecionamento Suave**: A rota `/financeiro/crediario` foi mantida no roteador React (`<Navigate to="/financeiro/contas-receber" replace />`) para garantir compatibilidade com links legados e consultas no cadastro de clientes, sem criar uma página paralela.
3. **Limpeza do Menu Lateral**: O item redundante "Fiado e Crediário" foi removido da barra lateral de navegação.

---

## 2. Estrutura Consolidada do Menu Financeiro

O grupo **Financeiro** agora possui uma estrutura limpa, profissional e sem duplicidades:

```
Financeiro
├── Contas a Pagar        (/financeiro/contas-pagar)
├── Contas a Receber      (/financeiro/contas-receber)
└── Controle de Caixa     (/financeiro/caixa)
```

- **Contas a Pagar:** Gerencia todas as obrigações da própria empresa perante fornecedores, aluguel, concessionárias de serviços públicos, folha de pagamento, impostos e despesas operacionais.
- **Contas a Receber:** Centraliza todos os direitos financeiros a receber de clientes gerados no PDV via crediário/convênio ou lançados manualmente.
- **Controle de Caixa:** Monitora o fluxo operacional das gavetas dos operadores (abertura, suprimento, sangria, fechamento e conferência de caixa).

---

## 3. Integração com o Controle de Caixa

Para assegurar consistência absoluta no fechamento de caixa:
1. **Recebimento de Contas no Caixa**:
   - Se uma parcela de cliente for paga em dinheiro físico (`cash`) em uma filial com caixa aberto, o sistema registra um suprimento (`supply`) automaticamente.
   - Pagamentos recebidos via Pix ou Cartão são liquidados no financeiro sem movimentar o dinheiro físico em gaveta.
2. **Pagamento de Despesas no Caixa**:
   - Se uma conta a pagar for quitada com dinheiro do caixa em operação (`cash`), o sistema gera automaticamente uma movimentação de saída (`expense`) vinculada à sessão aberta.
   - Pagamentos realizados via transferência bancária, Pix ou boleto registram a quitação da conta sem deduzir indevidamente o saldo de gaveta do operador do PDV.

---

## 4. Segurança e Imutabilidade

- **RLS (Row Level Security)**: Isolamento total por `company_id` e permissões de filial via `user_company_access`.
- **Triggers de Auditoria**: As tabelas `receivable_payments` e `payable_payments` contam com triggers PostgreSQL que impedem operações de `UPDATE` ou `DELETE` em lançamentos confirmados.
- **Idempotência**: Requisições de pagamento utilizam chaves de idempotência (`idempotency_key`), prevenindo cobranças ou baixas duplicadas em caso de instabilidade de rede ou cliques múltiplos.
- **Divisão Exata em Centavos**: Todos os parcelamentos garantem que a soma das parcelas seja idêntica ao valor devido ($\sum \text{parcelas} \equiv \text{valor total}$), com qualquer diferença de arredondamento alocada na 1ª parcela.
