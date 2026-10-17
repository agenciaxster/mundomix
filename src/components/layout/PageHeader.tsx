import type { ComponentType, ReactNode } from 'react'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
  icon?: ComponentType<{ className?: string }>
  actions?: ReactNode
  children?: ReactNode
  showBreadcrumbs?: boolean
  className?: string
}

export function PageHeader({
  title,
  description,
  badge,
  icon: Icon,
  actions,
  children,
  showBreadcrumbs = true,
  className,
}: PageHeaderProps) {
  const renderedActions = actions ?? children
  return (
    <div className={cn('space-y-2 pb-6', className)}>
      {showBreadcrumbs && <Breadcrumbs className="mb-2" />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <Icon className="h-4 w-4" />
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {title}
            </h1>
            {badge && (
              <Badge variant="outline" className="text-xs font-medium">
                {badge}
              </Badge>
            )}
          </div>

          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>

        {renderedActions && (
          <div className="flex flex-wrap items-center gap-2.5">
            {renderedActions}
          </div>
        )}
      </div>
    </div>
  )
}
