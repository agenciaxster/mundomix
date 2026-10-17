import * as XLSX from 'xlsx'

export interface ActiveColumnInfo {
  colIndex: number
  headerTitle: string
  sampleValue: string
}

export interface ColumnMappingConfig {
  headerRowIndex: number
  nameCol: number | null
  skuCol: number | null
  barcodeCol: number | null
  unitCol: number | null
  costPriceCol: number | null
  salePriceCol: number | null
  wholesalePriceCol: number | null
  wholesaleMinQtyCol: number | null
  initialStockCol: number | null
  minStockCol: number | null
  categoryCol: number | null
  brandCol: number | null
  salePriceMode: 'direct' | 'use_cost' | 'markup'
  markupPercentage: number
}

export interface ParsedItemRow {
  originalRowNumber: number
  name: string
  sku: string | null
  barcode: string | null
  unit: string
  costPrice: number
  salePrice: number
  wholesalePrice: number | null
  wholesaleMinQty: number | null
  initialStock: number
  minStock: number
  category: string | null
  brand: string | null
  status: 'valid' | 'invalid' | 'ignored'
  ignoreReason?: string
  errorField?: string
  errorMessage?: string
  errorFix?: string
  isExistingInDb?: boolean
  existingProductId?: string
}

export interface SpreadsheetAnalysisResult {
  sheetName: string
  allSheetNames: string[]
  totalRows: number
  detectedHeaderRowIndex: number
  availableColumns: ActiveColumnInfo[]
  suggestedMapping: ColumnMappingConfig
  matrix: string[][]
}

/**
 * Converte qualquer representação numérica brasileira ou internacional para float seguro com 2 casas
 */
export function parseBrazilianNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  let str = String(val).trim()
  if (!str) return 0

  // Se tiver formato tipo 1.234,56 ou 1,234.56
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // 1.234,56 -> 1234.56
      str = str.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234.56 -> 1234.56
      str = str.replace(/,/g, '')
    }
  } else if (str.includes(',')) {
    // 6,86 -> 6.86
    str = str.replace(',', '.')
  }

  // Remove caracteres residuais como R$, espaços, etc.
  str = str.replace(/[^0-9.-]/g, '')
  const n = parseFloat(str)
  return isNaN(n) ? 0 : n
}

/**
 * Normaliza e limpa código de barras preservando todos os dígitos e zeros à esquerda como texto
 */
export function normalizeBarcode(val: any): string | null {
  if (val === null || val === undefined) return null
  const str = String(val).trim()
  if (!str || str === '0' || str === '-' || str === 'null') return null

  // Remove notação científica do Excel como 7.89102E+12
  if (str.includes('E+') || str.includes('e+')) {
    try {
      const num = Number(str)
      if (!isNaN(num)) return BigInt(Math.round(num)).toString()
    } catch {}
  }

  // Mantém apenas dígitos e traços
  const clean = str.replace(/[^0-9A-Za-z-]/g, '')
  return clean.length >= 3 ? clean : null
}

/**
 * Normaliza SKU / Código interno do produto
 */
export function normalizeSku(val: any): string | null {
  if (val === null || val === undefined) return null
  const str = String(val).trim()
  if (!str || str === '-' || str === 'null') return null
  return str
}

/**
 * Normaliza Unidade de Medida (UN, DZ, PCT, CRT, KG, L, MT, CX, etc.)
 */
export function normalizeUnit(val: any): string {
  if (val === null || val === undefined) return 'UN'
  const str = String(val).trim().toUpperCase()
  if (!str || str === '-') return 'UN'
  return str.slice(0, 10)
}

/**
 * Localiza a linha mais provável de cabeçalho na matriz de células
 */
export function findHeaderRowIndex(matrix: string[][]): { bestRow: number; maxScore: number } {
  const keywords = [
    'código',
    'codigo',
    'cod',
    'sku',
    'descrição',
    'descricao',
    'produto',
    'produtos',
    'serviços',
    'servicos',
    'item',
    'ean',
    'barras',
    'barcode',
    'unitário',
    'unitario',
    'custo',
    'venda',
    'preco',
    'preço',
    'qtde',
    'qtd',
    'quantidade',
    'unidade',
    'tipo',
    'estoque',
  ]

  let bestRow = 0
  let maxScore = 0

  for (let r = 0; r < Math.min(matrix.length, 40); r++) {
    const row = matrix[r]
    let score = 0
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase().trim()
      if (!cell) continue
      for (const kw of keywords) {
        if (cell === kw || cell.includes(kw)) {
          score++
          break
        }
      }
    }
    if (score > maxScore) {
      maxScore = score
      bestRow = r
    }
  }

  return { bestRow, maxScore }
}

