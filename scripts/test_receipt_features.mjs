import assert from 'node:assert'
import {
  formatCurrency,
  formatDateTime,
  buildAddress,
  getPaymentMethodLabel,
  buildSingleReceiptHtml,
  buildThermalReceiptHtml,
} from '../src/features/pos/receipt/receipt-formatter.ts'
import { maskCnpj, maskCpf, maskPhone } from '../src/lib/utils/masks.ts'

console.log('🧪 Iniciando bateria de testes automatizados da Etapa 10 — Comprovantes Não Fiscais...')

// 1. Teste de Formatação de Moeda e Data
console.log('Testando formatadores base (moeda, data, máscaras)...')
assert.strictEqual(formatCurrency(10).replace(/\s+/g, ' '), 'R$ 10,00')
assert.strictEqual(formatCurrency(1250.5).replace(/\s+/g, ' '), 'R$ 1.250,50')
assert.strictEqual(maskCnpj('12345678000195'), '12.345.678/0001-95')
assert.strictEqual(maskCpf('12345678909'), '123.456.789-09')
assert.strictEqual(maskPhone('11987654321'), '(11) 98765-4321')
console.log('✅ Formatadores base validados.')

// 2. Teste: Venda com 1 forma de pagamento em 80mm
console.log('Testando comprovante 80mm com 1 forma de pagamento (Dinheiro) e troco...')
const sale1 = {
  id: 'sale-1',
  company_id: 'comp-1',
  branch_id: 'branch-1',
  user_id: 'user-1',
  user_name: 'Carlos Operador',
  customer_id: null,
  customer_name: null,
  customer_document: null,
  sale_number: 1001,
  code: 'VND-001001',
  status: 'completed',
  subtotal: 50.0,
  discount_type: 'value',
  discount_value: 0,
  discount_amount: 0,
  total: 50.0,
  payment_amount: 100.0,
  change_amount: 50.0,
  quote_id: null,
  notes: null,
  created_at: '2026-10-16T10:00:00.000Z',
  updated_at: '2026-10-16T10:00:00.000Z',
  branch: {
    id: 'branch-1',
    name: 'Filial Centro',
    code: 'FL-01',
    cnpj: '12345678000195',
    phone: '11987654321',
    street: 'Rua das Flores',
    number: '123',
    neighborhood: 'Centro',
    city: 'Palmas',
    state: 'TO',
    zip_code: '77001000',
  },
  items: [
    {
      company_id: 'comp-1',
      branch_id: 'branch-1',
      product_id: 'prod-1',
      product_name: 'Café Torrado Especial',
      product_sku: 'CAF-001',
      unit: 'UN',
      quantity: 2,
      unit_price: 25.0,
      price_type: 'retail',
      discount: 0,
      subtotal: 50.0,
      total: 50.0,
    },
  ],
  payments: [
    {
      company_id: 'comp-1',
      payment_method: 'cash',
      amount: 50.0,
      received_amount: 100.0,
      change_amount: 50.0,
      installments: 1,
    },
  ],
}

const company1 = {
  id: 'comp-1',
  legal_name: 'MundoMix Comércio Varejista Ltda',
  trade_name: 'MundoMix Express',
  cnpj: '12345678000195',
  phone: '11987654321',
  street: 'Av Teotônio Segurado',
  number: '1000',
  city: 'Palmas',
  state: 'TO',
}

const settings80mm = {
  company_id: 'comp-1',
  paper_width: '80mm',
  copies_count: 1,
  show_trade_name: true,
  show_legal_name: true,
  show_cnpj: true,
  show_phone: true,
  show_address: true,
  show_operator: true,
  show_customer: true,
  show_item_discounts: true,
  footer_message: 'Obrigado pela preferência!',
}

const html80 = buildThermalReceiptHtml({
  sale: sale1,
  company: company1,
  settings: settings80mm,
})

assert(html80.includes('COMPROVANTE NÃO FISCAL'), 'Dever conter destaque COMPROVANTE NÃO FISCAL')
assert(html80.includes('MundoMix Express'), 'Deve conter nome fantasia')
assert(html80.includes('12.345.678/0001-95'), 'Deve conter CNPJ formatado')
assert(html80.includes('Palmas - TO'), 'Deve conter a cidade correta Palmas - TO')
assert(!html80.includes('São Paulo'), 'Não deve conter São Paulo')
assert(html80.includes('VND-001001'), 'Deve conter código da venda')
assert(html80.includes('Café Torrado Especial'), 'Deve conter o produto')
assert(html80.includes('Carlos Operador'), 'Deve conter identificação do operador')
assert(html80.includes('TROCO:'), 'Deve exibir troco')
assert(html80.includes('Obrigado pela preferência!'), 'Deve conter mensagem configurável')

// Teste de normalização: filial que ainda tenha "São Paulo" gravada no banco
const legacyAddress = buildAddress({
  sale: {
    ...sale1,
    branch: {
      ...sale1.branch,
      city: 'São Paulo',
      state: 'SP',
    },
  },
  company: company1,
  settings: settings80mm,
})
assert(legacyAddress.includes('Palmas - TO'), 'Deve normalizar automaticamente filial legada com São Paulo para Palmas - TO')
assert(!legacyAddress.includes('São Paulo'), 'Não deve manter São Paulo após normalização')

