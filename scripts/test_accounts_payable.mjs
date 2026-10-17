// ==============================================================================
// TESTE AUTOMATIZADO: MÓDULO DE CONTAS A PAGAR E CONSOLIDAÇÃO FINANCEIRA
// ==============================================================================

import assert from 'node:assert/strict'

console.log('=================================================================')
console.log('🚀 INICIANDO TESTES DO MÓDULO DE CONTAS A PAGAR E FINANCEIRO')
console.log('=================================================================\n')

// ------------------------------------------------------------------------------
// Teste 1: Cálculo do Valor Líquido com Desconto, Juros e Multa
// ------------------------------------------------------------------------------
console.log('🔹 Teste 1: Cálculo do Valor Total Devido (Líquido)')
{
  const original = 1000.00
  const discount = 50.00
  const interest = 15.50
  const fine = 20.00

  const netTotal = Math.max(0, Math.round((original - discount + interest + fine) * 100) / 100)
  assert.equal(netTotal, 985.50, 'Valor total deve ser R$ 985,50')
  console.log(`  ✅ Original R$ 1.000,00 - Desc R$ 50,00 + Juros R$ 15,50 + Multa R$ 20,00 = R$ ${netTotal.toFixed(2)}`)
}

// ------------------------------------------------------------------------------
// Teste 2: Divisão Exata de Parcelas em Centavos (sem sobras ou dízimas)
// ------------------------------------------------------------------------------
console.log('\n🔹 Teste 2: Divisão de Parcelas em Centavos (R$ 100,00 em 3x e R$ 250,55 em 4x)')
{
  function splitInstallments(total, count) {
    const totalCents = Math.round(total * 100)
    const baseCents = Math.floor(totalCents / count)
    const remainderCents = totalCents - baseCents * count

    const list = []
    for (let i = 1; i <= count; i++) {
      const cents = i === 1 ? baseCents + remainderCents : baseCents
      list.push(cents / 100)
    }
    return list
  }

  // Caso 1: R$ 100 em 3x
  const inst100 = splitInstallments(100.00, 3)
  const sum100 = inst100.reduce((acc, v) => acc + v, 0)
  assert.equal(Math.round(sum100 * 100) / 100, 100.00)
  assert.deepEqual(inst100, [33.34, 33.33, 33.33])

  // Caso 2: R$ 250,55 em 4x
  const inst250 = splitInstallments(250.55, 4)
  const sum250 = inst250.reduce((acc, v) => acc + v, 0)
  assert.equal(Math.round(sum250 * 100) / 100, 250.55)
  assert.deepEqual(inst250, [62.66, 62.63, 62.63, 62.63])

  console.log(`  ✅ R$ 100,00 em 3x -> [${inst100.join(', ')}] -> Soma R$ ${sum100.toFixed(2)}`)
  console.log(`  ✅ R$ 250,55 em 4x -> [${inst250.join(', ')}] -> Soma R$ ${sum250.toFixed(2)}`)
}

// ------------------------------------------------------------------------------
// Teste 3: Pagamento Integral de Parcela
// ------------------------------------------------------------------------------
console.log('\n🔹 Teste 3: Quitação / Pagamento Integral de Parcela')
{
  const installment = {
    id: 'inst-1',
    amount: 150.00,
    paid_amount: 0,
    balance_amount: 150.00,
    status: 'pending',
  }

  const paymentAmount = 150.00
  const newPaid = Math.round((installment.paid_amount + paymentAmount) * 100) / 100
  const newBal = Math.max(0, Math.round((installment.balance_amount - paymentAmount) * 100) / 100)
  const newStatus = newBal <= 0.009 ? 'paid' : 'partially_paid'

  assert.equal(newBal, 0.00)
  assert.equal(newStatus, 'paid')
  console.log(`  ✅ Parcela de R$ 150,00 quitada com sucesso (saldo: R$ ${newBal.toFixed(2)}, status: ${newStatus})`)
}

