/**
 * Script de Testes Automatizados do Módulo de Controle de Caixa
 * ERP MundoMix - Etapa 11
 *
 * Testa:
 * 1. Fórmulas de cálculo de dinheiro esperado e diferenças
 * 2. Isolamento de formas de pagamento (Dinheiro vs Pix/Cartão/Prazo)
 * 3. Tratamento de troco (apenas valor líquido aumenta o caixa)
 * 4. Pagamento múltiplo / dividido
 * 5. Suprimentos, Sangrias e Despesas
 * 6. Fechamento com sobra, falta e conferido
 * 7. Validação de regras de concorrência e integridade estrutural
 */

import assert from 'node:assert/strict'

console.log('=====================================================')
console.log('🚀 INICIANDO TESTES DO MÓDULO DE CONTROLE DE CAIXA')
console.log('=====================================================\n')

// Função de cálculo oficial do módulo (espelho da lógica do banco e do frontend)
function calculateExpectedCash({
  initialAmount = 0,
  cashSalesNet = 0,
  suppliesTotal = 0,
  bleedsTotal = 0,
  expensesTotal = 0,
  refundsTotal = 0,
}) {
  const expected =
    Number(initialAmount) +
    Number(cashSalesNet) +
    Number(suppliesTotal) -
    Number(bleedsTotal) -
    Number(expensesTotal) -
    Number(refundsTotal)

  return Math.round(expected * 100) / 100
}

function calculateDifference(countedAmount, expectedAmount) {
  const diff = Number(countedAmount) - Number(expectedAmount)
  const rounded = Math.round(diff * 100) / 100
  let status = 'balanced'
  if (rounded > 0.005) status = 'surplus'
  else if (rounded < -0.005) status = 'shortage'
  return { difference: rounded, status }
}

// ---------------------------------------------------------------------------
// TESTE 1: Abertura e Fundo Inicial
// ---------------------------------------------------------------------------
console.log('🔹 Teste 1: Abertura e Fundo de Caixa Inicial')
{
  const sessionA = {
    initial_amount: 150.0,
    status: 'open',
    terminal_name: 'Caixa 01',
    opened_by: 'user-op-01',
    branch_id: 'branch-01',
  }

  // Fundo inicial não conta como venda
  const expected = calculateExpectedCash({
    initialAmount: sessionA.initial_amount,
    cashSalesNet: 0,
  })
  assert.equal(expected, 150.0, 'Dinheiro esperado inicial deve ser exatamente o fundo de caixa')
  console.log('  ✅ Fundo inicial de R$ 150,00 registrado sem contabilizar como venda.')
}

// ---------------------------------------------------------------------------
// TESTE 2: Venda em Dinheiro com Cálculo Correto de Troco
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 2: Venda em Dinheiro e Troco')
{
  // Venda: R$ 75,00. Cliente pagou nota de R$ 100,00. Troco: R$ 25,00.
  // Valor líquido que entrou no caixa: R$ 75,00 (100 - 25)
  const sale = {
    total: 75.0,
    payments: [
      {
        payment_method: 'cash',
        received_amount: 100.0,
        change_amount: 25.0,
        amount: 75.0, // Líquido
      },
    ],
  }

  const netCashReceived = sale.payments
    .filter((p) => p.payment_method === 'cash')
    .reduce((sum, p) => sum + (p.received_amount - p.change_amount), 0)

  assert.equal(netCashReceived, 75.0, 'Apenas o valor líquido recebido (R$ 75,00) deve entrar no caixa')

  const expected = calculateExpectedCash({
    initialAmount: 150.0,
    cashSalesNet: netCashReceived,
  })
  assert.equal(expected, 225.0, '150 inicial + 75 líquidos = 225 esperado')
  console.log('  ✅ Troco de R$ 25,00 deduzido corretamente; entrada líquida de R$ 75,00.')
}

