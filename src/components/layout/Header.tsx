import { useState, useRef, useEffect } from 'react'
import { Menu, Bell, CheckCircle2 } from 'lucide-react'
import { BranchSelector } from '@/components/shared/BranchSelector'
import { SearchInput } from '@/components/shared/SearchInput'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { UserMenu } from '@/components/shared/UserMenu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onMobileMenuOpen: () => void
  isCollapsed: boolean
}

export function Header({ onMobileMenuOpen, isCollapsed }: HeaderProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md transition-all duration-300 dark:border-slate-800 dark:bg-slate-900/80 sm:px-6',
        // Margin matches desktop sidebar
        isCollapsed ? 'md:pl-22' : 'md:pl-68'
      )}
    >
      {/* Left side: Hamburger button + Branch selector */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileMenuOpen}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="h-5 w-5" />
        </button>

        <BranchSelector />
      </div>

      {/* Center: Search input */}
      <div className="hidden max-w-md flex-1 px-4 lg:block">
        <SearchInput />
      </div>

      {/* Right side: Notification + ThemeToggle + UserMenu */}
      <div className="flex items-center gap-2">
        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            aria-label="Notificações do sistema"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
          </Button>

          {isNotificationsOpen && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Notificações do Sistema
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400">
                  1 nova
                </span>
              </div>

              <div className="mt-2 space-y-2">
                <div className="flex items-start gap-2.5 rounded-lg bg-blue-50/60 p-2.5 dark:bg-blue-950/40">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Fundação do ERP Ativa
                    </p>
                    <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                      Arquitetura frontend pronta para recepção dos módulos de backend.
                    </p>
                    <span className="mt-1 block text-[10px] text-slate-400">
                      Hoje às 15:45
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <ThemeToggle />

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

        <UserMenu />
      </div>
    </header>
  )
}