/**
 * Analisa e extrai estrutura de um arquivo (.xls, .xlsx, .csv)
 */
export async function analyzeSpreadsheet(file: File): Promise<SpreadsheetAnalysisResult> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, {
    type: 'array',
    raw: false, // Preserva strings formatadas como textos de código e barras
    cellDates: true,
  })

  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const matrix: string[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: '',
  })

  const { bestRow: detectedHeaderRowIndex } = findHeaderRowIndex(matrix)
  const headerRow = matrix[detectedHeaderRowIndex] || []

  // Amostra de linhas de dados posteriores ao cabeçalho para validar onde os dados reais estão
  const sampleDataRows = matrix
    .slice(detectedHeaderRowIndex + 1, detectedHeaderRowIndex + 25)
    .filter((r) => r.some((c) => c && String(c).trim() !== ''))

  // Contabiliza colunas ativas com dados reais
  const colDataCount: Record<number, number> = {}
  sampleDataRows.forEach((r) => {
    r.forEach((v, c) => {
      if (v && String(v).trim() !== '') {
        colDataCount[c] = (colDataCount[c] || 0) + 1
      }
    })
  })

  const availableColumns: ActiveColumnInfo[] = []
  const activeColIndices = Object.keys(colDataCount)
    .map(Number)
    .sort((a, b) => a - b)

  for (const c of activeColIndices) {
    let title = String(headerRow[c] || '').trim()
    // Se a coluna não tiver título no cabeçalho exato, procura na adjacente (ex: colunas com colspan ou deslocamento)
    if (!title && headerRow[c + 1]) title = String(headerRow[c + 1]).trim()
    if (!title && headerRow[c - 1]) title = String(headerRow[c - 1]).trim()
    if (!title && headerRow[c + 2]) title = String(headerRow[c + 2]).trim()

    const firstSample = sampleDataRows.find((r) => r[c] && String(r[c]).trim() !== '')
    const sampleValue = firstSample ? String(firstSample[c]).trim() : ''

    availableColumns.push({
      colIndex: c,
      headerTitle: title || `Coluna ${c + 1}`,
      sampleValue,
    })
  }

  // Se nenhuma coluna foi detectada via dados, lista todas as colunas que possuem cabeçalho
  if (availableColumns.length === 0 && headerRow.length > 0) {
    headerRow.forEach((h, c) => {
      if (h && String(h).trim() !== '') {
        availableColumns.push({
          colIndex: c,
          headerTitle: String(h).trim(),
          sampleValue: '',
        })
      }
    })
  }

  // Auto-sugestão de mapeamento de colunas
  const suggestedMapping = suggestColumnMapping(detectedHeaderRowIndex, availableColumns)

  return {
    sheetName,
    allSheetNames: wb.SheetNames,
    totalRows: matrix.length,
    detectedHeaderRowIndex,
    availableColumns,
    suggestedMapping,
    matrix,
  }
}

/**
 * Sugere mapeamento de colunas com base em títulos e amostras
 */
