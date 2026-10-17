import type { PrintableReceiptData } from '../../../types/receipt'
import { maskCnpj, maskCpf, maskPhone } from '../../../lib/utils/masks'

export function getPaymentMethodLabel(method: string, installments?: number): string {
  let label = ''
  switch (method) {
    case 'cash':
      label = 'Dinheiro'
      break
    case 'pix':
      label = 'Pix'
      break
    case 'credit_card':
      label = installments && installments > 1
        ? `Cartão de Crédito (${installments}x)`
        : 'Cartão de Crédito'
      break
    case 'debit_card':
      label = 'Cartão de Débito'
      break
    case 'store_credit':
      label = 'Crediário'
      break
    default:
      label = 'Outros'
  }
  return label
}

export function formatCurrency(val: number): string {
  return (val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return isoString
  }
}

/**
 * Monta o endereço formatado combinando filial e empresa matriz,
 * sem adicionar vírgulas ou hífens para campos vazios.
 */
export function buildAddress(data: PrintableReceiptData): string | null {
  const branch = data.sale.branch
  const comp = data.company

  const street = branch?.street || comp?.street
  const number = branch?.number || comp?.number
  const complement = branch?.complement || comp?.complement
  const neighborhood = branch?.neighborhood || comp?.neighborhood
  let city = branch?.city || comp?.city
  let state = branch?.state || comp?.state
  const zip = branch?.zip_code || comp?.zip_code

  // Normalização: corrige se estiver com o valor legado de exemplo 'São Paulo' / 'SP' ou vazio
  if (
    !city ||
    city.toLowerCase().includes('sao paulo') ||
    city.toLowerCase().includes('são paulo')
  ) {
    city = 'Palmas'
  }
  if (!state || (state.toUpperCase() === 'SP' && city === 'Palmas')) {
    state = 'TO'
  }

  const parts: string[] = []
  if (street) {
    parts.push(number ? `${street}, ${number}` : street)
  }
  if (complement) parts.push(complement)
  if (neighborhood) parts.push(neighborhood)
  if (city && state) {
    parts.push(`${city} - ${state}`)
  } else if (city) {
    parts.push(city)
  }
  if (zip) parts.push(`CEP: ${zip}`)

  return parts.length > 0 ? parts.join(', ') : null
}

/**
 * Constrói a representação HTML de uma via do comprovante não fiscal.
 */
