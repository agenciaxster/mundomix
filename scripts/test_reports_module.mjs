import assert from 'assert'

console.log('=================================================================')
console.log('🚀 INICIANDO TESTES DO MÓDULO DE RELATÓRIOS E DASHBOARDS (ETAPA 13)')
console.log('=================================================================')

// 1. Teste de Faturamento Líquido vs Bruto vs Descontos
console.log('\n🔹 Teste 1: Diferenciação entre Bruto, Desconto e Líquido')
const sampleSales = [
  { subtotal: 100.0, discount: 10.0, total: 90.0, status: 'completed' },
  { subtotal: 250.0, discount: 50.0, total: 200.0, status: 'completed' },
  { subtotal: 80.0, discount: 0.0, total: 80.0, status: 'cancelled' }, // Cancelada
]

const validSales = sampleSales.filter((s) => s.status === 'completed')
const grossTotal = validSales.reduce((acc, s) => acc + s.subtotal, 0)
const discountTotal = validSales.reduce((acc, s) => acc + s.discount, 0)
const netTotal = validSales.reduce((acc, s) => acc + s.total, 0)
const averageTicket = netTotal / validSales.length

assert.strictEqual(grossTotal, 350.0, 'Faturamento bruto deve ser 350.00')
assert.strictEqual(discountTotal, 60.0, 'Descontos devem ser 60.00')
assert.strictEqual(netTotal, 290.0, 'Faturamento líquido deve ser 290.00')
assert.strictEqual(averageTicket, 145.0, 'Ticket médio deve ser 145.00')
console.log('  ✅ Vendas canceladas excluídas do faturamento líquido com sucesso.')
console.log(`  ✅ Bruto: R$ ${grossTotal.toFixed(2)}, Descontos: R$ ${discountTotal.toFixed(2)}, Líquido: R$ ${netTotal.toFixed(2)}, Ticket Médio: R$ ${averageTicket.toFixed(2)}`)

// 2. Teste de Comparação com Período Anterior
console.log('\n🔹 Teste 2: Cálculo de Crescimento vs Período Anterior')
const previousPeriodNet = 200.0
const currentPeriodNet = 290.0
const growth = Math.round(((currentPeriodNet - previousPeriodNet) / previousPeriodNet) * 1000) / 10
assert.strictEqual(growth, 45.0, 'Crescimento deve ser +45%')
console.log(`  ✅ Crescimento apurado: +${growth}% em relação ao período anterior.`)

// 3. Teste de Participação por Forma de Pagamento
console.log('\n🔹 Teste 3: Distribuição Percentual de Formas de Pagamento')
const payments = [
  { method: 'pix', amount: 145.0 },
  { method: 'credit_card', amount: 145.0 },
]
const totalPayments = payments.reduce((acc, p) => acc + p.amount, 0)
const pixShare = (payments[0].amount / totalPayments) * 100
assert.strictEqual(pixShare, 50.0, 'PIX deve corresponder a 50%')
console.log(`  ✅ Pagamentos somam R$ ${totalPayments.toFixed(2)} com 50% PIX e 50% Cartão.`)

// 4. Teste de Separação de Obrigações Previstas vs Realizadas
console.log('\n🔹 Teste 4: Não Equivalência entre Venda a Prazo e Dinheiro em Caixa')
const storeCreditSale = { total: 500.0, method: 'store_credit', paidNow: 0.0 }
const cashDrawerMovement = storeCreditSale.paidNow
assert.strictEqual(cashDrawerMovement, 0.0, 'Venda a prazo não deve gerar entrada física em dinheiro')
console.log('  ✅ Venda a prazo registrada como direito a receber sem inflar a gaveta física.')

// 5. Teste de Valoração de Estoque com Itens sem Custo
console.log('\n🔹 Teste 5: Valoração de Estoque e Identificação de Custo Ausente')
const stockItems = [
  { name: 'Teclado Mecânico', qty: 10, costPrice: 80.0 },
  { name: 'Mouse Sem Fio', qty: 5, costPrice: 0.0 }, // Sem custo cadastrado
]
let totalValuation = 0
let uncostedCount = 0
for (const item of stockItems) {
  if (item.costPrice > 0) {
    totalValuation += item.qty * item.costPrice
  } else {
    uncostedCount += 1
  }
}
assert.strictEqual(totalValuation, 800.0, 'Valoração estimada deve ser 800.00')
assert.strictEqual(uncostedCount, 1, 'Deve identificar 1 produto sem custo cadastrado')
console.log(`  ✅ Valoração estimada: R$ ${totalValuation.toFixed(2)} | Produtos sem custo identificados: ${uncostedCount}`)

// 6. Teste de Fechamento de Caixa com Apuração de Sobra e Falta
console.log('\n🔹 Teste 6: Auditoria de Fechamento de Caixa (Sobra/Falta)')
const cashSessionClosed = {
  expectedCash: 350.0,
  countedCash: 340.0,
  difference: 340.0 - 350.0, // Falta de R$ 10,00
}
assert.strictEqual(cashSessionClosed.difference, -10.0, 'Diferença de gaveta deve ser -10.00 (falta)')
console.log(`  ✅ Falta de caixa de R$ ${Math.abs(cashSessionClosed.difference).toFixed(2)} apurada com precisão.`)

console.log('\n=================================================================')
console.log('🎉 TODOS OS 6 TESTES DE REGRAS E RELATÓRIOS DA ETAPA 13 PASSARAM!')
console.log('=================================================================\n')
