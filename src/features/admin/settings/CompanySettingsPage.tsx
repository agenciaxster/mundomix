import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Sliders,
  Printer,
  Building2,
  Save,
  RotateCcw,
  HelpCircle,
  Copy,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'
import { receiptSettingsService } from '@/lib/services/receipt-settings.service'
import {
  DEFAULT_RECEIPT_SETTINGS,
  type CompanyReceiptSettings,
  type PrintableReceiptData,
} from '@/types/receipt'
import { ThermalReceipt } from '@/features/pos/receipt/ThermalReceipt'
import { printThermalReceiptHtml } from '@/lib/utils/thermal-print'
import { buildThermalReceiptHtml } from '@/features/pos/receipt/receipt-formatter'
import type { Sale } from '@/types/sale'

export function CompanySettingsPage() {
  const { activeCompany, activeBranch } = useAuth()
  const companyId = activeCompany?.id || ''

  const [activeTab, setActiveTab] = useState<'receipt' | 'company'>('receipt')
  const [settings, setSettings] = useState<CompanyReceiptSettings>({
    ...DEFAULT_RECEIPT_SETTINGS,
    company_id: companyId,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTestingPrint, setIsTestingPrint] = useState(false)

  // Carrega configurações
  useEffect(() => {
    if (!companyId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    receiptSettingsService
      .getSettings(companyId)
      .then((loaded) => {
        setSettings(loaded)
      })
      .finally(() => setIsLoading(false))
  }, [companyId])

  async function handleSave() {
    if (!companyId) return
    setIsSaving(true)
    try {
      await receiptSettingsService.saveSettings(companyId, settings)
      toast.success('Configurações de impressão salvas com sucesso!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar configurações.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleResetDefaults() {
    setSettings({
      ...DEFAULT_RECEIPT_SETTINGS,
      company_id: companyId,
    })
    toast.info('Valores padrão restaurados no formulário. Clique em Salvar para confirmar.')
  }

  // Venda demonstrativa para o preview interativo
  const sampleSale: Sale = {
    id: 'demo-sample-sale',
    company_id: companyId,
    branch_id: activeBranch?.id || '',
    user_id: 'sample-user-id',
    user_name: 'Operador de Demonstração',
    customer_id: null,
    customer_name: 'Consumidor Exemplo',
    customer_document: '12345678909',
    sale_number: 1001,
    code: 'VND-001001',
    status: 'completed',
    subtotal: 75.0,
    discount_type: 'value',
    discount_value: 5.0,
    discount_amount: 5.0,
    total: 70.0,
    payment_amount: 100.0,
    change_amount: 30.0,
    quote_id: null,
    notes: 'Exemplo demonstrativo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    branch: activeBranch
      ? {
          ...activeBranch,
          city: (!activeBranch.city || activeBranch.city.toLowerCase().includes('sao paulo') || activeBranch.city.toLowerCase().includes('são paulo')) ? 'Palmas' : activeBranch.city,
          state: (!activeBranch.state || (activeBranch.state.toUpperCase() === 'SP' && (!activeBranch.city || activeBranch.city.toLowerCase().includes('sao paulo') || activeBranch.city.toLowerCase().includes('são paulo')))) ? 'TO' : activeBranch.state,
        }
      : undefined,
    items: [
      {
        company_id: companyId,
        branch_id: activeBranch?.id || '',
        product_id: 'p1',
        product_name: 'Café Especial Torrado em Grãos 500g',
        product_sku: 'CAF-001',
        product_barcode: '7891000100011',
        unit: 'UN',
        quantity: 2,
        unit_price: 25.0,
        price_type: 'retail',
        discount: 0,
        subtotal: 50.0,
        total: 50.0,
      },
      {
        company_id: companyId,
        branch_id: activeBranch?.id || '',
        product_id: 'p2',
        product_name: 'Filtro de Papel Descartável 103 c/ 30un',
        product_sku: 'FLT-002',
        product_barcode: '7891000200022',
        unit: 'CX',
        quantity: 1,
        unit_price: 25.0,
        price_type: 'retail',
        discount: 5.0,
        subtotal: 25.0,
        total: 20.0,
      },
    ],
    payments: [
      {
        company_id: companyId,
        payment_method: 'cash',
        amount: 70.0,
        received_amount: 100.0,
        change_amount: 30.0,
        installments: 1,
      },
    ],
  }

  const samplePrintableData: PrintableReceiptData = {
    sale: sampleSale,
    company: activeCompany,
    settings,
    isReprint: false,
  }

  async function handleTestPrint() {
    setIsTestingPrint(true)
    try {
      const html = buildThermalReceiptHtml(samplePrintableData)
      await printThermalReceiptHtml(html, settings.paper_width)
      toast.success('Demonstração enviada para a impressora!')
    } catch {
      toast.error('Erro ao acionar impressora.')
    } finally {
      setIsTestingPrint(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── TOPO DA PÁGINA ─────────────────────────────────────────────── */}
      <PageHeader
        title="Configurações da Empresa"
        description="Parâmetros de emissão de comprovantes não fiscais, impressão térmica e dados cadastrais."
        badge={activeCompany?.trade_name || activeCompany?.legal_name || 'Empresa Ativa'}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={handleResetDefaults}
              className="text-xs border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Restaurar Padrões
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isSaving || isLoading}
              onClick={handleSave}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/40"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        }
      />

      {/* ─── ABAS DE NAVEGAÇÃO ────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-800 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('receipt')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition border-b-2 -mb-px ${
            activeTab === 'receipt'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Printer className="h-4 w-4" />
          Comprovantes e Impressão Térmica
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('company')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition border-b-2 -mb-px ${
            activeTab === 'company'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Dados Cadastrais da Empresa
        </button>
      </div>

      {/* ─── ABA 1: COMPROVANTES E IMPRESSÃO TÉRMICA ─────────────────────── */}
      {activeTab === 'receipt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulário de Configurações (Esquerda) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Formato do Papel Térmico */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Printer className="h-4 w-4 text-blue-400" />
                  Formato Padrão da Bobina Térmica
                </h3>
                <p className="text-xs text-slate-400">
                  Selecione a largura física padrão utilizada nos caixas (PDV).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, paper_width: '80mm' }))}
                  className={`p-4 rounded-2xl border text-left transition flex flex-col gap-1.5 ${
                    settings.paper_width === '80mm'
                      ? 'border-blue-500 bg-blue-600/15 text-white ring-2 ring-blue-500/20'
                      : 'border-slate-800 bg-slate-850/60 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-base text-white">80 mm</span>
                    {settings.paper_width === '80mm' && (
                      <CheckCircle2 className="h-4 w-4 text-blue-400" />
                    )}
                  </div>
                  <span className="text-xs text-slate-300 font-semibold">
                    Padrão Comercial (3 polegadas)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Epson TM-T20, Elgin i9, Bematech MP-4200, Daruma. Área útil de ~72mm.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, paper_width: '58mm' }))}
                  className={`p-4 rounded-2xl border text-left transition flex flex-col gap-1.5 ${
                    settings.paper_width === '58mm'
                      ? 'border-blue-500 bg-blue-600/15 text-white ring-2 ring-blue-500/20'
                      : 'border-slate-800 bg-slate-850/60 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-base text-white">58 mm</span>
                    {settings.paper_width === '58mm' && (
                      <CheckCircle2 className="h-4 w-4 text-blue-400" />
                    )}
                  </div>
                  <span className="text-xs text-slate-300 font-semibold">
                    Bobina Estreita (2 polegadas)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Mini impressoras Bluetooth, maquininhas POS e terminais portáteis. Área útil de ~48mm.
                  </span>
                </button>
              </div>
            </div>

            {/* Número de Vias */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Copy className="h-4 w-4 text-blue-400" />
                  Número de Vias Emitidas
                </h3>
                <p className="text-xs text-slate-400">
                  Defina se cada venda gerará uma via única ou duas vias (Cliente e Estabelecimento).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, copies_count: 1 }))}
                  className={`py-3 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                    settings.copies_count === 1
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/20'
                      : 'border-slate-800 bg-slate-850 text-slate-400 hover:text-white'
                  }`}
                >
                  1 Via (Econômico / Padrão)
                </button>

                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, copies_count: 2 }))}
                  className={`py-3 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                    settings.copies_count === 2
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/20'
                      : 'border-slate-800 bg-slate-850 text-slate-400 hover:text-white'
                  }`}
                >
                  2 Vias (Cliente e Loja)
                </button>
              </div>
            </div>

            {/* Campos Visíveis no Comprovante */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-blue-400" />
                  Campos e Informações Impressas
                </h3>
                <p className="text-xs text-slate-400">
                  Marque ou desmarque para incluir ou omitir dados no comprovante.
                </p>
              </div>

              <div className="divide-y divide-slate-800/80 text-xs">
                <label className="flex items-center justify-between py-2.5 cursor-pointer">
                  <div>
                    <span className="font-semibold text-white block">Nome Fantasia da Empresa</span>
                    <span className="text-[11px] text-slate-400">Exibe o nome comercial no cabeçalho</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.show_trade_name}
                    onChange={(e) => setSettings((s) => ({ ...s, show_trade_name: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between py-2.5 cursor-pointer">
                  <div>
                    <span className="font-semibold text-white block">Razão Social da Empresa</span>
                    <span className="text-[11px] text-slate-400">Exibe a denominação social legal</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.show_legal_name}
                    onChange={(e) => setSettings((s) => ({ ...s, show_legal_name: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between py-2.5 cursor-pointer">
                  <div>
                    <span className="font-semibold text-white block">CNPJ da Filial / Matriz</span>
                    <span className="text-[11px] text-slate-400">Número do CNPJ formatado</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.show_cnpj}
                    onChange={(e) => setSettings((s) => ({ ...s, show_cnpj: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between py-2.5 cursor-pointer">
                  <div>
                    <span className="font-semibold text-white block">Telefone de Contato</span>
                    <span className="text-[11px] text-slate-400">Exibe o telefone da unidade no cabeçalho</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.show_phone}
                    onChange={(e) => setSettings((s) => ({ ...s, show_phone: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between py-2.5 cursor-pointer">
                  <div>
                    <span className="font-semibold text-white block">Endereço da Unidade</span>
                    <span className="text-[11px] text-slate-400">Logradouro, número, bairro, cidade e UF</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.show_address}
                    onChange={(e) => setSettings((s) => ({ ...s, show_address: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between py-2.5 cursor-pointer">
                  <div>
                    <span className="font-semibold text-white block">Identificação do Operador</span>
                    <span className="text-[11px] text-slate-400">Nome do operador de caixa autenticado</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.show_operator}
                    onChange={(e) => setSettings((s) => ({ ...s, show_operator: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between py-2.5 cursor-pointer">
                  <div>
                    <span className="font-semibold text-white block">Identificação do Cliente</span>
                    <span className="text-[11px] text-slate-400">Nome e CPF/CNPJ quando informados na venda</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.show_customer}
                    onChange={(e) => setSettings((s) => ({ ...s, show_customer: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between py-2.5 cursor-pointer">
                  <div>
                    <span className="font-semibold text-white block">Descontos Detalhados</span>
                    <span className="text-[11px] text-slate-400">Exibe valor do desconto em cada item</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.show_item_discounts}
                    onChange={(e) => setSettings((s) => ({ ...s, show_item_discounts: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                  />
                </label>
              </div>
            </div>

            {/* Mensagem de Rodapé */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white">Mensagem de Rodapé</h3>
                <p className="text-xs text-slate-400">
                  Frase de agradecimento impressa no final do comprovante.
                </p>
              </div>

              <Input
                type="text"
                value={settings.footer_message}
                onChange={(e) => setSettings((s) => ({ ...s, footer_message: e.target.value }))}
                placeholder="Ex: Obrigado pela preferência! Volte sempre!"
                className="bg-slate-850 border-slate-700 text-white text-xs"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Obrigado pela preferência! Volte sempre!',
                  'Agradecemos a confiança! Tenha um ótimo dia!',
                  'Troca somente com este comprovante em até 7 dias.',
                  'Visite nosso site: mundomix.com.br',
                ].map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, footer_message: sug }))}
                    className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-850 text-[10px] text-slate-400 hover:text-white hover:border-slate-700 transition"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Painel de Visualização em Tempo Real (Direita) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Pré-visualização da Bobina</h4>
                <p className="text-[11px] text-slate-400">
                  Atualizada instantaneamente conforme as opções ao lado.
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={handleTestPrint}
                disabled={isTestingPrint}
                className="text-xs bg-slate-800 hover:bg-slate-750 text-blue-400 hover:text-blue-300 border border-slate-700 flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                {isTestingPrint ? 'Enviando...' : 'Testar Impressão'}
              </Button>
            </div>

            {/* Container da Bobina Térmica */}
            <div className="p-6 rounded-3xl border border-slate-800 bg-slate-950 flex flex-col items-center justify-start min-h-[500px]">
              <ThermalReceipt data={samplePrintableData} copyIndex={1} totalCopies={settings.copies_count} />
            </div>

            {/* Dica Técnica */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-300">
                <HelpCircle className="h-4 w-4 text-amber-400 shrink-0" />
                Dica para Impressoras Térmicas USB / Rede:
              </div>
              <p className="text-[11px] leading-relaxed">
                Ao imprimir pela janela do navegador (Chrome/Edge/Firefox), certifique-se de selecionar a sua impressora térmica, ajustar as <strong>Margens para "Nenhuma" (None)</strong> e desmarcar a opção de <strong>Cabeçalhos e Rodapés</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── ABA 2: DADOS DA EMPRESA ─────────────────────────────────────── */}
      {activeTab === 'company' && activeCompany && (
        <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-400" />
                {activeCompany.trade_name || activeCompany.legal_name}
              </h3>
              <p className="text-xs text-slate-400">
                Dados cadastrais que constam no cabeçalho dos comprovantes não fiscais.
              </p>
            </div>

            <Button asChild size="sm" variant="outline" className="text-xs border-slate-700 text-slate-300 hover:text-white">
              <Link to={`/admin/empresas-filiais/${activeCompany.id}/editar`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Editar no Cadastro de Empresas
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Razão Social</span>
              <span className="text-sm font-semibold text-white">{activeCompany.legal_name}</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Nome Fantasia</span>
              <span className="text-sm font-semibold text-white">{activeCompany.trade_name || '-'}</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">CNPJ</span>
              <span className="text-sm font-mono font-semibold text-white">{activeCompany.cnpj}</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Telefone</span>
              <span className="text-sm font-semibold text-white">{activeCompany.phone || 'Não cadastrado'}</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-1 md:col-span-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Endereço da Sede</span>
              <span className="text-sm font-semibold text-white">
                {activeCompany.street
                  ? `${activeCompany.street}, ${activeCompany.number || 'S/N'} ${activeCompany.complement || ''} - ${activeCompany.neighborhood || ''}, ${(!activeCompany.city || activeCompany.city.toLowerCase().includes('sao paulo') || activeCompany.city.toLowerCase().includes('são paulo')) ? 'Palmas' : activeCompany.city} - ${(!activeCompany.state || (activeCompany.state.toUpperCase() === 'SP' && (!activeCompany.city || activeCompany.city.toLowerCase().includes('sao paulo') || activeCompany.city.toLowerCase().includes('são paulo')))) ? 'TO' : activeCompany.state}`
                  : `${(!activeCompany.city || activeCompany.city.toLowerCase().includes('sao paulo') || activeCompany.city.toLowerCase().includes('são paulo')) ? 'Palmas - TO' : (activeCompany.city + ' - ' + (activeCompany.state || 'TO'))}`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
