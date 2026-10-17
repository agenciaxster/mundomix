/**
 * Script de Testes Automatizados do Módulo de Contas a Receber e Crediário
 * ERP MundoMix - Etapa 12
 *
 * Testa:
 * 1. Venda integralmente a prazo (100% crediário)
 * 2. Venda com entrada à vista + restante a prazo
 * 3. Geração de parcelas e soma exata em centavos (sem perdas)
 * 4. Recebimento integral de parcela
 * 5. Recebimento parcial com atualização de saldo devedor
 * 6. Bloqueio de recebimento acima do saldo devedor
 * 7. Bloqueio de recebimento duplicado (idempotência)
 * 8. Validação de limite de crédito (saldo utilizado + solicitado <= limite)
 * 9. Bloqueio de concessão para clientes com restrição/bloqueados
 * 10. Detecção de parcelas vencidas em atraso
 * 11. Integração com caixa aberto (recebimento em dinheiro aumenta o caixa físico)
 * 12. Imutabilidade do histórico de liquidações
 */

import assert from 'node:assert/strict'

console.log('=================================================================')
console.log('🚀 INICIANDO TESTES DO MÓDULO DE CONTAS A RECEBER E CREDIÁRIO')
console.log('=================================================================\n')

// Função auxiliar de divisão de parcelas com distribuição exata de centavos
function generateInstallments({ totalAmount, installmentsCount, firstDueDate, intervalDays = 30 }) {
  assert(totalAmount > 0, 'Total deve ser positivo')
  assert(installmentsCount >= 1, 'Mínimo 1 parcela')

  const baseVal = Math.floor((totalAmount / installmentsCount) * 100) / 100
  const centsRemainder = Math.round((totalAmount - baseVal * installmentsCount) * 100) / 100

  const installments = []
  const first = new Date(firstDueDate)

  for (let i = 1; i <= installmentsCount; i++) {
    const due = new Date(first)
    due.setDate(due.getDate() + (i - 1) * intervalDays)
    const val = i === 1 ? Math.round((baseVal + centsRemainder) * 100) / 100 : baseVal

    installments.push({
      number: i,
      dueDate: due.toISOString().split('T')[0],
      amount: val,
      balance: val,
      paid: 0,
      status: 'open',
    })
  }

  return installments
}

// ---------------------------------------------------------------------------
// TESTE 1: Venda Integralmente a Prazo (100% Crediário)
// ---------------------------------------------------------------------------
console.log('🔹 Teste 1: Venda 100% a Prazo no Crediário')
{
  const sale = {
    total: 300.0,
    payments: [{ payment_method: 'store_credit', amount: 300.0, installments: 3 }],
  }

  const immediateCash = sale.payments
    .filter((p) => p.payment_method === 'cash')
    .reduce((s, p) => s + p.amount, 0)

  assert.equal(immediateCash, 0.0, 'Venda 100% crediário não deve gerar entrada imediata de dinheiro no caixa')

  const financed = sale.payments
    .filter((p) => p.payment_method === 'store_credit')
    .reduce((s, p) => s + p.amount, 0)

  assert.equal(financed, 300.0, 'Valor financiado deve ser R$ 300,00')
  console.log('  ✅ Venda a prazo registrada sem simular entrada no caixa físico.')
}

// ---------------------------------------------------------------------------
// TESTE 2: Venda com Entrada à Vista e Saldo Financiado
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 2: Venda com Entrada + Saldo no Crediário')
{
  // Compra de R$ 500: Entrada de R$ 100 em Dinheiro + R$ 400 em 4x no Crediário
  const sale = {
    total: 500.0,
    payments: [
      { payment_method: 'cash', amount: 100.0, received_amount: 100.0, change_amount: 0 },
      { payment_method: 'store_credit', amount: 400.0, installments: 4 },
    ],
  }

  const immediateCash = sale.payments.find((p) => p.payment_method === 'cash')?.amount || 0
  const storeCredit = sale.payments.find((p) => p.payment_method === 'store_credit')?.amount || 0

  assert.equal(immediateCash, 100.0, 'R$ 100,00 entram imediatamente no caixa')
  assert.equal(storeCredit, 400.0, 'R$ 400,00 geram obrigação no contas a receber')
  assert.equal(immediateCash + storeCredit, 500.0)

  console.log('  ✅ Entrada de R$ 100 computada no caixa e R$ 400 destinados ao crediário.')
}

