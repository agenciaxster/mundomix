import {
  Calendar,
  Building2,
  Users,
  CreditCard,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react'
import type { ReportFilterState, PeriodPreset } from '@/types/report'
import { Button } from '@/components/ui/button'

interface ReportFilterBarProps {
  filters: ReportFilterState
  onChange: (newFilters: ReportFilterState) => void
  branches: { id: string; name: string }[]
  sellers?: { id: string; name: string }[]
  showSellerFilter?: boolean
  showPaymentMethodFilter?: boolean
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function ReportFilterBar({
  filters,
  onChange,
  branches,
  sellers = [],
  showSellerFilter = false,
  showPaymentMethodFilter = false,
  onRefresh,
  isRefreshing = false,
}: ReportFilterBarProps) {
  function handlePresetChange(preset: PeriodPreset) {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    let dateFrom = todayStr
    let dateTo = todayStr

    if (preset === 'today') {
      dateFrom = todayStr
      dateTo = todayStr
    } else if (preset === '7days') {
      const d = new Date()
      d.setDate(d.getDate() - 6)
      dateFrom = d.toISOString().split('T')[0]
    } else if (preset === '30days') {
      const d = new Date()
      d.setDate(d.getDate() - 29)
      dateFrom = d.toISOString().split('T')[0]
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      dateFrom = firstDay.toISOString().split('T')[0]
    } else if (preset === 'lastMonth') {
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
      dateFrom = firstDayLastMonth.toISOString().split('T')[0]
      dateTo = lastDayLastMonth.toISOString().split('T')[0]
    }

    onChange({
      ...filters,
      periodPreset: preset,
      dateFrom,
      dateTo,
    })
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md">
      <div className="flex flex-col gap-4">
        {/* Linha 1: Períodos Rápidos */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-300">Filtros Consolidados</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePresetChange('today')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filters.periodPreset === 'today'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('7days')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filters.periodPreset === '7days'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Últimos 7 dias
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('30days')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filters.periodPreset === '30days'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Últimos 30 dias
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('thisMonth')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filters.periodPreset === 'thisMonth'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Este Mês
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('lastMonth')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filters.periodPreset === 'lastMonth'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Mês Passado
            </button>
          </div>
        </div>

        {/* Linha 2: Controles de Data e Seletores */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          {/* Data De */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-400">
              Data Inicial
            </label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    periodPreset: 'custom',
                    dateFrom: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-8 pr-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Data Até */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-400">
              Data Final
            </label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    periodPreset: 'custom',
                    dateTo: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-8 pr-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Filial */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-400">
              Unidade / Filial
            </label>
            <div className="relative">
              <Building2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <select
                value={filters.branchId}
                onChange={(e) => onChange({ ...filters, branchId: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-8 pr-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">Todas as Filiais Autorizadas</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vendedor (Opcional) */}
          {showSellerFilter && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                Vendedor / Operador
              </label>
              <div className="relative">
                <Users className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <select
                  value={filters.sellerId || 'all'}
                  onChange={(e) => onChange({ ...filters, sellerId: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-8 pr-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">Todos os Vendedores</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Forma de Pagamento (Opcional) */}
          {showPaymentMethodFilter && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                Forma de Pagamento
              </label>
              <div className="relative">
                <CreditCard className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <select
                  value={filters.paymentMethod || 'all'}
                  onChange={(e) => onChange({ ...filters, paymentMethod: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-8 pr-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">Todas as Formas</option>
                  <option value="cash">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                  <option value="store_credit">Crediário / A Prazo</option>
                  <option value="other">Outros</option>
                </select>
              </div>
            </div>
          )}

          {/* Botão de Atualizar */}
          {onRefresh && (
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="w-full border-slate-700 bg-slate-800/90 text-xs text-slate-200 hover:bg-slate-700"
              >
                <RotateCcw
                  className={`mr-1.5 h-3.5 w-3.5 text-emerald-400 ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                />
                {isRefreshing ? 'Atualizando...' : 'Atualizar'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
