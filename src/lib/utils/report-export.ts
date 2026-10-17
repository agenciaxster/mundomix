import * as XLSX from 'xlsx'

export interface ExportReportOptions {
  filename: string
  title: string
  filters?: {
    companyName?: string
    branchName?: string
    dateRange?: string
    sellerName?: string
    paymentMethod?: string
    [key: string]: string | undefined
  }
  columns: {
    header: string
    key: string
    formatter?: (val: any) => string | number
  }[]
  data: Record<string, any>[]
}

/**
 * Exporta dados tabulares para planilha Excel (.xlsx) com cabeçalho de auditoria
 */
export function exportToExcel(options: ExportReportOptions) {
  const { filename, title, filters, columns, data } = options

  // Cabeçalho institucional e metadados de filtros
  const metaRows: (string | number)[][] = [
    [title.toUpperCase()],
    [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
  ]

  if (filters) {
    const filterTexts = Object.entries(filters)
      .filter(([_, v]) => Boolean(v))
      .map(([k, v]) => `${k}: ${v}`)
    if (filterTexts.length > 0) {
      metaRows.push([`Filtros aplicados: ${filterTexts.join(' | ')}`])
    }
  }

  metaRows.push([]) // Linha em branco

  // Cabeçalhos de colunas
  const headerRow = columns.map((col) => col.header)
  metaRows.push(headerRow)

  // Linhas de dados formatadas
  const dataRows = data.map((item) => {
    return columns.map((col) => {
      const rawVal = item[col.key]
      if (col.formatter) {
        return col.formatter(rawVal)
      }
      return rawVal !== null && rawVal !== undefined ? rawVal : '-'
    })
  })

  const fullSheetData = [...metaRows, ...dataRows]

  const ws = XLSX.utils.aoa_to_sheet(fullSheetData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório')

  const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(wb, safeFilename)
}

/**
 * Exporta dados tabulares para CSV UTF-8 com BOM
 */
export function exportToCsv(options: ExportReportOptions) {
  const { filename, title, filters, columns, data } = options

  const lines: string[] = []
  lines.push(`"${title.toUpperCase()}"`)
  lines.push(`"Gerado em: ${new Date().toLocaleString('pt-BR')}"`)

  if (filters) {
    const filterTexts = Object.entries(filters)
      .filter(([_, v]) => Boolean(v))
      .map(([k, v]) => `${k}: ${v}`)
    if (filterTexts.length > 0) {
      lines.push(`"Filtros: ${filterTexts.join(' | ')}"`)
    }
  }

  lines.push('') // Linha em branco

  // Cabeçalhos
  lines.push(columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(';'))

  // Dados
  for (const item of data) {
    const row = columns.map((col) => {
      let val = item[col.key]
      if (col.formatter) {
        val = col.formatter(val)
      }
      if (val === null || val === undefined) val = ''
      const strVal = String(val).replace(/"/g, '""')
      return `"${strVal}"`
    })
    lines.push(row.join(';'))
  }

  const csvContent = '\uFEFF' + lines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Dispara diálogo de impressão nativo do navegador
 */
export function triggerPrint() {
  window.print()
}