export function suggestColumnMapping(
  headerRowIndex: number,
  availableColumns: ActiveColumnInfo[]
): ColumnMappingConfig {
  const findExactOrIncludes = (
    exactKeywords: string[],
    includeKeywords: string[] = [],
    excludeKeywords: string[] = []
  ): number | null => {
    // 1. Prioridade máxima: correspondência exata
    for (const col of availableColumns) {
      const cleanTitle = col.headerTitle.toLowerCase().trim()
      const normalized = cleanTitle.replace(/[^a-z0-9]/g, '')
      if (excludeKeywords.some((ex) => cleanTitle.includes(ex) || normalized.includes(ex))) {
        continue
      }
      for (const kw of exactKeywords) {
        const cleanKw = kw.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (cleanTitle === kw || normalized === cleanKw) {
          return col.colIndex
        }
      }
    }

    // 2. Segunda prioridade: substring match
    for (const col of availableColumns) {
      const cleanTitle = col.headerTitle.toLowerCase().trim()
      const normalized = cleanTitle.replace(/[^a-z0-9]/g, '')
      if (excludeKeywords.some((ex) => cleanTitle.includes(ex) || normalized.includes(ex))) {
        continue
      }
      for (const kw of [...exactKeywords, ...includeKeywords]) {
        const cleanKw = kw.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (cleanTitle.includes(kw) || normalized.includes(cleanKw)) {
          return col.colIndex
        }
      }
    }

    return null
  }

  // Barcode deve ser mapeado antes de SKU para evitar que "código de barras" seja pego como SKU
  const barcodeCol = findExactOrIncludes(
    ['ean', 'código de barras', 'codigo de barras', 'barcode', 'gtin', 'barras'],
    ['ean', 'barras', 'barcode']
  )

  const skuCol = findExactOrIncludes(
    ['sku', 'código interno', 'codigo interno', 'código', 'codigo', 'cod', 'ref', 'referencia'],
    ['sku', 'código', 'codigo', 'cod'],
    ['barras', 'ean', 'barcode', 'gtin', 'serviço', 'servico']
  )

  const nameCol = findExactOrIncludes(
    [
      'descrição produtos / serviços',
      'descrição do produto',
      'descricao do produto',
      'nome do produto',
      'descrição',
      'descricao',
      'nome',
      'produto',
    ],
    ['descri', 'produto'],
    ['tipo', 'unidade', 'unid', 'grupo', 'categoria']
  )

  const unitCol = findExactOrIncludes(
    ['unidade', 'unid', 'un', 'und', 'tipo', 'medida', 'u.m.'],
    ['unidade', 'tipo'],
    ['unitário', 'unitario']
  )

  const costPriceCol = findExactOrIncludes(
    [
      'preço de custo',
      'preco de custo',
      'unitário',
      'unitario',
      'custo unitário',
      'custo unitario',
      'valor unitário',
      'valor unitario',
      'custo',
      'vl unit',
    ],
    ['custo', 'unitário', 'unitario'],
    ['total', 'venda', 'varejo', 'atacado']
  )

  const salePriceCol = findExactOrIncludes(
    [
      'preço de varejo',
      'preco de varejo',
      'preço de venda',
      'preco de venda',
      'preço',
      'preco',
      'valor de venda',
      'venda',
    ],
    ['varejo', 'venda', 'preço', 'preco'],
    ['custo', 'unitário', 'unitario', 'total', 'atacado']
  )

  const wholesalePriceCol = findExactOrIncludes(
    ['preço de atacado', 'preco de atacado', 'valor atacado', 'atacado'],
    ['atacado'],
    ['mínimo', 'minimo', 'min', 'qtd', 'quantidade']
  )

  const wholesaleMinQtyCol = findExactOrIncludes(
    ['mínimo atacado', 'minimo atacado', 'min atacado', 'qtd atacado', 'quantidade atacado'],
    ['min atacado', 'qtd atacado']
  )

  const initialStockCol = findExactOrIncludes(
    [
      'estoque inicial',
      'estoque',
      'saldo',
      'quantidade',
      'qtde',
      'qtd',
      'qtde /',
      'saldo atual',
    ],
    ['estoque', 'qtde', 'quantidade', 'saldo'],
    ['mínimo', 'minimo', 'min', 'atacado', 'critico']
  )

  const minStockCol = findExactOrIncludes(
    ['estoque mínimo', 'estoque minimo', 'minimo', 'mínimo', 'est min', 'estoque min'],
    ['minimo', 'mínimo']
  )

  const categoryCol = findExactOrIncludes(
    ['categoria', 'departamento', 'seção', 'secao', 'grupo'],
    ['categoria', 'depto', 'secao']
  )

  const brandCol = findExactOrIncludes(
    ['marca', 'fabricante'],
    ['marca', 'fabricante']
  )

  return {
    headerRowIndex,
    nameCol,
    skuCol,
    barcodeCol,
    unitCol,
    costPriceCol,
    salePriceCol,
    wholesalePriceCol,
    wholesaleMinQtyCol,
    initialStockCol,
    minStockCol,
    categoryCol,
    brandCol,
    salePriceMode: 'use_cost',
    markupPercentage: 30,
  }
}

/**
 * Processa a matriz de células aplicando as regras de mapeamento e validação
 */
