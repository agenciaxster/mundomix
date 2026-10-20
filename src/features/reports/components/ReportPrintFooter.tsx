export interface ReportPrintFooterProps {
  systemName?: string
  disclaimer?: string
}

/**
 * Rodapé documental e discreto para relatórios impressos do ERP.
 * Inclui assinatura do sistema, data/hora e numeração de página via CSS paged media.
 */
export function ReportPrintFooter({
  systemName = 'MundoMix ERP Multiloja',
  disclaimer = 'Documento emitido para fins gerenciais e conferência interna.',
}: ReportPrintFooterProps) {
  const now = new Date()
  const generatedAt = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

  return (
    <div className="print-report-footer hidden print:flex items-center justify-between border-t border-slate-400 pt-2 mt-6 text-[10px] text-slate-500 font-sans">
      <div>
        <strong>{systemName}</strong> • {disclaimer}
      </div>
      <div>
        <span>Gerado em {generatedAt}</span>
      </div>
    </div>
  )
}