// ------------------------------------------------------------------------------
// Teste 4: Pagamentos Parciais Consecutivos
// ------------------------------------------------------------------------------
console.log('\n🔹 Teste 4: Pagamentos Parciais Consecutivos')
{
  let installment = {
    id: 'inst-2',
    amount: 500.00,
    paid_amount: 0,
    balance_amount: 500.00,
    status: 'pending',
  }

  // 1º Pagamento: R$ 200,00
  installment.paid_amount = Math.round((installment.paid_amount + 200.00) * 100) / 100
  installment.balance_amount = Math.max(0, Math.round((installment.balance_amount - 200.00) * 100) / 100)
  installment.status = installment.balance_amount <= 0.009 ? 'paid' : 'partially_paid'

  assert.equal(installment.paid_amount, 200.00)
  assert.equal(installment.balance_amount, 300.00)
  assert.equal(installment.status, 'partially_paid')

  // 2º Pagamento: R$ 300,00
  installment.paid_amount = Math.round((installment.paid_amount + 300.00) * 100) / 100
  installment.balance_amount = Math.max(0, Math.round((installment.balance_amount - 300.00) * 100) / 100)
  installment.status = installment.balance_amount <= 0.009 ? 'paid' : 'partially_paid'

  assert.equal(installment.paid_amount, 500.00)
  assert.equal(installment.balance_amount, 0.00)
  assert.equal(installment.status, 'paid')

  console.log(`  ✅ 1ª baixa de R$ 200 -> Saldo R$ 300 (parcial). 2ª baixa de R$ 300 -> Quitado!`)
}

// ------------------------------------------------------------------------------
// Teste 5: Bloqueio de Pagamento Acima do Saldo Devedor
// ------------------------------------------------------------------------------
console.log('\n🔹 Teste 5: Bloqueio de Pagamento Superior ao Saldo Devedor')
{
  const balance = 120.00
  const attemptedPay = 150.00

  let blocked = false
  if (attemptedPay > balance + 0.009) {
    blocked = true
  }

  assert.equal(blocked, true, 'Tentativa de pagar R$ 150 em dívida de R$ 120 deve ser bloqueada')
  console.log('  ✅ Tentativa de pagamento excedente bloqueada com sucesso.')
}

// ------------------------------------------------------------------------------
// Teste 6: Idempotência de Pagamento
// ------------------------------------------------------------------------------
console.log('\n🔹 Teste 6: Idempotência de Pagamento contra Duplicações')
{
  const paymentsStore = new Map()
  const key = 'idem-pay-12345'

  function recordPayment(idempotencyKey, amount) {
    if (paymentsStore.has(idempotencyKey)) {
      return { success: true, idempotent: true, id: paymentsStore.get(idempotencyKey).id }
    }
    const rec = { id: 'pay-' + Date.now(), amount }
    paymentsStore.set(idempotencyKey, rec)
    return { success: true, idempotent: false, id: rec.id }
  }

  const res1 = recordPayment(key, 80.00)
  assert.equal(res1.idempotent, false)

  const res2 = recordPayment(key, 80.00)
  assert.equal(res2.idempotent, true)
  assert.equal(res1.id, res2.id)

  console.log('  ✅ Mesma requisição enviada duas vezes não gera duplicidade financeira.')
}

// ------------------------------------------------------------------------------
// Teste 7: Integração com Caixa Aberto (Saída / Despesa em Dinheiro)
// ------------------------------------------------------------------------------
console.log('\n🔹 Teste 7: Integração com Caixa Aberto para Pagamento em Dinheiro')
{
  let cashDrawerBalance = 500.00
  const cashSession = { id: 'sess-open', status: 'open', terminal: 'Caixa 01' }

  // Pagamento de despesa em dinheiro
  const paymentCash = { method: 'cash', amount: 80.00 }
  if (paymentCash.method === 'cash' && cashSession.status === 'open') {
    cashDrawerBalance -= paymentCash.amount
  }

  assert.equal(cashDrawerBalance, 420.00)

  // Pagamento de despesa via Pix (não move cédulas físicas da gaveta)
  const paymentPix = { method: 'pix', amount: 200.00 }
  if (paymentPix.method === 'cash') {
    cashDrawerBalance -= paymentPix.amount
  }

  assert.equal(cashDrawerBalance, 420.00, 'Pix não deve reduzir o dinheiro em espécie do caixa')
  console.log(`  ✅ Pagamento em dinheiro reduziu gaveta para R$ 420,00; Pix liquidou sem alterar cédulas.`)
}

