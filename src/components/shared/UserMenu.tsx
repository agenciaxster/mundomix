import { useState, useRef, useEffect } from 'react'
import { User, Settings, ShieldCheck, LogOut, ChevronDown, Building2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface UserMenuProps {
  className?: string
}

/** Gera iniciais a partir de um nome completo */
function getInitials(name: string | null | undefined): string {
  if (!name) return 'U'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UserMenu({ className }: UserMenuProps) {
  const { user, profile, activeCompany, activeBranch, activeRole, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'Usuário'
  const displayEmail = user?.email ?? ''
  const initials = getInitials(profile?.full_name)

  const roleLabel: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    manager: 'Gerente',
    operator: 'Operador',
    viewer: 'Visualizador',
  }

  const branchLabel = activeBranch?.name ?? activeCompany?.trade_name ?? activeCompany?.legal_name ?? 'Matriz'
  const roleDisplay = activeRole ? roleLabel[activeRole] ?? activeRole : 'Usuário'

  const handleSignOut = async () => {
    setIsLogoutDialogOpen(false)
    await signOut()
  }

  return (
    <>
      <div className={cn('relative', className)} ref={menuRef}>
        <button
          type="button"
          id="user-menu-trigger"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:hover:bg-slate-800"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          {/* Avatar com iniciais */}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-semibold text-white shadow-2xs dark:bg-blue-500">
            {initials}
          </div>

          <div className="hidden text-left md:block">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              {displayName}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500">
              {roleDisplay}
            </div>
          </div>

          <ChevronDown
            className={cn(
              'hidden h-3.5 w-3.5 text-slate-400 transition-transform duration-200 md:block',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {isOpen && (
          <div
            id="user-menu-dropdown"
            className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95"
          >
            {/* Cabeçalho com info do usuário */}
            <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-400 truncate">
                {displayEmail}
              </div>

              {/* Filial / empresa ativa */}
              {(activeBranch || activeCompany) && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                  <div className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 max-w-full">
                    <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{branchLabel}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="py-1">
              <button
                type="button"
                id="user-menu-profile"
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <User className="h-4 w-4 text-slate-400" />
                <span>Meu Perfil</span>
              </button>

              <button
                type="button"
                id="user-menu-preferences"
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                <span>Preferências</span>
              </button>

              <button
                type="button"
                id="user-menu-security"
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                <span>Segurança & Sessões</span>
              </button>
            </div>

            <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
              <button
                type="button"
                id="user-menu-signout"
                onClick={() => {
                  setIsOpen(false)
                  setIsLogoutDialogOpen(true)
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <LogOut className="h-4 w-4" />
                <span>Encerrar Sessão</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
        title="Encerrar Sessão"
        description="Tem certeza que deseja sair do sistema? Sua sessão será encerrada com segurança."
        confirmText="Sair"
        cancelText="Cancelar"
        onConfirm={() => { void handleSignOut() }}
        variant="destructive"
      />
    </>
  )
}