console.log('✅ Comprovante 80mm com 1 pagamento e endereço Palmas - TO validado com sucesso.')

// 3. Teste: Venda em 58mm (bobina estreita) com 2 formas de pagamento (dividido) e nome de produto longo
console.log('Testando comprovante 58mm com 2 pagamentos e produto com nome longo...')
const sale2 = {
  ...sale1,
  code: 'VND-001002',
  total: 120.0,
  subtotal: 130.0,
  discount_amount: 10.0,
  change_amount: 0,
  customer_name: 'Ana Maria da Silva',
  customer_document: '98765432100',
  items: [
    {
      company_id: 'comp-1',
      branch_id: 'branch-1',
      product_id: 'prod-long',
      product_name: 'Smart TV LED 55 Polegadas 4K UHD Crystal HDR WiFi Bluetooth com Comando de Voz',
      product_sku: 'TV-55-4K',
      unit: 'UN',
      quantity: 1,
      unit_price: 130.0,
      price_type: 'retail',
      discount: 10.0,
      subtotal: 130.0,
      total: 120.0,
    },
  ],
  payments: [
    {
      company_id: 'comp-1',
      payment_method: 'pix',
      amount: 50.0,
      received_amount: 50.0,
      change_amount: 0,
      installments: 1,
    },
    {
      company_id: 'comp-1',
      payment_method: 'credit_card',
      amount: 70.0,
      received_amount: 70.0,
      change_amount: 0,
      installments: 3,
    },
  ],
}

const settings58mm = {
  ...settings80mm,
  paper_width: '58mm',
  copies_count: 2,
}

const html58 = buildThermalReceiptHtml({
  sale: sale2,
  company: company1,
  settings: settings58mm,
  isReprint: true,
})

assert(html58.includes('*** REIMPRESSÃO ***'), 'Deve conter identificação de reimpressão')
assert(html58.includes('1ª VIA - CLIENTE'), 'Deve conter 1ª via')
assert(html58.includes('2ª VIA - ESTABELECIMENTO'), 'Deve conter 2ª via')
assert(html58.includes('- - - CORTE AQUI - - -'), 'Deve conter linha de corte entre vias')
assert(html58.includes('Pix:'), 'Deve listar pagamento Pix')
assert(html58.includes('Cartão de Crédito (3x):'), 'Deve listar pagamento Crédito parcelado')
assert(html58.includes('987.654.321-00'), 'Deve conter CPF do cliente formatado')
assert(html58.includes('Smart TV LED 55'), 'Deve conter nome longo de produto com quebra segura')
console.log('✅ Comprovante 58mm (2 vias, 2 pagamentos, produto longo) validado com sucesso.')

// 4. Teste: Ocultação de dados ausentes (sem telefone, sem endereço, sem cliente)
console.log('Testando ocultação estrita de campos inexistentes / vazios...')
const saleEmpty = {
  ...sale1,
  customer_name: null,
  customer_document: null,
  branch: {
    id: 'branch-empty',
    name: 'Balcão Express',
    code: 'BX-01',
    cnpj: null,
    phone: null,
    street: null,
    number: null,
    city: null,
    state: null,
  },
}

const companyEmpty = {
  id: 'comp-empty',
  legal_name: 'Empresa Sem Endereço Ltda',
  trade_name: '',
  cnpj: '',
  phone: '',
  street: '',
}

const settingsHidden = {
  ...settings80mm,
  show_phone: false,
  show_address: false,
}

const htmlEmpty = buildThermalReceiptHtml({
  sale: saleEmpty,
  company: companyEmpty,
  settings: settingsHidden,
})

assert(!htmlEmpty.includes('Tel:'), 'Não deve exibir Telefone quando indisponível ou desmarcado')
assert(!htmlEmpty.includes('CEP:'), 'Não deve exibir CEP quando indisponível')
assert(!htmlEmpty.includes('null'), 'Nunca deve exibir palavra literal null')
assert(!htmlEmpty.includes('undefined'), 'Nunca deve exibir palavra literal undefined')
console.log('✅ Ocultação de campos ausentes validada com sucesso.')

// 5. Teste: Reimpressão Imutável
console.log('Testando imutabilidade: garantir que reimpressão não altera estado nem valores...')
const originalTotal = sale1.total
const originalSubtotal = sale1.subtotal
const originalPayments = JSON.stringify(sale1.payments)
const originalItems = JSON.stringify(sale1.items)

// Gera múltiplas impressões consecutivas
buildThermalReceiptHtml({ sale: sale1, company: company1, settings: settings80mm, isReprint: true })
buildThermalReceiptHtml({ sale: sale1, company: company1, settings: settings58mm, isReprint: true })

assert.strictEqual(sale1.total, originalTotal, 'Total da venda não pode ser alterado durante impressão')
assert.strictEqual(sale1.subtotal, originalSubtotal, 'Subtotal não pode ser alterado')
assert.strictEqual(JSON.stringify(sale1.payments), originalPayments, 'Pagamentos não podem ser alterados')
assert.strictEqual(JSON.stringify(sale1.items), originalItems, 'Itens não podem ser alterados')
console.log('✅ Imutabilidade da reimpressão confirmada.')

console.log('🎉 TODOS OS TESTES AUTOMATIZADOS DA ETAPA 10 PASSARAM COM SUCESSO!')
