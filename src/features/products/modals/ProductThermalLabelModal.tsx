import { useState, useRef } from 'react'
import {
  X,
  Printer,
  Sliders,
  Sparkles,
  Copy,
  Check,
  Tag,
  QrCode,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import type { ProductWithBranchStock } from '@/lib/services/product.service'

interface ProductThermalLabelModalProps {
  isOpen: boolean
  onClose: () => void
  product: ProductWithBranchStock | null
}

type LabelSize = '40x25' | '50x30' | '60x40'

export function ProductThermalLabelModal({
  isOpen,
  onClose,
  product,
}: ProductThermalLabelModalProps) {
  const [labelSize, setLabelSize] = useState<LabelSize>('40x25')
  const [copies, setCopies] = useState<number>(1)
  const [showPrice, setShowPrice] = useState<boolean>(true)
  const [showSku, setShowSku] = useState<boolean>(true)
  const [copied, setCopied] = useState(false)
  const qrRef = useRef<HTMLDivElement | null>(null)

  if (!isOpen || !product) return null

  // O valor gravado no QR Code: prioriza Barcode, senão SKU, senão ID
  const qrValue = product.barcode || product.sku || product.id

  const formattedPrice = (product.sale_price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  function handleCopyCode() {
    navigator.clipboard.writeText(qrValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Especificações técnicas por tamanho em milímetros
  const labelConfigs = {
    '40x25': {
      widthMm: 40,
      heightMm: 25,
      previewWidth: '160px',
      previewMinHeight: '100px',
      qrPreviewPx: 54,
      titleFontSize: '8.5px',
      priceFontSize: '12px',
      qrMm: 14,
      labelMmText: '40mm x 25mm (Mini / Caixa Pequena)',
    },
    '50x30': {
      widthMm: 50,
      heightMm: 30,
      previewWidth: '200px',
      previewMinHeight: '120px',
      qrPreviewPx: 68,
      titleFontSize: '10px',
      priceFontSize: '14px',
      qrMm: 17,
      labelMmText: '50mm x 30mm (Padrão Varejo)',
    },
    '60x40': {
      widthMm: 60,
      heightMm: 40,
      previewWidth: '240px',
      previewMinHeight: '160px',
      qrPreviewPx: 84,
      titleFontSize: '12px',
      priceFontSize: '16px',
      qrMm: 22,
      labelMmText: '60mm x 40mm (Gôndola / Caixa Média)',
    },
  }[labelSize]

  // Impressão robusta via IFrame dedicado (Elimina 100% de páginas em branco)
  function handlePrint() {
    const qrSvg = qrRef.current?.innerHTML || ''
    const { widthMm, heightMm, qrMm, titleFontSize, priceFontSize } = labelConfigs

    const singleLabelHtml = `
      <div class="thermal-label">
        <div class="label-title">${product?.name || ''}</div>
        <div class="label-body">
          <div class="label-qr">
            ${qrSvg}
          </div>
          <div class="label-details">
            ${showSku ? `<div class="label-sku">${product?.sku || product?.barcode || ''}</div>` : ''}
            ${product?.brand ? `<div class="label-brand">${product.brand}</div>` : ''}
            <div class="label-brand-sub">MUNDOMIX</div>
          </div>
        </div>
        ${
          showPrice
            ? `
          <div class="label-footer">
            <span class="label-price-tag">À VISTA</span>
            <span class="label-price">${formattedPrice}</span>
          </div>
        `
            : ''
        }
      </div>
    `

    // Gera todas as cópias selecionadas
    let pagesHtml = ''
    for (let i = 0; i < copies; i++) {
      pagesHtml += singleLabelHtml
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Etiqueta Térmica - ${product?.name || ''}</title>
        <style>
          @page {
            size: ${widthMm}mm ${heightMm}mm;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          html, body {
            width: ${widthMm}mm;
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          }
          .thermal-label {
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            max-height: ${heightMm}mm;
            padding: 1.5mm 2mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
            background: #ffffff;
            color: #000000;
          }
          .label-title {
            font-size: ${titleFontSize};
            font-weight: 700;
            text-transform: uppercase;
            line-height: 1.15;
            max-height: 2.3em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .label-body {
            display: flex;
            align-items: center;
            gap: 2mm;
            margin: 1mm 0;
          }
          .label-qr svg {
            width: ${qrMm}mm !important;
            height: ${qrMm}mm !important;
            display: block;
          }
          .label-details {
            display: flex;
            flex-direction: column;
            justify-content: center;
            overflow: hidden;
          }
          .label-sku {
            font-family: monospace;
            font-weight: 700;
            font-size: 8.5px;
            color: #111;
          }
          .label-brand {
            font-size: 7.5px;
            text-transform: uppercase;
            color: #333;
          }
          .label-brand-sub {
            font-size: 6.5px;
            color: #666;
            font-family: monospace;
            margin-top: 1px;
          }
          .label-footer {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            border-top: 0.5px solid #000;
            padding-top: 0.5mm;
          }
          .label-price-tag {
            font-size: 7px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .label-price {
            font-size: ${priceFontSize};
            font-weight: 900;
            font-family: monospace;
            letter-spacing: -0.3px;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `

    // Remove qualquer iframe de impressão anterior se houver
    const oldIframe = document.getElementById('thermal-print-iframe')
    if (oldIframe) {
      document.body.removeChild(oldIframe)
    }

    // Cria o iframe invisível
    const iframe = document.createElement('iframe')
    iframe.id = 'thermal-print-iframe'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(printHtml)
      doc.close()

      // Aguarda os elementos serem desenhados no DOM do iframe e aciona o spooler
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()

        // Remove o iframe da memória após a impressão
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe)
          }
        }, 1500)
      }, 250)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Imprimir Etiqueta Térmica
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  QR Code
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Formato compacto otimizado para rolos de etiquetas adesivas e caixas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Opções e Configurações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-purple-400" />
                Tamanho da Etiqueta
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['40x25', '50x30', '60x40'] as LabelSize[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setLabelSize(sz)}
                    className={`text-xs py-2 px-2.5 rounded-xl font-medium border transition-all text-center ${
                      labelSize === sz
                        ? 'border-purple-500 bg-purple-600/20 text-purple-200 shadow-sm'
                        : 'border-slate-800 bg-slate-850/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {sz} mm
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {labelConfigs.labelMmText}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-purple-400" />
                Quantidade de Cópias
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCopies(num)}
                    className={`flex-1 text-xs py-2 rounded-xl font-medium border transition-all ${
                      copies === num
                        ? 'border-purple-500 bg-purple-600/20 text-purple-200'
                        : 'border-slate-800 bg-slate-850/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {num} {num === 1 ? 'cópia' : 'cópias'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Opções de Exibição */}
          <div className="flex items-center gap-6 pt-1 border-t border-slate-800/80">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-500 h-4 w-4"
              />
              Exibir Preço de Venda
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={showSku}
                onChange={(e) => setShowSku(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-500 h-4 w-4"
              />
              Exibir SKU / Código
            </label>
          </div>

          {/* Pré-visualização da Etiqueta Térmica */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Pré-visualização Térmica (Preto e Branco Puro)
              </span>
              <span className="text-[11px] text-purple-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Impressão nítida para rolos térmicos
              </span>
            </div>

            {/* Box de fundo para destacar a etiqueta branca */}
            <div className="flex items-center justify-center p-6 rounded-2xl bg-slate-950 border border-slate-800/80 shadow-inner">
              {/* Visual da Etiqueta em Si (Exatamente como sai na térmica) */}
              <div
                style={{
                  width: labelConfigs.previewWidth,
                  minHeight: labelConfigs.previewMinHeight,
                }}
                className="bg-white text-black p-2 rounded-xs shadow-md flex flex-col justify-between border border-dashed border-neutral-300 select-none"
              >
                {/* Nome do Produto */}
                <div className="text-[11px] leading-tight line-clamp-2 font-bold text-neutral-900 uppercase tracking-tight">
                  {product.name}
                </div>

                {/* Conteúdo Central: QR Code + Detalhes */}
                <div className="flex items-center gap-1.5 my-1">
                  <div ref={qrRef} className="shrink-0 bg-white p-0.5">
                    <QRCodeSVG
                      value={qrValue}
                      size={labelConfigs.qrPreviewPx}
                      level="M"
                      marginSize={0}
                      fgColor="#000000"
                      bgColor="#ffffff"
                    />
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden">
                    {showSku && (
                      <div className="text-[9px] text-neutral-700 font-mono font-bold truncate">
                        {product.sku || product.barcode || 'S/ SKU'}
                      </div>
                    )}
                    {product.brand && (
                      <div className="text-[7.5px] text-neutral-500 uppercase truncate">
                        {product.brand}
                      </div>
                    )}
                    <div className="text-[6.5px] text-neutral-400 font-mono mt-0.5">
                      MUNDOMIX
                    </div>
                  </div>
                </div>

                {/* Rodapé: Preço de Venda */}
                {showPrice && (
                  <div className="flex items-baseline justify-between border-t border-neutral-300 pt-0.5">
                    <span className="text-[7.5px] font-bold text-neutral-600 uppercase">
                      À VISTA
                    </span>
                    <span className="text-[13px] text-black font-black font-mono tracking-tight">
                      {formattedPrice}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Código em Texto / Ações rápidas */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-850/40 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 text-slate-400 truncate">
              <QrCode className="h-4 w-4 text-purple-400 shrink-0" />
              <span className="font-mono text-slate-200 truncate">
                Código QR: {qrValue}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCode}
              className="h-7 text-xs text-purple-400 hover:text-purple-300 gap-1"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
        </div>

        {/* Footer de Ação */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="text-xs text-slate-400">
            Total a imprimir: <strong className="text-white">{copies}</strong>{' '}
            {copies === 1 ? 'etiqueta' : 'etiquetas'}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Fechar
            </Button>

            <Button
              onClick={handlePrint}
              className="bg-purple-600 hover:bg-purple-500 text-white gap-2 font-semibold text-xs shadow-lg shadow-purple-600/20"
            >
              <Printer className="h-4 w-4" />
              Imprimir na Térmica
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