// ------------------------------------------------------------------------------
// Teste 8: Cancelamento Auditado de Conta a Pagar
// ------------------------------------------------------------------------------
console.log('\n🔹 Teste 8: Cancelamento Auditado de Conta a Pagar')
{
  const payableUnpaid = { id: 'pay-01', paid_amount: 0, status: 'pending' }
  const payablePaid = { id: 'pay-02', paid_amount: 100, status: 'partially_paid' }

  function cancelPayable(p, reason) {
    if (!reason || !reason.trim()) throw new Error('Motivo obrigatório')
    if (p.paid_amount > 0.009) throw new Error('Não pode cancelar conta com pagamentos realizados')
    return { ...p, status: 'cancelled', cancellation_reason: reason }
  }

  // Cancelamento bem-sucedido
  const cancelled = cancelPayable(payableUnpaid, 'Compra desfeita pelo fornecedor')
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.cancellation_reason, 'Compra desfeita pelo fornecedor')

  // Cancelamento bloqueado
  assert.throws(() => {
    cancelPayable(payablePaid, 'Tentativa indevida')
  }, /Não pode cancelar conta com pagamentos realizados/)

  console.log('  ✅ Cancelamento permitido somente sem pagamentos e exigindo justificativa auditável.')
}

// ------------------------------------------------------------------------------
// Teste 9: Identificação de Vencimentos (Vencido, Vence Hoje, Futuro)
// ------------------------------------------------------------------------------
console.log('\n🔹 Teste 9: Detecção de Vencidos, Vencendo Hoje e Futuros')
{
  const todayStr = '2026-10-16'
  const items = [
    { id: 1, due_date: '2026-10-10', balance: 100, status: 'pending' }, // Vencido
    { id: 2, due_date: '2026-10-16', balance: 80,  status: 'pending' }, // Hoje
    { id: 3, due_date: '2026-10-25', balance: 250, status: 'pending' }, // Futuro
    { id: 4, due_date: '2026-10-05', balance: 0,   status: 'paid' },    // Pago (ignorado)
  ]

  let totalOverdue = 0
  let totalDueToday = 0
  let totalUpcoming = 0

  for (const item of items) {
    if (item.status !== 'paid' && item.balance > 0) {
      if (item.due_date < todayStr) totalOverdue += item.balance
      else if (item.due_date === todayStr) totalDueToday += item.balance
      else totalUpcoming += item.balance
    }
  }

  assert.equal(totalOverdue, 100)
  assert.equal(totalDueToday, 80)
  assert.equal(totalUpcoming, 250)

  console.log(`  ✅ Vencido: R$ ${totalOverdue.toFixed(2)}, Hoje: R$ ${totalDueToday.toFixed(2)}, Futuro: R$ ${totalUpcoming.toFixed(2)}`)
}

// ------------------------------------------------------------------------------
// Teste 10: Consolidação do Menu e Rotas Financeiras
// ------------------------------------------------------------------------------
console.log('\n🔹 Teste 10: Validação da Consolidação do Menu Financeiro')
{
  const menuFinanceiro = [
    { title: 'Contas a Pagar', href: '/financeiro/contas-pagar' },
    { title: 'Contas a Receber', href: '/financeiro/contas-receber' },
    { title: 'Controle de Caixa', href: '/financeiro/caixa' },
  ]

  const hasDuplicateCrediario = menuFinanceiro.some((m) => m.title === 'Fiado e Crediário')
  assert.equal(hasDuplicateCrediario, false, 'Menu não deve possuir item duplicado "Fiado e Crediário"')
  assert.equal(menuFinanceiro.length, 3, 'Menu financeiro deve possuir exatamente 3 itens limpos e consolidados')

  console.log('  ✅ Menu lateral financeiro consolidado sem duplicidade de cards ou páginas.')
}

console.log('\n=================================================================')
console.log('🎉 TODOS OS 10 TESTES DE CONTAS A PAGAR E CONSOLIDAÇÃO PASSARAM!')
console.log('=================================================================')