export function buildSingleReceiptHtml(
  data: PrintableReceiptData,
  copyIndex: number,
  totalCopies: number
): string {
  const { sale, company, settings, isReprint } = data
  const is58mm = settings.paper_width === '58mm'

  // Dados da Empresa / Filial
  const tradeName = settings.show_trade_name ? (company?.trade_name || company?.legal_name || '') : ''
  const legalName = settings.show_legal_name && company?.legal_name && company.legal_name !== tradeName
    ? company.legal_name
    : ''
  const rawCnpj = sale.branch?.cnpj || company?.cnpj || ''
  const cnpj = settings.show_cnpj && rawCnpj ? maskCnpj(rawCnpj) : ''
  const rawPhone = sale.branch?.phone || company?.phone || ''
  const phone = settings.show_phone && rawPhone ? maskPhone(rawPhone) : ''
  const address = settings.show_address ? buildAddress(data) : null
  const branchName = sale.branch?.name ? `Filial: ${sale.branch.name}` : ''

  // Operador e Cliente
  const operator = settings.show_operator
    ? (sale.user_name || 'Operador de Caixa')
    : ''
  const customerName = sale.customer_name || sale.customer?.name || ''
  const rawCustomerDoc = sale.customer_document || sale.customer?.document || ''
  const customerDoc = rawCustomerDoc ? (rawCustomerDoc.length === 11 ? maskCpf(rawCustomerDoc) : maskCnpj(rawCustomerDoc)) : ''

  // Totais
  const items = sale.items || []
  const payments = sale.payments || []
  const totalUnits = items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)

  // Subvias
  const copyLabel = totalCopies > 1
    ? (copyIndex === 1 ? '1ª VIA - CLIENTE' : '2ª VIA - ESTABELECIMENTO')
    : ''

  return `
    <div class="thermal-receipt" style="font-family: monospace; line-height: 1.25; margin-bottom: 8px;">
      <!-- CABEÇALHO DA EMPRESA -->
      <div class="text-center">
        ${tradeName ? `<div class="font-bold uppercase" style="font-size: ${is58mm ? '12px' : '14px'};">${tradeName}</div>` : ''}
        ${legalName ? `<div style="font-size: 10px; color: #333;">${legalName}</div>` : ''}
        ${cnpj ? `<div style="font-size: 11px;">CNPJ: ${cnpj}</div>` : ''}
        ${address ? `<div style="font-size: 10px; margin-top: 1px;">${address}</div>` : ''}
        ${phone ? `<div style="font-size: 10px;">Tel: ${phone}</div>` : ''}
        ${branchName ? `<div style="font-size: 10px; margin-top: 1px;">${branchName}</div>` : ''}
      </div>

      <div class="divider"></div>

      <!-- DESTAQUE OBRIGATÓRIO: COMPROVANTE NÃO FISCAL -->
      <div class="text-center" style="margin: 3px 0;">
        <div class="font-bold uppercase" style="font-size: ${is58mm ? '11px' : '13px'}; letter-spacing: 0.5px;">
          *** COMPROVANTE NÃO FISCAL ***
        </div>
        <div style="font-size: 9px; text-transform: uppercase;">
          NÃO É DOCUMENTO FISCAL &bull; SEM VALOR TRIBUTÁRIO
        </div>
        ${isReprint ? `<div class="font-bold" style="font-size: 10px; margin-top: 2px;">*** REIMPRESSÃO ***</div>` : ''}
        ${copyLabel ? `<div style="font-size: 10px; font-weight: bold; margin-top: 1px;">[ ${copyLabel} ]</div>` : ''}
      </div>

      <div class="divider"></div>

      <!-- DADOS DA VENDA -->
      <div style="font-size: 11px;">
        <div class="item-row">
          <span>VENDA: <strong>${sale.code || `#${sale.sale_number}`}</strong></span>
          <span>${formatDateTime(sale.created_at)}</span>
        </div>
        ${operator ? `<div>OPERADOR: ${operator}</div>` : ''}
        ${settings.show_customer ? `
          <div style="margin-top: 2px;">
            CLIENTE: ${customerName ? `<strong>${customerName}</strong>` : 'CONSUMIDOR FINAL'}
            ${customerDoc ? `<br>CPF/CNPJ: ${customerDoc}` : ''}
          </div>
        ` : ''}
      </div>

      <div class="divider"></div>

      <!-- ITENS DA VENDA -->
      <div style="font-size: 11px;">
        <div class="font-bold" style="margin-bottom: 2px; font-size: 10px;">
          ${is58mm ? 'ITENS DA VENDA' : '# CÓD DESCRIÇÃO | QTD x UNIT = TOTAL'}
        </div>
        ${items.map((item, idx) => {
          const itemNum = String(idx + 1).padStart(2, '0')
          const code = item.product_sku || item.product_barcode || ''
          const qty = Number(item.quantity)
          const qtyStr = Number.isInteger(qty) ? `${qty} ${item.unit || 'UN'}` : `${qty.toFixed(3)} ${item.unit || 'UN'}`
          const unitPrice = formatCurrency(item.unit_price)
          const itemTotal = formatCurrency(item.total)
          const discountStr = item.discount > 0 && settings.show_item_discounts
            ? ` (-${formatCurrency(item.discount)})`
            : ''

          if (is58mm) {
            return `
              <div style="margin-bottom: 3px;">
                <div class="font-bold truncate">${itemNum}. ${item.product_name}</div>
                <div class="item-row" style="padding-left: 8px; font-size: 10px;">
                  <span>${qtyStr} x ${unitPrice}${discountStr}</span>
                  <span class="font-bold">${itemTotal}</span>
                </div>
              </div>
            `
          }

          return `
            <div style="margin-bottom: 3px;">
              <div class="font-bold truncate">
                ${itemNum} ${code ? `[${code}] ` : ''}${item.product_name}
              </div>
              <div class="item-row" style="padding-left: 12px; font-size: 10.5px;">
                <span>${qtyStr} x ${unitPrice}${discountStr}</span>
                <span class="font-bold">${itemTotal}</span>
              </div>
            </div>
          `
        }).join('')}
      </div>

      <div class="divider"></div>

      <!-- TOTAIS -->
      <div style="font-size: 11px;">
        <div class="item-row">
          <span>QTD. TOTAL DE ITENS:</span>
          <span>${items.length} item(ns) (${totalUnits} un)</span>
        </div>
        <div class="item-row">
          <span>SUBTOTAL:</span>
          <span>${formatCurrency(sale.subtotal)}</span>
        </div>
        ${sale.discount_amount > 0 ? `
          <div class="item-row" style="color: #000;">
            <span>DESCONTO:</span>
            <span>- ${formatCurrency(sale.discount_amount)}</span>
          </div>
        ` : ''}
        <div class="item-row font-bold" style="font-size: ${is58mm ? '12px' : '14px'}; margin-top: 3px; border-top: 1px solid #000; padding-top: 2px;">
          <span>TOTAL A PAGAR:</span>
          <span>${formatCurrency(sale.total)}</span>
        </div>
      </div>

      <div class="divider"></div>

      <!-- PAGAMENTOS E TROCO -->
      <div style="font-size: 11px;">
        <div class="font-bold" style="font-size: 10px; margin-bottom: 2px;">FORMA(S) DE PAGAMENTO</div>
        ${payments.length > 0 ? payments.map((p) => {
          const methodLabel = getPaymentMethodLabel(p.payment_method, p.installments)
          return `
            <div class="item-row">
              <span>${methodLabel}:</span>
              <span class="font-bold">${formatCurrency(p.amount)}</span>
            </div>
            ${p.payment_method === 'cash' && p.received_amount && p.received_amount > p.amount ? `
              <div class="item-row" style="font-size: 10px; padding-left: 8px;">
                <span>Valor Recebido:</span>
                <span>${formatCurrency(p.received_amount)}</span>
              </div>
            ` : ''}
          `
        }).join('') : `
          <div class="item-row">
            <span>Pagamento:</span>
            <span class="font-bold">${formatCurrency(sale.total)}</span>
          </div>
        `}

        ${sale.change_amount > 0 ? `
          <div class="item-row font-bold" style="margin-top: 2px; padding-top: 2px; border-top: 1px dashed #000;">
            <span>TROCO:</span>
            <span>${formatCurrency(sale.change_amount)}</span>
          </div>
        ` : ''}
      </div>

      <div class="divider"></div>

      <!-- MENSAGEM DE AGRADECIMENTO E RODAPÉ -->
      <div class="text-center" style="font-size: 10px; margin-top: 4px;">
        ${settings.footer_message ? `<div class="font-bold" style="margin-bottom: 3px;">${settings.footer_message}</div>` : ''}
        <div style="font-size: 8.5px; color: #555;">
          ERP MundoMix &bull; Sistema Comercial e PDV
        </div>
      </div>
    </div>
  `
}

/**
 * Constrói o HTML completo com suporte a 1 ou 2 vias.
 */
export function buildThermalReceiptHtml(data: PrintableReceiptData): string {
  const copies = data.settings.copies_count === 2 ? 2 : 1
  let html = ''

  for (let c = 1; c <= copies; c++) {
    html += buildSingleReceiptHtml(data, c, copies)
    if (c < copies) {
      html += `
        <div class="cut-line">
          <span class="cut-badge">- - - CORTE AQUI - - -</span>
        </div>
      `
    }
  }

  return html
}
