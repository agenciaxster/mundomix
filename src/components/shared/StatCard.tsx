import type { ComponentType } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value?: string | number | null
  description?: string
  icon: ComponentType<{ className?: string }>
  trend?: {
    value: string
    isPositive?: boolean
    neutral?: boolean
  }
  badge?: string
  statusNotice?: string
  isLoading?: boolean
  className?: string
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  badge,
  statusNotice,
  isLoading = false,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700',
        className
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-400 dark:group-hover:bg-blue-900/60">
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          {isLoading ? (
            <div className="h-8 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          ) : value !== undefined && value !== null ? (
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {value}
            </span>
          ) : (
            <span className="text-xl font-semibold text-slate-400 dark:text-slate-500">
              --
            </span>
          )}

          {badge && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {badge}
            </span>
          )}
        </div>

        {/* Footer/Trend info or status notice */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {trend && (
            <div
              className={cn(
                'inline-flex items-center font-medium',
                trend.neutral
                  ? 'text-slate-500 dark:text-slate-400'
                  : trend.isPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {trend.neutral ? (
                <Minus className="mr-1 h-3.5 w-3.5" />
              ) : trend.isPositive ? (
                <TrendingUp className="mr-1 h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="mr-1 h-3.5 w-3.5" />
              )}
              {trend.value}
            </div>
          )}

          {description && (
            <span className="truncate">{description}</span>
          )}

          {statusNotice && (
            <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {statusNotice}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
