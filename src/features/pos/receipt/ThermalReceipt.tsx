import type { PrintableReceiptData } from '@/types/receipt'
import {
  formatCurrency,
  formatDateTime,
  buildAddress,
  getPaymentMethodLabel,
} from './receipt-formatter'
import { maskCnpj, maskCpf, maskPhone } from '@/lib/utils/masks'

interface ThermalReceiptProps {
  data: PrintableReceiptData
  copyIndex?: number
  totalCopies?: number
  className?: string
}

export function ThermalReceipt({
  data,
  copyIndex = 1,
  totalCopies = 1,
  className = '',
}: ThermalReceiptProps) {
  const { sale, company, settings, isReprint } = data
  const is58mm = settings.paper_width === '58mm'

  // Dados da Empresa / Filial
  const tradeName = settings.show_trade_name
    ? company?.trade_name || company?.legal_name || ''
    : ''
  const legalName =
    settings.show_legal_name &&
    company?.legal_name &&
    company.legal_name !== tradeName
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
    ? sale.user_name || 'Operador de Caixa'
    : ''
  const customerName = sale.customer_name || sale.customer?.name || ''
  const rawCustomerDoc = sale.customer_document || sale.customer?.document || ''
  const customerDoc = rawCustomerDoc
    ? rawCustomerDoc.length === 11
      ? maskCpf(rawCustomerDoc)
      : maskCnpj(rawCustomerDoc)
    : ''

  // Itens e Totais
  const items = sale.items || []
  const payments = sale.payments || []
  const totalUnits = items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)

  // Subvias
  const copyLabel =
    totalCopies > 1
      ? copyIndex === 1
        ? '1ª VIA - CLIENTE'
        : '2ª VIA - ESTABELECIMENTO'
      : ''

  return (
    <div
      className={`bg-white text-black font-mono text-[11px] leading-tight select-text transition-all duration-200 ${
        is58mm ? 'max-w-[240px] px-2 py-3 text-[10px]' : 'max-w-[320px] px-3.5 py-4'
      } ${className}`}
      style={{
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))',
      }}
    >
      {/* ─── CABEÇALHO DA EMPRESA ────────────────────────────────────────── */}
      <div className="text-center space-y-0.5">
        {tradeName && (
          <h1
            className={`font-black uppercase tracking-tight text-black ${
              is58mm ? 'text-xs' : 'text-sm'
            }`}
          >
            {tradeName}
          </h1>
        )}
        {legalName && <p className="text-[9.5px] text-gray-700">{legalName}</p>}
        {cnpj && <p className="text-[10.5px]">CNPJ: {cnpj}</p>}
        {address && <p className="text-[9.5px] text-gray-800 leading-tight">{address}</p>}
        {phone && <p className="text-[9.5px]">Tel: {phone}</p>}
        {branchName && <p className="text-[9.5px] font-semibold">{branchName}</p>}
      </div>

      {/* Separador Tracejado */}
      <div className="border-t border-dashed border-black my-2" />

      {/* ─── IDENTIFICAÇÃO DO COMPROVANTE NÃO FISCAL ──────────────────────── */}
      <div className="text-center space-y-0.5 my-1">
        <div
          className={`font-black uppercase tracking-wider ${
            is58mm ? 'text-[11px]' : 'text-[12.5px]'
          }`}
        >
          *** COMPROVANTE NÃO FISCAL ***
        </div>
        <div className="text-[8.5px] text-gray-700 uppercase tracking-tighter">
          NÃO É DOCUMENTO FISCAL &bull; SEM VALOR TRIBUTÁRIO
        </div>
        {isReprint && (
          <div className="font-bold text-[9.5px] text-gray-900 uppercase">
            *** REIMPRESSÃO ***
          </div>
        )}
        {copyLabel && (
          <div className="font-bold text-[9.5px] text-gray-900">
            [ {copyLabel} ]
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-black my-2" />

      {/* ─── METADADOS DA VENDA ──────────────────────────────────────────── */}
      <div className="space-y-0.5">
        <div className="flex justify-between items-center">
          <span>
            VENDA: <strong>{sale.code || `#${sale.sale_number}`}</strong>
          </span>
          <span className="text-[10px] text-gray-700">
            {formatDateTime(sale.created_at)}
          </span>
        </div>
        {operator && <div>OPERADOR: {operator}</div>}
        {settings.show_customer && (
          <div className="pt-0.5">
            <div>
              CLIENTE:{' '}
              {customerName ? (
                <strong className="uppercase">{customerName}</strong>
              ) : (
                'CONSUMIDOR FINAL'
              )}
            </div>
            {customerDoc && <div>CPF/CNPJ: {customerDoc}</div>}
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-black my-2" />

      {/* ─── ITENS DA VENDA ──────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="font-bold text-[9.5px] uppercase tracking-wider text-gray-700">
          {is58mm ? 'ITENS DA VENDA' : '# CÓD DESCRIÇÃO | QTD x UNIT = TOTAL'}
        </div>

        {items.map((item, idx) => {
          const itemNum = String(idx + 1).padStart(2, '0')
          const code = item.product_sku || item.product_barcode || ''
          const qty = Number(item.quantity)
          const qtyStr = Number.isInteger(qty)
            ? `${qty} ${item.unit || 'UN'}`
            : `${qty.toFixed(3)} ${item.unit || 'UN'}`
          const unitPrice = formatCurrency(item.unit_price)
          const itemTotal = formatCurrency(item.total)
          const discountStr =
            item.discount > 0 && settings.show_item_discounts
              ? ` (-${formatCurrency(item.discount)})`
              : ''

          if (is58mm) {
            return (
              <div key={idx} className="space-y-0.5">
                <div className="font-bold truncate">
                  {itemNum}. {item.product_name}
                </div>
                <div className="flex justify-between items-center pl-2 text-[9.5px]">
                  <span>
                    {qtyStr} x {unitPrice}
                    {discountStr}
                  </span>
                  <span className="font-bold">{itemTotal}</span>
                </div>
              </div>
            )
          }

          return (
            <div key={idx} className="space-y-0.5">
              <div className="font-bold truncate">
                {itemNum} {code ? `[${code}] ` : ''}
                {item.product_name}
              </div>
              <div className="flex justify-between items-center pl-3 text-[10px]">
                <span>
                  {qtyStr} x {unitPrice}
                  {discountStr}
                </span>
                <span className="font-bold">{itemTotal}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-dashed border-black my-2" />

      {/* ─── TOTAIS ──────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span>QTD. TOTAL DE ITENS:</span>
          <span>
            {items.length} item(ns) ({totalUnits} un)
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>SUBTOTAL:</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>
        {sale.discount_amount > 0 && (
          <div className="flex justify-between items-center font-semibold">
            <span>DESCONTO:</span>
            <span>- {formatCurrency(sale.discount_amount)}</span>
          </div>
        )}
        <div
          className={`flex justify-between items-center font-black pt-1 border-t border-black ${
            is58mm ? 'text-[12px]' : 'text-[14px]'
          }`}
        >
          <span>TOTAL A PAGAR:</span>
          <span>{formatCurrency(sale.total)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-2" />

      {/* ─── FORMAS DE PAGAMENTO E TROCO ──────────────────────────────────── */}
      <div className="space-y-1">
        <div className="font-bold text-[9.5px] uppercase tracking-wider text-gray-700">
          FORMA(S) DE PAGAMENTO
        </div>
        {payments.length > 0 ? (
          payments.map((p, idx) => {
            const methodLabel = getPaymentMethodLabel(p.payment_method, p.installments)
            return (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between items-center">
                  <span>{methodLabel}:</span>
                  <span className="font-bold">{formatCurrency(p.amount)}</span>
                </div>
                {p.payment_method === 'cash' &&
                  p.received_amount &&
                  p.received_amount > p.amount && (
                    <div className="flex justify-between items-center pl-2 text-[9.5px] text-gray-700">
                      <span>Valor Recebido:</span>
                      <span>{formatCurrency(p.received_amount)}</span>
                    </div>
                  )}
              </div>
            )
          })
        ) : (
          <div className="flex justify-between items-center">
            <span>Pagamento:</span>
            <span className="font-bold">{formatCurrency(sale.total)}</span>
          </div>
        )}

        {sale.change_amount > 0 && (
          <div className="flex justify-between items-center font-black pt-1 mt-1 border-t border-dashed border-black">
            <span>TROCO DEVOLVIDO:</span>
            <span>{formatCurrency(sale.change_amount)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-black my-2" />

      {/* ─── MENSAGEM CONFIGURÁVEL E ASSINATURA ────────────────────────────── */}
      <div className="text-center space-y-1 pt-1 text-[9.5px]">
        {settings.footer_message && (
          <p className="font-bold text-gray-900">{settings.footer_message}</p>
        )}
        <p className="text-[8.5px] text-gray-500">
          ERP MundoMix &bull; Sistema Comercial e PDV
        </p>
      </div>
    </div>
  )
}