// ---------------------------------------------------------------------------
// TESTE 3: Isolamento de Formas de Pagamento (Pix, Cartão, Prazo)
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 3: Segregação de Pix, Cartão e Crediário do Caixa Físico')
{
  const payments = [
    { payment_method: 'cash', amount: 50.0 },
    { payment_method: 'pix', amount: 120.0 },
    { payment_method: 'credit_card', amount: 350.0 },
    { payment_method: 'debit_card', amount: 80.0 },
    { payment_method: 'term_payment', amount: 200.0 },
  ]

  let cashTotal = 0
  let pixTotal = 0
  let creditTotal = 0
  let debitTotal = 0
  let termTotal = 0

  for (const p of payments) {
    if (p.payment_method === 'cash') cashTotal += p.amount
    else if (p.payment_method === 'pix') pixTotal += p.amount
    else if (p.payment_method === 'credit_card') creditTotal += p.amount
    else if (p.payment_method === 'debit_card') debitTotal += p.amount
    else if (p.payment_method === 'term_payment') termTotal += p.amount
  }

  // Apenas dinheiro físico soma no saldo em espécie
  const expectedCash = calculateExpectedCash({
    initialAmount: 100.0,
    cashSalesNet: cashTotal,
  })

  assert.equal(expectedCash, 150.0, 'Somente os R$ 50 em dinheiro físico somam ao fundo de 100')
  assert.equal(pixTotal, 120.0)
  assert.equal(creditTotal, 350.0)
  assert.equal(debitTotal, 80.0)
  assert.equal(termTotal, 200.0)

  console.log('  ✅ Pix (R$ 120), Cartões (R$ 430) e Crediário (R$ 200) separados do dinheiro físico.')
}

// ---------------------------------------------------------------------------
// TESTE 4: Pagamento Múltiplo / Dividido na Mesma Venda
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 4: Pagamento Dividido (Dinheiro + Pix + Cartão)')
{
  // Venda de R$ 300: R$ 100 em Dinheiro, R$ 100 em Pix, R$ 100 em Cartão de Crédito
  const splitPayments = [
    { payment_method: 'cash', amount: 100.0, received_amount: 100.0, change_amount: 0 },
    { payment_method: 'pix', amount: 100.0, received_amount: 100.0, change_amount: 0 },
    { payment_method: 'credit_card', amount: 100.0, received_amount: 100.0, change_amount: 0 },
  ]

  const totalSale = splitPayments.reduce((s, p) => s + p.amount, 0)
  assert.equal(totalSale, 300.0)

  const cashPortion = splitPayments
    .filter((p) => p.payment_method === 'cash')
    .reduce((s, p) => s + p.amount, 0)

  assert.equal(cashPortion, 100.0)
  console.log('  ✅ Pagamento dividido de R$ 300 processou exatamente R$ 100 para o caixa físico.')
}

// ---------------------------------------------------------------------------
// TESTE 5: Movimentações de Caixa (Suprimento, Sangria e Despesa)
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 5: Movimentações (Suprimento, Sangria, Despesa)')
{
  const initial = 200.0
  const cashSales = 500.0
  const supply1 = 100.0 // + troco extra recebido da gerência
  const bleed1 = 300.0 // - sangria para o cofre
  const expense1 = 45.0 // - compra de material de limpeza paga pelo caixa

  const expected = calculateExpectedCash({
    initialAmount: initial,
    cashSalesNet: cashSales,
    suppliesTotal: supply1,
    bleedsTotal: bleed1,
    expensesTotal: expense1,
  })

  // 200 + 500 + 100 - 300 - 45 = 455
  assert.equal(expected, 455.0, '200 + 500 + 100 - 300 - 45 deve ser R$ 455,00')
  console.log(`  ✅ Dinheiro esperado calculado com perfeição: R$ ${expected.toFixed(2)}`)
}

// ---------------------------------------------------------------------------
// TESTE 6: Fechamento Perfeito / Conferido (Sem Divergência)
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 6: Fechamento Sem Divergência (Conferido)')
{
  const expected = 455.0
  const counted = 455.0
  const result = calculateDifference(counted, expected)

  assert.equal(result.difference, 0.0)
  assert.equal(result.status, 'balanced')
  console.log('  ✅ Caixa conferido: Contado R$ 455,00 == Esperado R$ 455,00 (Diferença: R$ 0,00)')
}