export function parseProductsFromMatrix(
  matrix: string[][],
  config: ColumnMappingConfig
): ParsedItemRow[] {
  const result: ParsedItemRow[] = []

  const headerIdx = config.headerRowIndex

  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r]
    const rowNum = r + 1

    // 1. Linhas antes do cabeçalho são ignoradas (dados comerciais, cabeçalhos de empresa)
    if (r <= headerIdx) {
      if (r < headerIdx) {
        const text = row.filter(Boolean).join(' | ').trim()
        if (text) {
          result.push({
            originalRowNumber: rowNum,
            name: text.slice(0, 40),
            sku: null,
            barcode: null,
            unit: 'UN',
            costPrice: 0,
            salePrice: 0,
            wholesalePrice: null,
            wholesaleMinQty: null,
            initialStock: 0,
            minStock: 0,
            category: null,
            brand: null,
            status: 'ignored',
            ignoreReason: 'Metadados da empresa/pedido antes do cabeçalho de produtos',
          })
        }
      }
      continue
    }

    // 2. Linha totalmente vazia
    const hasAnyValue = row.some((c) => c !== null && c !== undefined && String(c).trim() !== '')
    if (!hasAnyValue) {
      continue
    }

    // 3. Verifica indicadores de rodapé, quebras de página ou totalizadores
    const rowFullText = row.filter(Boolean).join(' ').toLowerCase()
    if (
      rowFullText.includes('qtde de produtos:') ||
      rowFullText.includes('qtde de itens:') ||
      rowFullText.includes('valor total produtos:') ||
      rowFullText.includes('valor total:') ||
      rowFullText.includes('desconto:') ||
      rowFullText.includes('chave pix:') ||
      rowFullText.includes('razão: mv') ||
      rowFullText.includes('relação de produtos')
    ) {
      result.push({
        originalRowNumber: rowNum,
        name: row.filter(Boolean).slice(0, 3).join(' '),
        sku: null,
        barcode: null,
        unit: 'UN',
        costPrice: 0,
        salePrice: 0,
        wholesalePrice: null,
        wholesaleMinQty: null,
        initialStock: 0,
        minStock: 0,
        category: null,
        brand: null,
        status: 'ignored',
        ignoreReason: 'Totalizador ou rodapé financeiro da planilha',
      })
      continue
    }

    // Indicador de paginação (ex: "1 / 2" ou "2 / 2")
    if (rowFullText.includes('/ 2') || rowFullText.includes('/ 3') || rowFullText.includes('/ 4')) {
      result.push({
        originalRowNumber: rowNum,
        name: 'Paginação',
        sku: null,
        barcode: null,
        unit: 'UN',
        costPrice: 0,
        salePrice: 0,
        wholesalePrice: null,
        wholesaleMinQty: null,
        initialStock: 0,
        minStock: 0,
        category: null,
        brand: null,
        status: 'ignored',
        ignoreReason: 'Indicador de numeração de página',
      })
      continue
    }

    // Cabeçalho repetido em páginas seguintes
    if (
      (rowFullText.includes('descrição') || rowFullText.includes('descricao')) &&
      (rowFullText.includes('código') || rowFullText.includes('codigo') || rowFullText.includes('ean'))
    ) {
      result.push({
        originalRowNumber: rowNum,
        name: 'Cabeçalho da Página',
        sku: null,
        barcode: null,
        unit: 'UN',
        costPrice: 0,
        salePrice: 0,
        wholesalePrice: null,
        wholesaleMinQty: null,
        initialStock: 0,
        minStock: 0,
        category: null,
        brand: null,
        status: 'ignored',
        ignoreReason: 'Cabeçalho repetido de nova página',
      })
      continue
    }

    // 4. Extração dos campos mapeados
    const getCol = (colIdx: number | null): any => {
      if (colIdx === null || colIdx === undefined || colIdx < 0) return ''
      return row[colIdx] ?? ''
    }

    const rawName = String(getCol(config.nameCol)).trim()
    const rawSku = normalizeSku(getCol(config.skuCol))
    const rawBarcode = normalizeBarcode(getCol(config.barcodeCol))
    const rawUnit = normalizeUnit(getCol(config.unitCol))
    const rawCategory = String(getCol(config.categoryCol)).trim() || null
    const rawBrand = String(getCol(config.brandCol)).trim() || null

    const costPrice = Math.max(0, parseBrazilianNumber(getCol(config.costPriceCol)))
    let salePrice = Math.max(0, parseBrazilianNumber(getCol(config.salePriceCol)))

    // Aplicação da regra de preço de venda se não foi fornecido diretamente
    if (salePrice <= 0.001) {
      if (config.salePriceMode === 'use_cost' && costPrice > 0) {
        salePrice = costPrice
      } else if (config.salePriceMode === 'markup' && costPrice > 0) {
        const factor = 1 + (config.markupPercentage || 0) / 100
        salePrice = Math.round(costPrice * factor * 100) / 100
      }
    }

    const wholesalePrice = config.wholesalePriceCol !== null ? parseBrazilianNumber(getCol(config.wholesalePriceCol)) : 0
    const wholesaleMinQty = config.wholesaleMinQtyCol !== null ? parseBrazilianNumber(getCol(config.wholesaleMinQtyCol)) : 0
    const initialStock = Math.max(0, parseBrazilianNumber(getCol(config.initialStockCol)))
    const minStock = Math.max(0, parseBrazilianNumber(getCol(config.minStockCol)))

    // 5. Validação rigorosa e explicativa da linha
    if (!rawName) {
      result.push({
        originalRowNumber: rowNum,
        name: `Linha ${rowNum} (Sem Descrição)`,
        sku: rawSku,
        barcode: rawBarcode,
        unit: rawUnit,
        costPrice,
        salePrice,
        wholesalePrice: wholesalePrice > 0 ? wholesalePrice : null,
        wholesaleMinQty: wholesaleMinQty > 0 ? wholesaleMinQty : null,
        initialStock,
        minStock,
        category: rawCategory,
        brand: rawBrand,
        status: 'invalid',
        errorField: 'Nome do Produto',
        errorMessage: 'A coluna de nome/descrição está vazia nesta linha.',
        errorFix: 'Verifique se a coluna correta de Nome foi mapeada ou informe o nome do item na planilha.',
      })
      continue
    }

    if (rawName.length < 2) {
      result.push({
        originalRowNumber: rowNum,
        name: rawName,
        sku: rawSku,
        barcode: rawBarcode,
        unit: rawUnit,
        costPrice,
        salePrice,
        wholesalePrice: wholesalePrice > 0 ? wholesalePrice : null,
        wholesaleMinQty: wholesaleMinQty > 0 ? wholesaleMinQty : null,
        initialStock,
        minStock,
        category: rawCategory,
        brand: rawBrand,
        status: 'invalid',
        errorField: 'Nome do Produto',
        errorMessage: 'Nome do produto muito curto (menos de 2 caracteres).',
        errorFix: 'Corrija o nome do produto na planilha para ter pelo menos 2 caracteres.',
      })
      continue
    }

    if (costPrice < 0 || salePrice < 0) {
      result.push({
        originalRowNumber: rowNum,
        name: rawName,
        sku: rawSku,
        barcode: rawBarcode,
        unit: rawUnit,
        costPrice,
        salePrice,
        wholesalePrice: wholesalePrice > 0 ? wholesalePrice : null,
        wholesaleMinQty: wholesaleMinQty > 0 ? wholesaleMinQty : null,
        initialStock,
        minStock,
        category: rawCategory,
        brand: rawBrand,
        status: 'invalid',
        errorField: 'Preço',
        errorMessage: 'Preço negativo não é permitido.',
        errorFix: 'Ajuste os valores unitários para serem iguais ou superiores a zero.',
      })
      continue
    }

    // Linha de produto válida
    result.push({
      originalRowNumber: rowNum,
      name: rawName,
      sku: rawSku,
      barcode: rawBarcode,
      unit: rawUnit,
      costPrice,
      salePrice,
      wholesalePrice: wholesalePrice > 0 ? wholesalePrice : null,
      wholesaleMinQty: wholesaleMinQty > 0 ? wholesaleMinQty : null,
      initialStock,
      minStock,
      category: rawCategory,
      brand: rawBrand,
      status: 'valid',
    })
  }

  return result
}

/**
 * Gera um arquivo CSV com o relatório detalhado de erros para download
 */
export function generateErrorsCsv(items: ParsedItemRow[]): string {
  const errorItems = items.filter((i) => i.status === 'invalid')
  const headers = [
    'Linha Original',
    'Código/SKU',
    'Nome Identificado',
    'Campo com Problema',
    'Motivo Específico do Erro',
    'Como Corrigir',
  ]

  const rows = errorItems.map((item) => [
    item.originalRowNumber,
    item.sku ? `"${item.sku.replace(/"/g, '""')}"` : '""',
    `"${item.name.replace(/"/g, '""')}"`,
    `"${(item.errorField || 'Geral').replace(/"/g, '""')}"`,
    `"${(item.errorMessage || 'Dados inválidos').replace(/"/g, '""')}"`,
    `"${(item.errorFix || 'Verifique a planilha').replace(/"/g, '""')}"`,
  ])

  // Adiciona BOM UTF-8 (\uFEFF) para abrir perfeitamente no Excel brasileiro com separador ponto e vírgula
  const csvContent =
    '\uFEFF' +
    [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n')

  return csvContent
}
