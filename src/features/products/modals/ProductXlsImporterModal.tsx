import { useState, useRef, useEffect, useMemo } from 'react'
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Trash2,
  Settings2,
  ChevronDown,
  ChevronUp,
  FileDown,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useAuth } from '@/hooks/useAuth'
import { productService } from '@/lib/services/product.service'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/useToast'
import {
  analyzeSpreadsheet,
  parseProductsFromMatrix,
  generateErrorsCsv,
} from '@/lib/utils/product-importer-parser'
import type {
  ColumnMappingConfig,
  ActiveColumnInfo,
  ParsedItemRow,
} from '@/lib/utils/product-importer-parser'
import { usePricingSettings } from '@/hooks/usePricingSettings'

interface ProductXlsImporterModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  onImportSuccess?: () => void
}

type FilterTab = 'all' | 'valid' | 'existing' | 'error' | 'ignored'

export function ProductXlsImporterModal({
  isOpen,
  onClose,
  onSuccess,
  onImportSuccess,
}: ProductXlsImporterModalProps) {
  const { activeCompany, activeBranch } = useAuth()
  const { pricingSettings, getMarkupPrice } = usePricingSettings()

  const [file, setFile] = useState<File | null>(null)
  const [matrix, setMatrix] = useState<string[][]>([])
  const [availableCols, setAvailableCols] = useState<ActiveColumnInfo[]>([])
  const [mappingConfig, setMappingConfig] = useState<ColumnMappingConfig | null>(null)

  const [parsedRows, setParsedRows] = useState<ParsedItemRow[]>([])
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  // Estados de Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Estados de Edição de Linha
  const [editingRow, setEditingRow] = useState<ParsedItemRow | null>(null)
  const [editingForm, setEditingForm] = useState<Partial<ParsedItemRow>>({})
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const [showMappingPanel, setShowMappingPanel] = useState(false)
  const [updateExisting, setUpdateExisting] = useState(true)

  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<{
    imported: number
    updated: number
    errors: string[]
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reseta estados ao fechar ou reabrir
  useEffect(() => {
    if (!isOpen) {
      setFile(null)
      setMatrix([])
      setAvailableCols([])
      setMappingConfig(null)
      setParsedRows([])
      setImportSummary(null)
      setShowMappingPanel(false)
      setCurrentPage(1)
      setEditingRow(null)
    }
  }, [isOpen])

  // Volta para página 1 ao trocar de aba
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  // 1. Gera e faz download do modelo oficial de planilha Excel (.xlsx)
  function handleDownloadTemplate() {
    try {
      const headers = [
        'Nome do Produto',
        'SKU',
        'Código de Barras',
        'Categoria',
        'Marca',
        'Unidade',
        'Preço de Custo',
        'Preço de Varejo',
        'Preço de Atacado',
        'Mínimo Atacado',
        'Estoque Inicial',
        'Estoque Mínimo',
      ]

      const sampleData = [
        [
          'Cimento CP II-E-32 50kg',
          'CIM-50KG',
          '7891234567890',
          'Alvenaria',
          'Votoran',
          'SC',
          24.5,
          36.9,
          31.9,
          10,
          50,
          10,
        ],
        [
          'Tinta Acrílica Fosca 18L Branco Neve',
          'TNT-18L',
          '7898765432109',
          'Tintas',
          'Suvinil',
          'GL',
          210.0,
          349.9,
          309.0,
          3,
          15,
          4,
        ],
        [
          'Tubo PVC Esgoto 100mm Barra 6m',
          'TUB-100',
          '7896543210987',
          'Hidráulica',
          'Tigre',
          'BR',
          38.0,
          59.9,
          51.5,
          6,
          30,
          5,
        ],
      ]

      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Produtos')

      XLSX.writeFile(wb, 'modelo_importacao_produtos_mundomix.xlsx')
      toast.success('Modelo de planilha baixado com sucesso!')
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao gerar modelo de planilha.')
    }
  }

  // 2. Lê e analisa a planilha carregada (.xls, .xlsx, .csv)
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setIsProcessingFile(true)
    setImportSummary(null)

    try {
      const analysis = await analyzeSpreadsheet(selected)
      setMatrix(analysis.matrix)
      setAvailableCols(analysis.availableColumns)
      setMappingConfig(analysis.suggestedMapping)

      // Reprocessa os itens com o mapeamento detectado
      await reprocessMatrix(analysis.matrix, analysis.suggestedMapping)

      toast.success(`Planilha "${selected.name}" analisada com sucesso!`)
    } catch (err: any) {
      console.error('Erro ao processar planilha:', err)
      toast.error(`Falha ao ler planilha: ${err.message || 'Verifique o formato do arquivo.'}`)
    } finally {
      setIsProcessingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // 3. Reprocessa linhas com checagem de duplicidade no Supabase
  async function reprocessMatrix(mat: string[][], cfg: ColumnMappingConfig) {
    if (!mat || mat.length === 0 || !cfg) return

    const parsed = parseProductsFromMatrix(mat, cfg)

    // Checagem prévia de duplicidade no Supabase
    if (activeCompany?.id) {
      try {
        const candidateItems = parsed.filter((p) => p.status === 'valid')
        const existingMap = await productService.checkExistingProducts(
          activeCompany.id,
          candidateItems.map((c) => ({ sku: c.sku, barcode: c.barcode }))
        )

        for (const item of parsed) {
          if (item.status === 'valid') {
            let match = false
            if (item.sku && existingMap.has(`sku:${item.sku.toLowerCase()}`)) {
              match = true
              item.existingProductId = existingMap.get(`sku:${item.sku.toLowerCase()}`)?.id
            } else if (item.barcode && existingMap.has(`barcode:${item.barcode}`)) {
              match = true
              item.existingProductId = existingMap.get(`barcode:${item.barcode}`)?.id
            }
            item.isExistingInDb = match
          }
        }
      } catch (checkErr) {
        console.warn('Aviso ao checar duplicidades existentes:', checkErr)
      }
    }

    setParsedRows(parsed)
  }

  // Atualiza um campo de mapeamento e recalcula a prévia
  function updateMappingField(field: keyof ColumnMappingConfig, value: any) {
    if (!mappingConfig) return
    const updated = { ...mappingConfig, [field]: value }
    setMappingConfig(updated)
    reprocessMatrix(matrix, updated)
  }

  // 4. Download do relatório de erros em CSV
  function handleDownloadErrorsCsv() {
    try {
      const csv = generateErrorsCsv(parsedRows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio_erros_importacao_${file?.name || 'produtos'}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Relatório de erros baixado com sucesso!')
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao gerar relatório CSV de erros.')
    }
  }

  // 5. Executa a importação real no banco
  async function handleConfirmImport() {
    if (!activeCompany?.id || !activeBranch?.id) {
      toast.error('Empresa ou filial ativa não selecionada.')
      return
    }

    const validItems = parsedRows.filter((r) => r.status === 'valid')
    if (validItems.length === 0) {
      toast.error('Nenhum produto válido para importação.')
      return
    }

    setIsImporting(true)
    try {
      const markup = pricingSettings
      const payload = validItems.map((item) => ({
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        category: item.category,
        brand: item.brand,
        unit: item.unit,
        cost_price: item.costPrice,
        // Se apply_markup_on_import ativo e sem preço de venda, calcula com markup
        sale_price:
          (!item.salePrice || item.salePrice === 0) &&
          markup?.apply_markup_on_import &&
          markup.default_markup_percentage > 0 &&
          item.costPrice > 0
            ? getMarkupPrice(item.costPrice)
            : item.salePrice,
        wholesale_price: item.wholesalePrice,
        wholesale_min_qty: item.wholesaleMinQty,
        min_stock: item.minStock,
        initial_stock: item.initialStock,
      }))

      const res = await productService.importProductsBatch(
        activeCompany.id,
        activeBranch.id,
        payload,
        { updateExisting }
      )

      setImportSummary({
        imported: res.importedCount,
        updated: res.updatedCount,
        errors: res.errors,
      })

      toast.success(
        `Sucesso: ${res.importedCount} cadastrados e ${res.updatedCount} atualizados na filial ${activeBranch.name}!`
      )
      onSuccess?.()
      onImportSuccess?.()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro durante a importação de produtos.')
    } finally {
      setIsImporting(false)
    }
  }

  // 6. Funções para Edição Manual de Linha de Produto
  function handleOpenEdit(row: ParsedItemRow) {
    setEditingRow(row)
    setEditingForm({
      name: row.name,
      sku: row.sku || '',
      barcode: row.barcode || '',
      unit: row.unit || 'UN',
      costPrice: row.costPrice || 0,
      salePrice: row.salePrice || 0,
      wholesalePrice: row.wholesalePrice || 0,
      wholesaleMinQty: row.wholesaleMinQty || 0,
      initialStock: row.initialStock || 0,
      minStock: row.minStock || 0,
      category: row.category || '',
      brand: row.brand || '',
    })
  }

  async function handleSaveEdit() {
    if (!editingRow) return
    const trimmedName = (editingForm.name || '').trim()
    if (!trimmedName) {
      toast.error('O nome do produto é obrigatório.')
      return
    }

    setIsSavingEdit(true)
    try {
      const costPrice = Math.max(0, Number(editingForm.costPrice) || 0)
      const salePrice = Math.max(0, Number(editingForm.salePrice) || 0)
      const wholesalePrice =
        Number(editingForm.wholesalePrice) > 0 ? Number(editingForm.wholesalePrice) : null
      const wholesaleMinQty =
        Number(editingForm.wholesaleMinQty) > 0 ? Number(editingForm.wholesaleMinQty) : null
      const initialStock = Math.max(0, Number(editingForm.initialStock) || 0)
      const minStock = Math.max(0, Number(editingForm.minStock) || 0)
      const sku = (editingForm.sku || '').trim() || null
      const barcode = (editingForm.barcode || '').trim() || null
      const unit = (editingForm.unit || 'UN').trim().toUpperCase() || 'UN'
      const category = (editingForm.category || '').trim() || null
      const brand = (editingForm.brand || '').trim() || null

      let isExistingInDb = false
      let existingProductId = undefined

      if (activeCompany?.id && (sku || barcode)) {
        try {
          const existingMap = await productService.checkExistingProducts(
            activeCompany.id,
            [{ sku, barcode }]
          )
          if (sku && existingMap.has(`sku:${sku.toLowerCase()}`)) {
            isExistingInDb = true
            existingProductId = existingMap.get(`sku:${sku.toLowerCase()}`)?.id
          } else if (barcode && existingMap.has(`barcode:${barcode}`)) {
            isExistingInDb = true
            existingProductId = existingMap.get(`barcode:${barcode}`)?.id
          }
        } catch (err) {
          console.warn('Erro ao checar duplicidade:', err)
        }
      }

      const updatedRow: ParsedItemRow = {
        ...editingRow,
        name: trimmedName,
        sku,
        barcode,
        unit,
        costPrice,
        salePrice,
        wholesalePrice,
        wholesaleMinQty,
        initialStock,
        minStock,
        category,
        brand,
        status: 'valid',
        errorField: undefined,
        errorMessage: undefined,
        errorFix: undefined,
        ignoreReason: undefined,
        isExistingInDb,
        existingProductId,
      }

      setParsedRows((prev) =>
        prev.map((r) =>
          r.originalRowNumber === editingRow.originalRowNumber ? updatedRow : r
        )
      )

      setEditingRow(null)
      toast.success(`Linha #${editingRow.originalRowNumber} atualizada com sucesso!`)
    } catch (err: any) {
      console.error('Erro ao salvar edição:', err)
      toast.error('Erro ao salvar alterações no produto.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Contadores
  const validRows = useMemo(() => parsedRows.filter((r) => r.status === 'valid'), [parsedRows])
  const newValidRows = useMemo(() => validRows.filter((r) => !r.isExistingInDb), [validRows])
  const existingValidRows = useMemo(() => validRows.filter((r) => r.isExistingInDb), [validRows])
  const invalidRows = useMemo(() => parsedRows.filter((r) => r.status === 'invalid'), [parsedRows])
  const ignoredRows = useMemo(() => parsedRows.filter((r) => r.status === 'ignored'), [parsedRows])

  // Filtragem da tabela
  const filteredRows = useMemo(() => {
    switch (activeTab) {
      case 'valid':
        return validRows
      case 'existing':
        return existingValidRows
      case 'error':
        return invalidRows
      case 'ignored':
        return ignoredRows
      default:
        return parsedRows.filter((r) => r.status !== 'ignored') // Por padrão mostra válidos e erros
    }
  }, [parsedRows, activeTab, validRows, existingValidRows, invalidRows, ignoredRows])

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage, pageSize])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-4 sm:my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Importador Inteligente de Produtos
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                  XLS, XLSX e CSV
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Suporta pedidos comerciais com cabeçalhos de empresa, notas fiscais, EAN e centavos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto scrollbar-thin flex-1">
          {/* Seção 1: Upload e Ações Iniciais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Download Modelo */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1">
                  1. Modelo Padrão de Planilha
                </span>
                <p className="text-[11px] text-slate-400">
                  Planilha simples em branco com todas as colunas pré-configuradas para preencher e importar.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="mt-3 border-slate-700 text-slate-200 hover:bg-slate-800 text-xs gap-1.5 w-full"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar Modelo Excel (.xlsx)
              </Button>
            </div>

            {/* Upload Planilha */}
            <div className="flex flex-col justify-between rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 p-4 text-center">
              <div>
                <Upload className="h-6 w-6 text-emerald-400 mx-auto mb-1.5" />
                <span className="text-xs font-semibold text-white block">
                  2. Carregar Planilha de Produtos
                </span>
                <p className="text-[11px] text-slate-400">
                  {file ? (
                    <span className="text-emerald-400 font-medium">
                      Arquivo: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  ) : (
                    'Selecione arquivo comercial (.XLS), planilha (.XLSX) ou (.CSV)'
                  )}
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <Button
                type="button"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile || isImporting}
                className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5 w-full font-medium shadow-md shadow-emerald-700/20"
              >
                {isProcessingFile ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Processando e analisando colunas...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    {file ? 'Substituir Arquivo' : 'Selecionar Arquivo'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Resultado de Importação Concluída */}
          {importSummary && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span>
                  Importação Finalizada: {importSummary.imported} novos produtos cadastrados e{' '}
                  {importSummary.updated} atualizados com sucesso!
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Os estoques iniciais foram lançados e já estão disponíveis no PDV e na filial{' '}
                <strong className="text-white">{activeBranch?.name}</strong>.
              </p>
              {importSummary.errors.length > 0 && (
                <div className="text-xs text-rose-300 space-y-1 mt-2 bg-rose-950/30 p-2.5 rounded-lg border border-rose-900/40">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                    Ocorrências durante o processo:
                  </p>
                  {importSummary.errors.map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Painel Expansível de Mapeamento Manual de Colunas */}
          {matrix.length > 0 && mappingConfig && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Configuração de Colunas e Cabeçalho
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                    Linha de Cabeçalho: {mappingConfig.headerRowIndex + 1}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMappingPanel(!showMappingPanel)}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                >
                  {showMappingPanel ? (
                    <>
                      Recolher Configurações <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      Ajustar Mapeamento Manualmente <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Corpo de Configurações */}
              {showMappingPanel && (
                <div className="pt-2 border-t border-slate-800 space-y-4 animate-in fade-in duration-200">
                  {/* Seletor de Linha de Cabeçalho */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Linha de Cabeçalho dos Produtos:
                      </label>
                      <select
                        value={mappingConfig.headerRowIndex}
                        onChange={(e) => updateMappingField('headerRowIndex', Number(e.target.value))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        {matrix.slice(0, 30).map((row, r) => {
                          const preview = row.filter(Boolean).slice(0, 4).join(' | ') || `(Linha vazia)`
                          return (
                            <option key={r} value={r}>
                              Linha {r + 1}: {preview.slice(0, 60)}
                            </option>
                          )
                        })}
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Linhas anteriores serão tratadas como cabeçalho comercial e ignoradas.
                      </p>
                    </div>

                    {/* Preço de Venda quando só há Custo */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Regra de Preço de Venda (quando ausente na nota):
                      </label>
                      <select
                        value={mappingConfig.salePriceMode}
                        onChange={(e) => updateMappingField('salePriceMode', e.target.value)}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="use_cost">
                          Usar Preço de Custo/Unitário como Preço de Venda Inicial
                        </option>
                        <option value="markup">
                          Aplicar Margem sobre o Custo (+{mappingConfig.markupPercentage}%)
                        </option>
                        <option value="direct">Manter Zerado (0,00) para definir manualmente</option>
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Permite importar pedidos de fornecedores que trazem apenas valor de compra.
                      </p>
                    </div>
                  </div>

                  {/* Seletores das Colunas Mapeadas */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                      Relação de Colunas Mapeadas:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Nome */}
                      <div>
                        <label className="text-[11px] font-medium text-emerald-400 block mb-1">
                          * Nome / Descrição do Produto
                        </label>
                        <select
                          value={mappingConfig.nameCol ?? ''}
                          onChange={(e) =>
                            updateMappingField(
                              'nameCol',
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                          className="w-full text-xs bg-slate-900 border border-emerald-600/50 rounded-lg px-2 py-1.5 text-white"
                        >
                          <option value="">(Não Mapeado)</option>
                          {availableCols.map((col) => (
                            <option key={col.colIndex} value={col.colIndex}>
                              Col {col.colIndex}: {col.headerTitle}{' '}
                              {col.sampleValue ? `(Ex: "${col.sampleValue.slice(0, 20)}")` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Código SKU */}
                      <div>
                        <label className="text-[11px] font-medium text-slate-300 block mb-1">
                          Código Interno / SKU
                        </label>
                        <select
                          value={mappingConfig.skuCol ?? ''}
                          onChange={(e) =>
                            updateMappingField(
                              'skuCol',
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                          className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                        >
                          <option value="">(Não Mapeado)</option>
                          {availableCols.map((col) => (
                            <option key={col.colIndex} value={col.colIndex}>
                              Col {col.colIndex}: {col.headerTitle}{' '}
                              {col.sampleValue ? `(Ex: "${col.sampleValue.slice(0, 20)}")` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* EAN Código de Barras */}
                      <div>
                        <label className="text-[11px] font-medium text-slate-300 block mb-1">
                          Código de Barras (EAN / GTIN)
                        </label>
                        <select
                          value={mappingConfig.barcodeCol ?? ''}
                          onChange={(e) =>
                            updateMappingField(
                              'barcodeCol',
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                          className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                        >
                          <option value="">(Não Mapeado)</option>
                          {availableCols.map((col) => (
                            <option key={col.colIndex} value={col.colIndex}>
                              Col {col.colIndex}: {col.headerTitle}{' '}
                              {col.sampleValue ? `(Ex: "${col.sampleValue.slice(0, 20)}")` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Unidade */}
                      <div>
                        <label className="text-[11px] font-medium text-slate-300 block mb-1">
                          Unidade de Medida (UN, DZ, PCT...)
                        </label>
                        <select
                          value={mappingConfig.unitCol ?? ''}
                          onChange={(e) =>
                            updateMappingField(
                              'unitCol',
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                          className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                        >
                          <option value="">(Não Mapeado - Usar UN)</option>
                          {availableCols.map((col) => (
                            <option key={col.colIndex} value={col.colIndex}>
                              Col {col.colIndex}: {col.headerTitle}{' '}
                              {col.sampleValue ? `(Ex: "${col.sampleValue.slice(0, 20)}")` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Custo de Aquisição */}
                      <div>
                        <label className="text-[11px] font-medium text-slate-300 block mb-1">
                          Custo de Aquisição / Valor Unitário
                        </label>
                        <select
                          value={mappingConfig.costPriceCol ?? ''}
                          onChange={(e) =>
                            updateMappingField(
                              'costPriceCol',
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                          className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                        >
                          <option value="">(Não Mapeado)</option>
                          {availableCols.map((col) => (
                            <option key={col.colIndex} value={col.colIndex}>
                              Col {col.colIndex}: {col.headerTitle}{' '}
                              {col.sampleValue ? `(Ex: "${col.sampleValue.slice(0, 20)}")` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Preço de Venda */}
                      <div>
                        <label className="text-[11px] font-medium text-slate-300 block mb-1">
                          Preço de Venda / Varejo
                        </label>
                        <select
                          value={mappingConfig.salePriceCol ?? ''}
                          onChange={(e) =>
                            updateMappingField(
                              'salePriceCol',
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                          className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                        >
                          <option value="">(Usar regra de Custo/Margem acima)</option>
                          {availableCols.map((col) => (
                            <option key={col.colIndex} value={col.colIndex}>
                              Col {col.colIndex}: {col.headerTitle}{' '}
                              {col.sampleValue ? `(Ex: "${col.sampleValue.slice(0, 20)}")` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Estoque Inicial / Quantidade */}
                      <div>
                        <label className="text-[11px] font-medium text-slate-300 block mb-1">
                          Quantidade / Estoque Inicial da Filial
                        </label>
                        <select
                          value={mappingConfig.initialStockCol ?? ''}
                          onChange={(e) =>
                            updateMappingField(
                              'initialStockCol',
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                          className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                        >
                          <option value="">(Não Mapeado - Saldo 0)</option>
                          {availableCols.map((col) => (
                            <option key={col.colIndex} value={col.colIndex}>
                              Col {col.colIndex}: {col.headerTitle}{' '}
                              {col.sampleValue ? `(Ex: "${col.sampleValue.slice(0, 20)}")` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Categoria */}
                      <div>
                        <label className="text-[11px] font-medium text-slate-300 block mb-1">
                          Categoria / Departamento
                        </label>
                        <select
                          value={mappingConfig.categoryCol ?? ''}
                          onChange={(e) =>
                            updateMappingField(
                              'categoryCol',
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                          className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                        >
                          <option value="">(Não Mapeado)</option>
                          {availableCols.map((col) => (
                            <option key={col.colIndex} value={col.colIndex}>
                              Col {col.colIndex}: {col.headerTitle}{' '}
                              {col.sampleValue ? `(Ex: "${col.sampleValue.slice(0, 20)}")` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Marca */}
                      <div>
                        <label className="text-[11px] font-medium text-slate-300 block mb-1">
                          Marca / Fabricante
                        </label>
                        <select
                          value={mappingConfig.brandCol ?? ''}
                          onChange={(e) =>
                            updateMappingField(
                              'brandCol',
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                          className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                        >
                          <option value="">(Não Mapeado)</option>
                          {availableCols.map((col) => (
                            <option key={col.colIndex} value={col.colIndex}>
                              Col {col.colIndex}: {col.headerTitle}{' '}
                              {col.sampleValue ? `(Ex: "${col.sampleValue.slice(0, 20)}")` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resumo Estatístico de Pré-Visualização */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {/* Total Analisado */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Linhas Analisadas
                  </span>
                  <span className="text-lg font-bold text-white">{parsedRows.length}</span>
                </div>

                {/* Válidos Novos */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold block">
                    Novos Cadastros
                  </span>
                  <span className="text-lg font-bold text-emerald-300">{newValidRows.length}</span>
                </div>

                {/* Já Cadastrados */}
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                  <span className="text-[10px] text-blue-400 uppercase font-semibold block">
                    Já Cadastrados
                  </span>
                  <span className="text-lg font-bold text-blue-300">{existingValidRows.length}</span>
                </div>

                {/* Linhas com Erros */}
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                  <span className="text-[10px] text-rose-400 uppercase font-semibold block">
                    Linhas com Erros
                  </span>
                  <span className="text-lg font-bold text-rose-300">{invalidRows.length}</span>
                </div>

                {/* Ignorados */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    Metadados / Rodapés
                  </span>
                  <span className="text-lg font-bold text-slate-400">{ignoredRows.length}</span>
                </div>
              </div>

              {/* Opção de Duplicados */}
              {existingValidRows.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs text-blue-200">
                  <input
                    type="checkbox"
                    id="chkUpdateExisting"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <label htmlFor="chkUpdateExisting" className="cursor-pointer">
                    Atualizar dados e preços dos <strong>{existingValidRows.length}</strong> produtos já
                    cadastrados (campos vazios da planilha não sobrescreverão os dados existentes).
                  </label>
                </div>
              )}

              {/* Tabela de Pré-visualização com Abas */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('all')}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        activeTab === 'all'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Produtos Encontrados ({validRows.length + invalidRows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('valid')}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        activeTab === 'valid'
                          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                          : 'text-slate-400 hover:text-emerald-300'
                      }`}
                    >
                      Prontos para Importar ({validRows.length})
                    </button>
                    {invalidRows.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('error')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          activeTab === 'error'
                            ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40'
                            : 'text-rose-400 hover:text-rose-300'
                        }`}
                      >
                        Inconsistências ({invalidRows.length})
                      </button>
                    )}
                    {ignoredRows.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('ignored')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          activeTab === 'ignored'
                            ? 'bg-slate-800 text-slate-300'
                            : 'text-slate-500 hover:text-slate-400'
                        }`}
                      >
                        Ignorados / Rodapé ({ignoredRows.length})
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {invalidRows.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadErrorsCsv}
                        className="text-[11px] h-7 border-rose-800/60 text-rose-300 hover:bg-rose-950/40 gap-1"
                      >
                        <FileDown className="h-3 w-3" />
                        Baixar Relatório de Erros (.CSV)
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null)
                        setMatrix([])
                        setParsedRows([])
                      }}
                      className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Limpar
                    </button>
                  </div>
                </div>

                {/* Tabela de Produtos */}
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 max-h-72 overflow-y-auto scrollbar-thin">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 uppercase font-semibold sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5 text-center w-12">Linha</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Código / SKU</th>
                        <th className="p-2.5">Descrição do Produto</th>
                        <th className="p-2.5">Código de Barras (EAN)</th>
                        <th className="p-2.5 text-center">Unid.</th>
                        <th className="p-2.5 text-right">Custo</th>
                        <th className="p-2.5 text-right">Preço Venda</th>
                        <th className="p-2.5 text-right">Estoque</th>
                        <th className="p-2.5 text-center w-16">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-500">
                            Nenhum produto encontrado para este filtro.
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((r, idx) => (
                          <tr
                            key={`${r.originalRowNumber}-${idx}`}
                            className={
                              r.status === 'valid'
                                ? r.isExistingInDb
                                  ? 'hover:bg-blue-950/20'
                                  : 'hover:bg-slate-850/40'
                                : r.status === 'invalid'
                                  ? 'bg-rose-950/25 hover:bg-rose-950/40'
                                  : 'bg-slate-950/40 text-slate-500'
                            }
                          >
                            <td className="p-2.5 text-center font-mono text-[11px] text-slate-500">
                              {r.originalRowNumber}
                            </td>
                            <td className="p-2.5">
                              {r.status === 'valid' ? (
                                r.isExistingInDb ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                                    Atualizar
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                    ✓ Novo
                                  </span>
                                )
                              ) : r.status === 'invalid' ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400 cursor-help"
                                  title={`${r.errorField}: ${r.errorMessage} (${r.errorFix})`}
                                >
                                  ✕ {r.errorField || 'Erro'}
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 cursor-help"
                                  title={r.ignoreReason}
                                >
                                  Ignorado
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 font-mono text-slate-300">{r.sku || '---'}</td>
                            <td className="p-2.5 font-medium text-white max-w-xs truncate" title={r.name}>
                              {r.name}
                            </td>
                            <td className="p-2.5 font-mono text-slate-300">
                              {r.barcode ? (
                                <span className="text-emerald-400">{r.barcode}</span>
                              ) : (
                                <span className="text-slate-600">---</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-mono text-slate-300">
                              {r.unit || 'UN'}
                            </td>
                            <td className="p-2.5 text-right text-slate-300">
                              {r.costPrice > 0 ? `R$ ${r.costPrice.toFixed(2)}` : '---'}
                            </td>
                            <td className="p-2.5 text-right font-bold text-white">
                              {r.salePrice > 0 ? (
                                `R$ ${r.salePrice.toFixed(2)}`
                              ) : (
                                <span className="text-amber-400 font-normal">0,00</span>
                              )}
                            </td>
                            <td className="p-2.5 text-right text-slate-300">
                              {r.initialStock > 0 ? `${r.initialStock} ${r.unit}` : '---'}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(r)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-400 border border-slate-700/80 hover:border-emerald-500/40 transition-colors text-[11px] font-medium"
                                title="Editar dados deste produto"
                              >
                                <Pencil className="h-3 w-3" />
                                <span>Editar</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Controles de Paginação */}
                {filteredRows.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-400">
                    <div className="flex items-center gap-3">
                      <span>
                        Mostrando{' '}
                        <strong className="text-white">
                          {Math.min((currentPage - 1) * pageSize + 1, filteredRows.length)}
                        </strong>{' '}
                        a{' '}
                        <strong className="text-white">
                          {Math.min(currentPage * pageSize, filteredRows.length)}
                        </strong>{' '}
                        de <strong className="text-white">{filteredRows.length}</strong> itens
                      </span>

                      <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
                        <span className="text-[11px]">Exibir:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value))
                            setCurrentPage(1)
                          }}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value={10}>10 por página</option>
                          <option value={25}>25 por página</option>
                          <option value={50}>50 por página</option>
                          <option value={100}>100 por página</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(1)}
                        className="h-7 w-7 p-0 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                        title="Primeira Página"
                      >
                        <ChevronsLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="h-7 w-7 p-0 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                        title="Página Anterior"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>

                      <span className="px-2 text-slate-300 font-medium text-xs">
                        Página <strong className="text-white">{currentPage}</strong> de{' '}
                        <strong className="text-white">{totalPages}</strong>
                      </span>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="h-7 w-7 p-0 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                        title="Próxima Página"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        className="h-7 w-7 p-0 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                        title="Última Página"
                      >
                        <ChevronsRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabela Dedicada de Erros se houver linhas inválidas */}
              {invalidRows.length > 0 && (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                      <AlertCircle className="h-4 w-4" />
                      <span>
                        {invalidRows.length} Linhas Inconsistentes Encontradas (não serão importadas)
                      </span>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadErrorsCsv}
                      className="text-xs h-7 border-rose-800 text-rose-300 hover:bg-rose-900/40 gap-1.5"
                    >
                      <Download className="h-3 w-3" />
                      Baixar Relatório Detalhado (.CSV)
                    </Button>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin text-xs text-rose-200 divide-y divide-rose-900/30">
                    {invalidRows.map((err, i) => (
                      <div key={i} className="pt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1">
                          <strong className="text-white">Linha {err.originalRowNumber}:</strong>{' '}
                          <span>{err.name}</span> —{' '}
                          <span className="text-rose-300 font-medium">{err.errorMessage}</span>
                          <div className="text-[11px] text-slate-400 italic mt-0.5">
                            Como corrigir: {err.errorFix}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(err)}
                          className="h-6 px-2.5 text-[11px] border-rose-800 text-rose-300 hover:bg-rose-900/50 gap-1 shrink-0 self-start sm:self-center"
                        >
                          <Pencil className="h-3 w-3" />
                          Editar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="text-xs text-slate-400">
            {validRows.length > 0 ? (
              <span>
                Pronto para importar <strong className="text-emerald-400">{newValidRows.length}</strong> novos
                {existingValidRows.length > 0 && (
                  <span>
                    {' '}
                    e atualizar <strong className="text-blue-400">{existingValidRows.length}</strong> existentes
                  </span>
                )}{' '}
                na filial <strong className="text-white">{activeBranch?.name}</strong>.
              </span>
            ) : (
              <span>Selecione uma planilha para visualizar a prévia dos produtos.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isImporting}
              className="border-slate-800 text-slate-400 hover:text-white text-xs"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleConfirmImport}
              disabled={isImporting || validRows.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs gap-1.5 shadow-lg shadow-emerald-600/20"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Gravando produtos no banco...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirmar Importação ({validRows.length} Produtos)
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Edição de Linha de Produto */}
      {editingRow && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 text-white shadow-2xl overflow-hidden my-4 sm:my-8 flex flex-col">
            {/* Header do Modal de Edição */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Editar Produto da Planilha
                    <span className="text-[11px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full border border-slate-700">
                      Linha #{editingRow.originalRowNumber}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingRow.errorMessage ? (
                      <span className="text-rose-400 font-medium">
                        Problema identificado: {editingRow.errorMessage}
                      </span>
                    ) : (
                      'Ajuste os dados antes de gravar no banco de dados'
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Formulário de Edição */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome / Descrição do Produto <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={editingForm.name ?? ''}
                  onChange={(e) => setEditingForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                  placeholder="Nome do produto"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* SKU */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Código / SKU
                  </label>
                  <input
                    type="text"
                    value={editingForm.sku ?? ''}
                    onChange={(e) => setEditingForm((f) => ({ ...f, sku: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="Ex: SKU-100"
                  />
                </div>

                {/* Código de Barras */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Código de Barras (EAN / GTIN)
                  </label>
                  <input
                    type="text"
                    value={editingForm.barcode ?? ''}
                    onChange={(e) => setEditingForm((f) => ({ ...f, barcode: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="Ex: 7891234567890"
                  />
                </div>

                {/* Unidade */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Unidade de Medida
                  </label>
                  <input
                    type="text"
                    value={editingForm.unit ?? ''}
                    onChange={(e) => setEditingForm((f) => ({ ...f, unit: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono uppercase"
                    placeholder="UN, CX, KG, LT, PC..."
                  />
                </div>

                {/* Categoria */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={editingForm.category ?? ''}
                    onChange={(e) => setEditingForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="Ex: Alimentos, Ferramentas..."
                  />
                </div>

                {/* Marca */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={editingForm.brand ?? ''}
                    onChange={(e) => setEditingForm((f) => ({ ...f, brand: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="Ex: Tramontina, Nestlé..."
                  />
                </div>

                {/* Preço de Custo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Preço de Custo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingForm.costPrice ?? 0}
                    onChange={(e) =>
                      setEditingForm((f) => ({ ...f, costPrice: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Preço de Venda */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Preço de Venda / Varejo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingForm.salePrice ?? 0}
                    onChange={(e) =>
                      setEditingForm((f) => ({ ...f, salePrice: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                {/* Preço de Atacado */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Preço de Atacado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingForm.wholesalePrice ?? ''}
                    onChange={(e) =>
                      setEditingForm((f) => ({
                        ...f,
                        wholesalePrice: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="0,00"
                  />
                </div>

                {/* Mínimo Atacado */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Qtd Mínima Atacado
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={editingForm.wholesaleMinQty ?? ''}
                    onChange={(e) =>
                      setEditingForm((f) => ({
                        ...f,
                        wholesaleMinQty: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="Ex: 10"
                  />
                </div>

                {/* Estoque Inicial */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Estoque Inicial ({editingForm.unit || 'UN'})
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={editingForm.initialStock ?? 0}
                    onChange={(e) =>
                      setEditingForm((f) => ({
                        ...f,
                        initialStock: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Estoque Mínimo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={editingForm.minStock ?? 0}
                    onChange={(e) =>
                      setEditingForm((f) => ({ ...f, minStock: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer do Modal de Edição */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-850">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingRow(null)}
                disabled={isSavingEdit}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs gap-1.5 shadow-lg shadow-emerald-600/20"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
