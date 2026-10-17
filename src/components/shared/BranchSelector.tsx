import { useState, useRef, useEffect } from 'react'
import { Building2, ChevronDown, Check, Store, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

export function BranchSelector({ className }: { className?: string }) {
  const {
    activeBranch,
    activeCompany,
    companies,
    setActiveBranch,
    setActiveCompany,
    isAuthenticated,
  } = useAuth()

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Usuário sem acesso a nenhuma empresa
  if (!isAuthenticated || companies.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-xs text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-400', className)}>
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>Sem unidade vinculada</span>
      </div>
    )
  }

  const displayName = activeBranch?.name ?? activeCompany?.trade_name ?? 'Selecionar unidade'
  const displayCity = activeBranch
    ? `${activeBranch.city} / ${activeBranch.state}`
    : activeCompany?.city
      ? `${activeCompany.city} / ${activeCompany.state}`
      : null
  const isHeadquarter = activeBranch?.branch_type === 'matriz'

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        type="button"
        id="branch-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-left text-xs font-medium text-slate-800 shadow-2xs transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-850"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400">
          <Store className="h-3.5 w-3.5" />
        </div>

        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-900 dark:text-slate-100 max-w-[140px] truncate">
              {displayName}
            </span>
            {isHeadquarter && (
              <Badge variant="outline" className="px-1 py-0 text-[10px] text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-900">
                Matriz
              </Badge>
            )}
          </div>
          {displayCity && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {displayCity}
            </span>
          )}
        </div>

        <ChevronDown
          className={cn(
            'ml-1 h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
          {companies.map((companyData) => (
            <div key={companyData.company.id} className="mb-1 last:mb-0">
              {/* Cabeçalho da empresa */}
              {companies.length > 1 && (
                <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {companyData.company.trade_name}
                </div>
              )}

              {/* Filiais da empresa */}
              <div className="space-y-0.5">
                {companyData.branches.length === 0 ? (
                  <div className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500">
                    Nenhuma filial disponível
                  </div>
                ) : (
                  companyData.branches.map((branch) => {
                    const isCurrent = activeBranch?.id === branch.id
                    const isMatriz = branch.branch_type === 'matriz'

                    return (
                      <button
                        key={branch.id}
                        type="button"
                        id={`branch-option-${branch.id}`}
                        onClick={() => {
                          setActiveCompany(companyData.company)
                          setActiveBranch(branch)
                          setIsOpen(false)
                        }}
                        disabled={branch.status !== 'active'}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                          isCurrent
                            ? 'bg-blue-50 font-semibold text-blue-900 dark:bg-blue-950/60 dark:text-blue-200'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Building2
                            className={cn(
                              'h-4 w-4 shrink-0',
                              isMatriz ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                            )}
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[140px] font-medium">{branch.name}</span>
                              {isMatriz && (
                                <span className="rounded bg-blue-100 px-1 py-0.2 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                  Matriz
                                </span>
                              )}
                              {branch.status !== 'active' && (
                                <span className="text-[10px] text-slate-400">(Inativa)</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {branch.code ? `[${branch.code}] ` : ''}
                              {branch.city} - {branch.state}
                            </div>
                          </div>
                        </div>
                        {isCurrent && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
