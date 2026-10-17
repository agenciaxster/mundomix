import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Plus, Search, RefreshCw, MoreVertical,
  CheckCircle2, XCircle, Eye, Pencil, Power, PowerOff,
  ChevronLeft, ChevronRight, GitBranch, Trash2, UserMinus
} from 'lucide-react'
import {
  listCompanies, activateCompany, deactivateCompany,
  deleteCompany, leaveCompany
} from '@/lib/services/companies.service'
import type { Company } from '@/lib/services/companies.service'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { maskCnpj, maskPhone } from '@/lib/utils/masks'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

const PAGE_SIZE = 10

function StatusBadge({ status }: { status: Company['status'] }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Ativa
      </span>
    )
  }
  if (status === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
        <XCircle className="h-3 w-3" /> Suspensa
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      <XCircle className="h-3 w-3" /> Inativa
    </span>
  )
}

export function CompaniesListPage() {
  const navigate = useNavigate()
  const { user, activeRole, companies: userCompanies, refreshProfile } = useAuth()
  
  // O usuário pode criar empresa se for admin/owner ou se for um usuário administrativo
  const isGlobalAdmin =
    activeRole === 'owner' ||
    activeRole === 'admin' ||
    userCompanies.length === 0 ||
    userCompanies.some((c) => c.role === 'owner' || c.role === 'admin')

  // O usuário pode editar/excluir uma empresa se for admin global,
  // criador do registro ou se tiver permissão de owner/admin na empresa
  const canManageCompany = (company: Company) => {
    if (isGlobalAdmin) return true
    if (user && company.created_by && company.created_by === user.id) return true
    const access = userCompanies.find((c) => c.company?.id === company.id)
    return !access || access.role === 'owner' || access.role === 'admin'
  }

  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    company: Company | null
    action: 'activate' | 'deactivate' | 'delete' | 'leave'
  }>({ open: false, company: null, action: 'deactivate' })
  const [isActing, setIsActing] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const result = await listCompanies()
    if (result.success) {
      setCompanies(result.data)
    } else {
      setError(result.error)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  // Filtragem local
  const filtered = companies.filter((c) => {
    const term = search.toLowerCase()
    const matchesSearch =
      !term ||
      c.trade_name.toLowerCase().includes(term) ||
      c.legal_name.toLowerCase().includes(term) ||
      c.cnpj.includes(term)
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && c.status === 'active') ||
      (filterStatus === 'inactive' && c.status !== 'active')
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleConfirmAction = async () => {
    if (!confirmDialog.company) return
    setIsActing(true)
    const company = confirmDialog.company

    if (confirmDialog.action === 'delete') {
      const result = await deleteCompany(company.id)
      if (result.success) {
        toast({ title: 'Empresa excluída com sucesso!', variant: 'default' })
        await refreshProfile()
        await load()
      } else {
        toast({ title: 'Erro ao excluir empresa', description: result.error, variant: 'destructive' })
      }
    } else if (confirmDialog.action === 'leave') {
      const result = await leaveCompany(company.id)
      if (result.success) {
        toast({ title: 'Vínculo removido com sucesso!', variant: 'default' })
        await refreshProfile()
        await load()
      } else {
        toast({ title: 'Erro ao desvincular da empresa', description: result.error, variant: 'destructive' })
      }
    } else {
      const fn = confirmDialog.action === 'activate' ? activateCompany : deactivateCompany
      const result = await fn(company.id)
      if (result.success) {
        toast({ title: confirmDialog.action === 'activate' ? 'Empresa ativada' : 'Empresa desativada', variant: 'default' })
        await load()
      } else {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' })
      }
    }

    setIsActing(false)
    setConfirmDialog({ open: false, company: null, action: 'deactivate' })
  }

  // Stats
  const activeCount = companies.filter((c) => c.status === 'active').length
  const inactiveCount = companies.filter((c) => c.status !== 'active').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas e Grupos"
        description="Gerencie as empresas e seus grupos empresariais."
        icon={Building2}
      >
        {isGlobalAdmin && (
          <Button id="btn-new-company" onClick={() => navigate('/admin/empresas-filiais/nova')}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Empresa
          </Button>
        )}
      </PageHeader>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total de Empresas', value: companies.length, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Ativas', value: activeCount, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Inativas / Suspensas', value: inactiveCount, color: 'text-slate-500 dark:text-slate-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="company-search"
            placeholder="Buscar por nome ou CNPJ..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>

        <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          {([
            { value: 'all', label: 'Todas' },
            { value: 'active', label: 'Ativas' },
            { value: 'inactive', label: 'Inativas' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setFilterStatus(opt.value); setPage(1) }}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                filterStatus === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Button variant="outline" size="icon" onClick={() => void load()} title="Atualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <LoadingState text="Carregando empresas..." />
      ) : error ? (
        <ErrorState title="Erro ao carregar empresas" description={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa encontrada"
          description={search ? 'Tente outro termo de busca.' : 'Cadastre a primeira empresa para começar.'}
          action={
            isGlobalAdmin ? (
              <Button onClick={() => navigate('/admin/empresas-filiais/nova')}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Empresa
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Tabela */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    {['Empresa', 'CNPJ', 'Contato', 'Cidade / Estado', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginated.map((company) => (
                    <tr key={company.id} className="group hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">{company.trade_name}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500">{company.legal_name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {maskCnpj(company.cnpj)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          {company.phone ? maskPhone(company.phone) : '—'}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">{company.email ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {company.city && company.state
                          ? `${company.city} / ${company.state}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={company.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={() => navigate(`/admin/empresas-filiais/${company.id}/filiais`)}
                            title="Ver filiais"
                          >
                            <GitBranch className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={() => navigate(`/admin/empresas-filiais/${company.id}`)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {canManageCompany(company) && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                onClick={() => navigate(`/admin/empresas-filiais/${company.id}/editar`)}
                                title="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                onClick={() => setConfirmDialog({ open: true, company, action: 'delete' })}
                                title="Excluir empresa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                              <div className="relative">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                  onClick={() => setOpenMenuId(openMenuId === company.id ? null : company.id)}
                                  title="Mais ações"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                                {openMenuId === company.id && (
                                  <div className="absolute right-0 top-full z-40 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                                    {company.status === 'active' ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuId(null)
                                          setConfirmDialog({ open: true, company, action: 'deactivate' })
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                      >
                                        <PowerOff className="h-3.5 w-3.5" /> Desativar empresa
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuId(null)
                                          setConfirmDialog({ open: true, company, action: 'activate' })
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                                      >
                                        <Power className="h-3.5 w-3.5" /> Reativar empresa
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        setConfirmDialog({ open: true, company, action: 'leave' })
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60"
                                    >
                                      <UserMinus className="h-3.5 w-3.5" /> Desvincular da empresa
                                    </button>

                                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        setConfirmDialog({ open: true, company, action: 'delete' })
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" /> Excluir empresa
                                    </button>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {filtered.length} empresa{filtered.length !== 1 ? 's' : ''} · página {page} de {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Diálogo de confirmação */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(v) => !v && setConfirmDialog((d) => ({ ...d, open: false }))}
        title={
          confirmDialog.action === 'delete'
            ? 'Excluir empresa definitivamente'
            : confirmDialog.action === 'leave'
            ? 'Desvincular da empresa'
            : confirmDialog.action === 'deactivate'
            ? 'Desativar empresa'
            : 'Reativar empresa'
        }
        description={
          confirmDialog.action === 'delete'
            ? `Atenção: Esta ação é irreversível. A empresa "${confirmDialog.company?.trade_name}", suas filiais, vínculos de usuários e configurações serão permanentemente excluídos.`
            : confirmDialog.action === 'leave'
            ? `Você deixará de ter acesso à empresa "${confirmDialog.company?.trade_name}". A empresa continuará existindo no sistema para os demais usuários autorizados.`
            : confirmDialog.action === 'deactivate'
            ? `Deseja desativar "${confirmDialog.company?.trade_name}"? Os dados serão preservados e a empresa poderá ser reativada a qualquer momento.`
            : `Deseja reativar "${confirmDialog.company?.trade_name}"?`
        }
        confirmText={
          confirmDialog.action === 'delete'
            ? 'Excluir permanentemente'
            : confirmDialog.action === 'leave'
            ? 'Desvincular'
            : confirmDialog.action === 'deactivate'
            ? 'Desativar'
            : 'Reativar'
        }
        variant={confirmDialog.action === 'activate' ? 'default' : 'destructive'}
        onConfirm={() => void handleConfirmAction()}
        isLoading={isActing}
      />
    </div>
  )
}