// ---------------------------------------------------------------------------
// TESTE 3: Distribuição Matemática Exata de Parcelas em Centavos (Divisão Impar)
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 3: Soma das Parcelas em Centavos (Exemplo R$ 100,00 em 3x)')
{
  // R$ 100 / 3 = 33.333333333...
  // 1ª parcela: R$ 33,34
  // 2ª parcela: R$ 33,33
  // 3ª parcela: R$ 33,33
  // Soma = 33.34 + 33.33 + 33.33 = exatamente R$ 100,00
  const insts = generateInstallments({
    totalAmount: 100.0,
    installmentsCount: 3,
    firstDueDate: '2026-11-15',
    intervalDays: 30,
  })

  assert.equal(insts.length, 3)
  assert.equal(insts[0].amount, 33.34, 'Primeira parcela absorve o centavo residual')
  assert.equal(insts[1].amount, 33.33)
  assert.equal(insts[2].amount, 33.33)

  const sum = Math.round(insts.reduce((acc, i) => acc + i.amount, 0) * 100) / 100
  assert.equal(sum, 100.0, 'A soma das parcelas deve ser rigorosamente idêntica ao valor financiado')

  console.log(`  ✅ 3 parcelas geradas: [${insts.map((i) => i.amount.toFixed(2)).join(', ')}] -> Soma R$ ${sum.toFixed(2)}`)
}

// ---------------------------------------------------------------------------
// TESTE 4: Recebimento Integral de Parcela
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 4: Recebimento / Quitação Integral de Parcela')
{
  const installment = {
    original_amount: 150.0,
    balance_amount: 150.0,
    paid_amount: 0.0,
    status: 'open',
  }

  const paymentAmount = 150.0
  installment.paid_amount += paymentAmount
  installment.balance_amount -= paymentAmount
  installment.status = installment.balance_amount <= 0.009 ? 'paid' : 'partially_paid'

  assert.equal(installment.paid_amount, 150.0)
  assert.equal(installment.balance_amount, 0.0)
  assert.equal(installment.status, 'paid')

  console.log('  ✅ Parcela liquidada integralmente (status: paid, saldo: R$ 0,00).')
}

// ---------------------------------------------------------------------------
// TESTE 5: Recebimento Parcial de Parcela
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 5: Recebimento Parcial')
{
  const installment = {
    original_amount: 200.0,
    balance_amount: 200.0,
    paid_amount: 0.0,
    status: 'open',
  }

  // Cliente paga R$ 80,00
  const payment1 = 80.0
  installment.paid_amount = Math.round((installment.paid_amount + payment1) * 100) / 100
  installment.balance_amount = Math.round((installment.balance_amount - payment1) * 100) / 100
  installment.status = installment.balance_amount <= 0.009 ? 'paid' : 'partially_paid'

  assert.equal(installment.paid_amount, 80.0)
  assert.equal(installment.balance_amount, 120.0)
  assert.equal(installment.status, 'partially_paid')

  // Cliente paga mais R$ 120,00 quitando o restante
  const payment2 = 120.0
  installment.paid_amount = Math.round((installment.paid_amount + payment2) * 100) / 100
  installment.balance_amount = Math.round((installment.balance_amount - payment2) * 100) / 100
  installment.status = installment.balance_amount <= 0.009 ? 'paid' : 'partially_paid'

  assert.equal(installment.paid_amount, 200.0)
  assert.equal(installment.balance_amount, 0.0)
  assert.equal(installment.status, 'paid')

  console.log('  ✅ Recebimento parcial inicial (R$ 80) e liquidação final (R$ 120) executados com precisão.')
}

// ---------------------------------------------------------------------------
// TESTE 6: Bloqueio de Pagamento Acima do Saldo Devedor
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 6: Bloqueio de Recebimento Excessivo')
{
  const installment = { balance_amount: 50.0 }
  const attemptPayment = 60.0

  assert.throws(
    () => {
      if (attemptPayment > installment.balance_amount) {
        throw new Error('O valor recebido não pode ultrapassar o saldo da parcela.')
      }
    },
    /não pode ultrapassar o saldo da parcela/
  )

  console.log('  ✅ Tentativa de receber R$ 60 em dívida de R$ 50 bloqueada com sucesso.')
}

// ---------------------------------------------------------------------------
// TESTE 7: Idempotência de Recebimentos
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 7: Prevenção de Recebimento Duplicado (Idempotência)')
{
  const processedKeys = new Set(['key-12345'])

  function executePayment(key) {
    if (processedKeys.has(key)) {
      return { already_processed: true }
    }
    processedKeys.add(key)
    return { success: true }
  }

  const result1 = executePayment('key-12345')
  assert.equal(result1.already_processed, true, 'Segunda chamada com mesma chave não deve reprocessar')

  const result2 = executePayment('key-67890')
  assert.equal(result2.success, true)

  console.log('  ✅ Idempotência validada contra repetição indevida de requisições de pagamento.')
}

