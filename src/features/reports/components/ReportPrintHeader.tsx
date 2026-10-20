import { Building2, FileText, Calendar, User } from 'lucide-react'
import type { Company, Branch } from '@/types/auth'

export interface ReportPrintHeaderProps {
  title: string
  subtitle?: string
  company: Company | null
  branch?: Branch | null
  userName?: string
  filtersSummary?: Record<string, string | undefined>
}

/**
 * Componente padronizado institucional para cabeçalho de relatórios impressos/exportados.
 * Exibe logo (se houver), Nome da Empresa, CNPJ, Unidade (Matriz ou Filial com nome),
 * Título do Relatório, Data/Hora da emissão, Usuário emissor e parâmetros/filtros aplicados.
 */
export function ReportPrintHeader({
  title,
  subtitle,
  company,
  branch,
  userName = 'Usuário do Sistema',
  filtersSummary,
}: ReportPrintHeaderProps) {
  const now = new Date()
  const printDateStr = now.toLocaleDateString('pt-BR')
  const printTimeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const companyName = company?.trade_name || company?.legal_name || 'EMPRESA MUNDOMIX'
  const cnpj = company?.cnpj || 'Não informado'

  // Identificação da Unidade
  let unitLabel = 'MATRIZ'
  if (branch) {
    if (branch.branch_type === 'filial') {
      unitLabel = `FILIAL: ${branch.name}${branch.code ? ` (${branch.code})` : ''}`
    } else {
      unitLabel = `MATRIZ: ${branch.name}`
    }
  }

  const activeFilters = filtersSummary
    ? Object.entries(filtersSummary).filter(([_, val]) => Boolean(val && val !== 'all'))
    : []

  return (
    <div className="print-report-header hidden print:block border-b-2 border-slate-900 pb-4 mb-4 text-slate-900 font-sans">
      <div className="flex items-start justify-between gap-4">
        {/* Identificação Institucional da Empresa */}
        <div className="space-y-1 max-w-[65%]">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-800 shrink-0" />
            <h1 className="text-lg font-black tracking-tight uppercase text-slate-900 leading-tight">
              {companyName}
            </h1>
          </div>

          <div className="text-xs text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span><strong>CNPJ:</strong> {cnpj}</span>
            <span>•</span>
            <span className="font-semibold uppercase text-slate-900">
              {unitLabel}
            </span>
            {branch?.city && branch?.state && (
              <>
                <span>•</span>
                <span>{branch.city}/{branch.state}</span>
              </>
            )}
          </div>
        </div>

        {/* Metadados de Auditoria da Emissão */}
        <div className="text-right text-[11px] text-slate-600 space-y-0.5 shrink-0">
          <div className="font-bold text-slate-900 flex items-center justify-end gap-1">
            <Calendar className="h-3 w-3" /> Emissão: {printDateStr} às {printTimeStr}
          </div>
          <div className="flex items-center justify-end gap-1">
            <User className="h-3 w-3" /> Emitido por: <strong className="text-slate-800">{userName}</strong>
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">
            MundoMix ERP • Multiloja
          </div>
        </div>
      </div>

      {/* Título do Relatório */}
      <div className="mt-3 pt-3 border-t border-slate-300 flex items-baseline justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-wide uppercase flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-slate-700" />
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Resumo de Parâmetros e Filtros Aplicados */}
      {activeFilters.length > 0 && (
        <div className="mt-2.5 p-2 bg-slate-100 rounded border border-slate-200 text-[11px] text-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
            Filtros Aplicados:
          </span>
          {activeFilters.map(([key, val]) => (
            <span key={key} className="inline-flex items-center gap-1">
              <span className="font-semibold text-slate-700">{key}:</span>
              <span>{val}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
