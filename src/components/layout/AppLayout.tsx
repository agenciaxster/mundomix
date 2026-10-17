import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { Toaster } from '@/components/shared/Toaster'
import { cn } from '@/lib/utils'

const SIDEBAR_STATE_KEY = 'erp_mundomix_sidebar_collapsed'

export function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_STATE_KEY) === 'true'
  })
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_STATE_KEY, String(next))
      return next
    })
  }

  // Close mobile drawer on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar navigation */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Top Header */}
      <Header
        onMobileMenuOpen={() => setIsMobileOpen(true)}
        isCollapsed={isCollapsed}
      />

      {/* Main Content Area */}
      <main
        className={cn(
          'transition-all duration-300 ease-in-out p-4 sm:p-6 lg:p-8',
          isCollapsed ? 'md:pl-22' : 'md:pl-68'
        )}
      >
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      <Toaster />
    </div>
  )
}