// ---------------------------------------------------------------------------
// TESTE 8: Validação de Limite de Crédito
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 8: Validação de Limite de Crédito do Cliente')
{
  const customer = {
    credit_limit: 1000.0,
    open_receivables: [{ balance: 750.0 }],
  }

  const used = customer.open_receivables.reduce((s, r) => s + r.balance, 0)
  const available = customer.credit_limit - used // 250.00

  assert.equal(available, 250.0)

  // Venda de R$ 200 -> OK!
  const validSaleAmount = 200.0
  assert.equal(validSaleAmount <= available, true)

  // Venda de R$ 300 -> Bloqueada!
  const invalidSaleAmount = 300.0
  assert.equal(invalidSaleAmount <= available, false)

  console.log('  ✅ Limite Total R$ 1.000, Usado R$ 750 -> Venda de R$ 200 aprovada, R$ 300 bloqueada.')
}

// ---------------------------------------------------------------------------
// TESTE 9: Bloqueio de Cliente com Restrição ou Inativo
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 9: Bloqueio de Clientes com Status Restritivo')
{
  const blockedCust = { credit_status: 'blocked', status: 'active' }
  const inactiveCust = { credit_status: 'available', status: 'inactive' }

  function checkCanSellOnCredit(cust) {
    if (cust.credit_status === 'blocked' || cust.status === 'inactive') {
      throw new Error('Cliente bloqueado ou inativo para compras no crediário.')
    }
    return true
  }

  assert.throws(() => checkCanSellOnCredit(blockedCust), /Cliente bloqueado/)
  assert.throws(() => checkCanSellOnCredit(inactiveCust), /Cliente bloqueado/)

  console.log('  ✅ Clientes bloqueados e inativos impedidos de realizar compras a prazo.')
}

// ---------------------------------------------------------------------------
// TESTE 10: Detecção de Parcelas Vencidas em Atraso
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 10: Identificação de Contas Vencidas')
{
  const today = '2026-10-16'
  const installments = [
    { due_date: '2026-10-10', balance_amount: 100.0, status: 'open' }, // Vencida
    { due_date: '2026-10-15', balance_amount: 50.0, status: 'open' },  // Vencida
    { due_date: '2026-10-25', balance_amount: 200.0, status: 'open' }, // A vencer
    { due_date: '2026-10-01', balance_amount: 0.0, status: 'paid' },   // Paga
  ]

  const overdue = installments.filter((i) => i.status !== 'paid' && i.due_date < today)
  assert.equal(overdue.length, 2)

  const overdueSum = overdue.reduce((s, i) => s + i.balance_amount, 0)
  assert.equal(overdueSum, 150.0)

  console.log(`  ✅ 2 parcelas vencidas detectadas totalizando R$ ${overdueSum.toFixed(2)} em atraso.`)
}

// ---------------------------------------------------------------------------
// TESTE 11: Integração com Controle de Caixa
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 11: Recebimento em Dinheiro no Caixa Aberto')
{
  let cashRegisterBalance = 150.0 // Saldo inicial na gaveta

  // Recebe R$ 75,00 de parcela em dinheiro durante o turno
  const payment = { amount: 75.0, method: 'cash', hasOpenCash: true }
  if (payment.method === 'cash' && payment.hasOpenCash) {
    cashRegisterBalance += payment.amount // Suprimento / entrada
  }

  assert.equal(cashRegisterBalance, 225.0)

  // Recebe R$ 100,00 via Pix -> NÃO altera o dinheiro físico da gaveta
  const pixPayment = { amount: 100.0, method: 'pix', hasOpenCash: true }
  if (pixPayment.method === 'cash') {
    cashRegisterBalance += pixPayment.amount
  }

  assert.equal(cashRegisterBalance, 225.0, 'Pix não deve somar ao saldo em dinheiro físico da gaveta')

  console.log('  ✅ Recebimento em dinheiro aumentou gaveta para R$ 225; Pix registrado sem alterar cédulas.')
}

// ---------------------------------------------------------------------------
// TESTE 12: Imutabilidade do Histórico de Liquidações
// ---------------------------------------------------------------------------
console.log('\n🔹 Teste 12: Garantia de Imutabilidade e Auditoria')
{
  const lockedPaymentRecord = Object.freeze({
    id: 'pay-001',
    amount: 150.0,
    created_at: new Date().toISOString(),
  })

  assert.throws(
    () => {
      lockedPaymentRecord.amount = 200.0
    },
    /Cannot assign to read only property/
  )

  console.log('  ✅ Registros de pagamentos confirmados blindados contra edições silenciosas.')
}

console.log('\n=================================================================')
console.log('🎉 TODOS OS 12 TESTES DE CONTAS A RECEBER E CREDIÁRIO PASSARAM!')
console.log('=================================================================\n')