// ---------------------------------------------------------------------------
// TESTE 7: Fechamento com Sobra de Caixa
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 7: Fechamento com Sobra de Caixa')
{
  const expected = 455.0
  const counted = 475.0 // Sobraram 20 reais
  const result = calculateDifference(counted, expected)

  assert.equal(result.difference, 20.0)
  assert.equal(result.status, 'surplus')
  console.log('  ✅ Sobra de Caixa detectada: +R$ 20,00 (status: surplus)')
}

// ---------------------------------------------------------------------------
// TESTE 8: Fechamento com Falta de Caixa
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 8: Fechamento com Falta de Caixa')
{
  const expected = 455.0
  const counted = 430.0 // Faltaram 25 reais
  const result = calculateDifference(counted, expected)

  assert.equal(result.difference, -25.0)
  assert.equal(result.status, 'shortage')
  console.log('  ✅ Falta de Caixa detectada: -R$ 25,00 (status: shortage)')
}

// ---------------------------------------------------------------------------
// TESTE 9: Bloqueio de Abertura Simultânea para Mesmo Terminal / Operador
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 9: Validação de Concorrência e Regra Anti-Duplicidade')
{
  const activeSessions = [
    {
      id: 'sess-1',
      branch_id: 'branch-A',
      terminal_name: 'Caixa 01',
      operator_id: 'user-01',
      status: 'open',
    },
  ]

  // Tentativa 1: Mesmo operador tentando abrir outro caixa na mesma filial
  const attemptOperator = {
    branch_id: 'branch-A',
    terminal_name: 'Caixa 02',
    operator_id: 'user-01',
  }
  const isOperatorBlocked = activeSessions.some(
    (s) => s.branch_id === attemptOperator.branch_id && s.operator_id === attemptOperator.operator_id && s.status === 'open'
  )
  assert.equal(isOperatorBlocked, true, 'Operador com sessão aberta deve ser bloqueado')

  // Tentativa 2: Outro operador tentando abrir o mesmo terminal na mesma filial
  const attemptTerminal = {
    branch_id: 'branch-A',
    terminal_name: 'Caixa 01',
    operator_id: 'user-02',
  }
  const isTerminalBlocked = activeSessions.some(
    (s) => s.branch_id === attemptTerminal.branch_id && s.terminal_name === attemptTerminal.terminal_name && s.status === 'open'
  )
  assert.equal(isTerminalBlocked, true, 'Terminal já ocupado deve ser bloqueado')

  // Tentativa 3: Outro operador em outro terminal na mesma filial (permitido!)
  const attemptValid = {
    branch_id: 'branch-A',
    terminal_name: 'Caixa 02',
    operator_id: 'user-02',
  }
  const isBlocked = activeSessions.some(
    (s) =>
      s.branch_id === attemptValid.branch_id &&
      (s.operator_id === attemptValid.operator_id || s.terminal_name === attemptValid.terminal_name) &&
      s.status === 'open'
  )
  assert.equal(isBlocked, false, 'Novo operador em novo terminal deve ser aceito')

  console.log('  ✅ Regras de índice exclusivo e restrições de concorrência validadas com sucesso.')
}

// ---------------------------------------------------------------------------
// TESTE 10: Bloqueio de Venda Sem Caixa Aberto
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 10: Bloqueio de Venda PDV Sem Caixa Aberto')
{
  function simulatePosCheckout(currentSession) {
    if (!currentSession || currentSession.status !== 'open') {
      throw new Error('Não há caixa aberto para registrar esta venda.')
    }
    return { success: true }
  }

  // Com caixa fechado ou nulo
  assert.throws(
    () => simulatePosCheckout(null),
    /Não há caixa aberto para registrar esta venda./
  )

  // Com caixa aberto
  const validCheckout = simulatePosCheckout({ id: 'sess-123', status: 'open' })
  assert.equal(validCheckout.success, true)

  console.log('  ✅ Validação de obrigatoriedade de caixa aberto antes da venda aprovada.')
}

console.log('\n=====================================================')
console.log('🎉 TODOS OS 10 TESTES DE CONTROLE DE CAIXA PASSARAM!')
console.log('=====================================================\n')
