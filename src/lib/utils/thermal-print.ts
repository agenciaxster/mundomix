import type { ReceiptPaperWidth } from '@/types/receipt'

/**
 * Utilitário de impressão térmica profissional para navegadores web.
 * Utiliza um iframe isolado para garantir que estilos da interface,
 * cabeçalhos do navegador, sidebars e modais não interfiram na impressão do rolo térmico.
 */
export function printThermalReceiptHtml(
  htmlContent: string,
  paperWidth: ReceiptPaperWidth = '80mm'
): Promise<boolean> {
  return new Promise((resolve) => {
    // 1. Remove qualquer iframe de impressão residual anterior
    const existing = document.getElementById('thermal-receipt-iframe')
    if (existing) {
      existing.remove()
    }

    // 2. Cria o iframe oculto
    const iframe = document.createElement('iframe')
    iframe.id = 'thermal-receipt-iframe'
    iframe.style.position = 'fixed'
    iframe.style.top = '-9999px'
    iframe.style.left = '-9999px'
    iframe.style.width = paperWidth === '58mm' ? '58mm' : '80mm'
    iframe.style.height = '100px'
    iframe.style.border = 'none'
    iframe.style.zIndex = '-1000'

    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      console.error('Falha ao acessar documento do iframe de impressão.')
      iframe.remove()
      resolve(false)
      return
    }

    // Largura útil e espaçamentos
    const contentWidth = paperWidth === '58mm' ? '48mm' : '72mm'
    const fontSize = paperWidth === '58mm' ? '11px' : '12px'

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Comprovante Não Fiscal</title>
        <style>
          @page {
            size: auto;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: ${fontSize};
            line-height: 1.25;
            width: ${contentWidth};
            margin: 0 auto;
            padding: 3mm 1mm;
          }
          .thermal-receipt {
            width: 100%;
          }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .uppercase { text-transform: uppercase; }
          .truncate {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 4px 0;
            width: 100%;
          }
          .divider-double {
            border-top: 2px solid #000;
            margin: 4px 0;
            width: 100%;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin: 2px 0;
          }
          .cut-line {
            margin: 14px 0;
            border-top: 1px dashed #444;
            text-align: center;
            position: relative;
          }
          .cut-badge {
            display: inline-block;
            background: #fff;
            padding: 0 4px;
            font-size: 10px;
            position: relative;
            top: -7px;
          }
          @media print {
            body {
              width: ${contentWidth};
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `

    doc.open()
    doc.write(fullHtml)
    doc.close()

    // Aguarda carregar e renderizar fontes para disparar a janela de impressão
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()

        // Remove o iframe após a impressão ou cancelamento
        setTimeout(() => {
          try {
            iframe.remove()
          } catch {
            // Ignora
          }
          resolve(true)
        }, 1500)
      } catch (err) {
        console.error('Erro ao acionar janela de impressão:', err)
        iframe.remove()
        resolve(false)
      }
    }, 250)
  })
}
