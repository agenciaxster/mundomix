import { NavLink } from 'react-router-dom'
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
} from 'lucide-react'
import { NAVIGATION_CONFIG } from '@/app/navigation'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
  isMobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
}: SidebarProps) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-900',
          // Desktop collapse state
          isCollapsed ? 'md:w-18' : 'md:w-64',
          // Mobile state
          isMobileOpen
            ? 'translate-x-0 w-72'
            : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Sidebar Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs dark:bg-blue-600">
              <Layers className="h-5 w-5" />
            </div>

            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    MundoMix
                  </span>
                  <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[10px] font-bold text-blue-600 dark:bg-blue-950/80 dark:text-blue-300">
                    ERP
                  </span>
                </div>
                <span className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                  Multiloja Enterprise
                </span>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Fechar menu lateral"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
          {NAVIGATION_CONFIG.map((group) => (
            <div key={group.groupTitle} className="space-y-1">
              {(!isCollapsed || isMobileOpen) && (
                <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                  {group.groupTitle}
                </div>
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={() => {
                        if (isMobileOpen) onMobileClose()
                      }}
                      title={isCollapsed && !isMobileOpen ? item.title : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-300'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100',
                          isCollapsed && !isMobileOpen && 'justify-center px-2'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0 transition-colors',
                              isActive
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                            )}
                          />

                          {(!isCollapsed || isMobileOpen) && (
                            <span className="flex-1 truncate">{item.title}</span>
                          )}

                          {(!isCollapsed || isMobileOpen) && item.badge && (
                            <Badge
                              variant="secondary"
                              className="ml-auto text-[10px] px-1.5 py-0"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer with collapse toggle */}
        <div className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800">
          {(!isCollapsed || isMobileOpen) && (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-blue-500" />
                Fundação Ativa
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                v0.1.0
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              'hidden w-full items-center gap-2 rounded-lg py-2 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:flex dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
              isCollapsed ? 'justify-center px-0' : 'px-3 justify-start'
            )}
            aria-label={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Recolher menu</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
