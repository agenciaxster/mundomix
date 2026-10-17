import { useState, useEffect } from 'react'
import {
  X,
  Printer,
  Copy,
  Sliders,
  HelpCircle,
  Scissors,
  Save,
} from 'lucide-react'
import type { Sale } from '@/types/sale'
import type { Company } from '@/types/auth'
import type {
  CompanyReceiptSettings,
  PrintableReceiptData,
} from '@/types/receipt'
import { DEFAULT_RECEIPT_SETTINGS } from '@/types/receipt'
import { receiptSettingsService } from '@/lib/services/receipt-settings.service'
import { printThermalReceiptHtml } from '@/lib/utils/thermal-print'
import { buildThermalReceiptHtml } from '../receipt/receipt-formatter'
import { ThermalReceipt } from '../receipt/ThermalReceipt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

interface ReceiptPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  sale: Sale | null
  company?: Company | null
  isReprint?: boolean
}

export function ReceiptPreviewModal({
  isOpen,
  onClose,
  sale,
  company,
  isReprint = false,
}: ReceiptPreviewModalProps) {
  const companyId = company?.id || sale?.company_id || ''

  const [settings, setSettings] = useState<CompanyReceiptSettings>({
    ...DEFAULT_RECEIPT_SETTINGS,
    company_id: companyId,
  })
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  // Carrega configurações da empresa ativa ao abrir
  useEffect(() => {
    if (!isOpen || !companyId) return
    let active = true

    receiptSettingsService.getSettings(companyId).then((loaded) => {
      if (active) {
        setSettings(loaded)
      }
    })

    return () => {
      active = false
    }
  }, [isOpen, companyId])

  // Atalho de teclado: ESC fecha, Ctrl+P ou P dispara impressão
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (
        (e.key === 'p' || e.key === 'P') &&
        !['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())
      ) {
        e.preventDefault()
        handlePrint()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, settings, sale, company])

  if (!isOpen || !sale) return null

  const printableData: PrintableReceiptData = {
    sale,
    company: company || null,
    settings,
    isReprint,
  }

  async function handlePrint() {
    if (!sale) return
    setIsPrinting(true)
    try {
      const html = buildThermalReceiptHtml(printableData)
      await printThermalReceiptHtml(html, settings.paper_width)
      toast.success('Janela de impressão térmica enviada com sucesso!')
    } catch (err) {
      console.error('Erro ao acionar impressão:', err)
      toast.error('Não foi possível acionar a impressora no navegador.')
    } finally {
      setIsPrinting(false)
    }
  }

  async function handleSaveSettings() {
    if (!companyId) return
    setIsSavingSettings(true)
    try {
      await receiptSettingsService.saveSettings(companyId, settings)
      toast.success('Preferências de impressão salvas como padrão da empresa!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar preferências.')
    } finally {
      setIsSavingSettings(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* ─── TOPO DO MODAL ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Visualização de Comprovante Não Fiscal
                </h2>
                {isReprint && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase">
                    Reimpressão
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Venda: <span className="font-mono text-slate-200">{sale.code}</span> &bull; {sale.branch?.name || 'Filial'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className={`text-xs gap-1.5 border border-slate-700 ${
                showAdvancedSettings
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Configurações</span>
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title="Fechar (ESC)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ─── CORPO PRINCIPAL: CONTROLES + PREVIEW DA BOBINA ──────────────── */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* PAINEL DE CONTROLE / CONFIGURAÇÕES RÁPIDAS (Esquerda) */}
          <div
            className={`border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900 p-5 space-y-4 overflow-y-auto ${
              showAdvancedSettings ? 'lg:col-span-5' : 'lg:col-span-4'
            }`}
          >
            {/* Seletor de Largura da Bobina Térmica */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Largura do Papel</span>
                <span className="text-[10px] text-blue-400 lowercase font-normal">bobina térmica</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, paper_width: '80mm' }))}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                    settings.paper_width === '80mm'
                      ? 'border-blue-500 bg-blue-600/20 text-white font-bold ring-2 ring-blue-500/30'
                      : 'border-slate-800 bg-slate-850 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="text-sm font-mono font-black">80 mm</span>
                  <span className="text-[10px] text-slate-400">Padrão Comercial (3")</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, paper_width: '58mm' }))}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                    settings.paper_width === '58mm'
                      ? 'border-blue-500 bg-blue-600/20 text-white font-bold ring-2 ring-blue-500/30'
                      : 'border-slate-800 bg-slate-850 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="text-sm font-mono font-black">58 mm</span>
                  <span className="text-[10px] text-slate-400">Estreito / Mini POS (2")</span>
                </button>
              </div>
            </div>

            {/* Número de Vias (1 ou 2) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Número de Vias</span>
                <span className="text-[10px] text-slate-400">corte automático</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, copies_count: 1 }))}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    settings.copies_count === 1
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-slate-800 bg-slate-850 text-slate-400 hover:text-white'
                  }`}
                >
                  <Copy className="h-3.5 w-3.5" /> 1 Via (Única)
                </button>

                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, copies_count: 2 }))}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    settings.copies_count === 2
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-slate-800 bg-slate-850 text-slate-400 hover:text-white'
                  }`}
                >
                  <Copy className="h-3.5 w-3.5" /> 2 Vias (Cliente/Loja)
                </button>
              </div>
            </div>

            {/* Mensagem de Rodapé */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Mensagem de Rodapé
              </label>
              <Input
                type="text"
                value={settings.footer_message}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, footer_message: e.target.value }))
                }
                placeholder="Ex: Obrigado pela preferência! Volte sempre!"
                className="bg-slate-850 border-slate-700 text-xs text-white"
              />
            </div>

            {/* Opções de Exibição / Filtros */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-850/60 border border-slate-800 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Campos do Comprovante
              </span>

              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-slate-300">Exibir Telefone</span>
                <input
                  type="checkbox"
                  checked={settings.show_phone}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, show_phone: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-slate-300">Exibir Endereço</span>
                <input
                  type="checkbox"
                  checked={settings.show_address}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, show_address: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-slate-300">Identificação do Operador</span>
                <input
                  type="checkbox"
                  checked={settings.show_operator}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, show_operator: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-slate-300">Identificação do Cliente</span>
                <input
                  type="checkbox"
                  checked={settings.show_customer}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, show_customer: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-slate-300">Descontos Detalhados por Item</span>
                <input
                  type="checkbox"
                  checked={settings.show_item_discounts}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, show_item_discounts: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                />
              </label>
            </div>

            {/* Botão de Salvar como Padrão da Empresa */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSavingSettings}
              onClick={handleSaveSettings}
              className="w-full text-xs border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white flex items-center justify-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5 text-blue-400" />
              {isSavingSettings ? 'Salvando...' : 'Salvar como Padrão da Empresa'}
            </Button>

            {/* Aviso de Compatibilidade de Impressora Térmica */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1 text-slate-300 font-semibold">
                <HelpCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                Dica de Impressão Térmica:
              </div>
              <p className="text-[10.5px] leading-relaxed">
                Na tela de impressão do navegador, defina <strong>Margens: Nenhuma</strong> e desmarque <strong>Cabeçalhos e Rodapés</strong> para ajuste milimétrico na bobina.
              </p>
            </div>
          </div>

          {/* ÁREA DE VISUALIZAÇÃO DA BOBINA TÉRMICA (Direita) */}
          <div
            className={`bg-slate-950 p-6 overflow-y-auto flex flex-col items-center justify-start min-h-[300px] ${
              showAdvancedSettings ? 'lg:col-span-7' : 'lg:col-span-8'
            }`}
          >
            <div className="space-y-6 flex flex-col items-center">
              {/* Via 1 */}
              <div className="relative">
                <ThermalReceipt
                  data={printableData}
                  copyIndex={1}
                  totalCopies={settings.copies_count}
                />
              </div>

              {/* Via 2 se selecionado */}
              {settings.copies_count === 2 && (
                <>
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-500 py-2">
                    <Scissors className="h-4 w-4" />
                    <span>&mdash;&mdash; CORTE DO PAPEL &mdash;&mdash;</span>
                    <Scissors className="h-4 w-4 rotate-180" />
                  </div>

                  <div className="relative">
                    <ThermalReceipt
                      data={printableData}
                      copyIndex={2}
                      totalCopies={2}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ─── RODAPÉ DO MODAL (Ações) ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-850/90 gap-3 shrink-0">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            <span>Pressione </span>
            <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[11px]">
              P
            </kbd>
            <span> para imprimir &bull; </span>
            <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[11px]">
              ESC
            </kbd>
            <span> para fechar</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 sm:flex-initial text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2.5 px-6 rounded-xl shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2"
            >
              <Printer className="h-4 w-4" />
              {isPrinting ? 'Preparando...' : 'Imprimir Comprovante'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
