import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Plus,
  Search,
  RefreshCw,
  Shield,
  CheckCircle2,
  XCircle,
  Pencil,
  Power,
  PowerOff,
  GitBranch,
  Mail,
  Phone,
} from 'lucide-react'
import {
  listCompanyUsers,
  toggleUserCompanyAccessStatus,
} from '@/lib/services/users.service'
import type { ManagedUser, AccessStatus } from '@/types/auth'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { maskPhone } from '@/lib/utils/masks'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { UserFormModal } from './UserFormModal'
import { RolesPermissionsModal } from './RolesPermissionsModal'

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  owner: { label: 'Proprietário', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  admin: { label: 'Administrador', color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  manager: { label: 'Gerente', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  salesperson: { label: 'Vendedor', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  cashier: { label: 'Operador de Caixa', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  operator: { label: 'Operador', color: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
}

export function UsersListPage() {
  const { activeCompany, activeRole, hasPermission } = useAuth()
  const canManageUsers = activeRole === 'owner' || activeRole === 'admin' || hasPermission('users', 'create')

  // Estado da lista
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modais
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false)
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<ManagedUser | null>(null)

  // Diálogo de confirmação para ativar/desativar
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    user: ManagedUser | null
    action: 'activate' | 'deactivate'
  }>({ open: false, user: null, action: 'deactivate' })
  const [isActing, setIsActing] = useState(false)

  // Carrega lista de usuários da empresa
  const loadUsers = useCallback(async () => {
    if (!activeCompany) return
    setIsLoading(true)
    setError(null)

    const res = await listCompanyUsers(activeCompany.id)
    if (res.success) {
      setUsers(res.data)
    } else {
      setError(res.error)
    }
    setIsLoading(false)
  }, [activeCompany])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  // Filtragem
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const term = search.toLowerCase()
      const matchesSearch =
        !term ||
        u.fullName.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.phone && u.phone.includes(term))

      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && u.accessStatus === 'active') ||
        (statusFilter === 'inactive' && u.accessStatus === 'inactive')

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, search, roleFilter, statusFilter])

  // Ação de Ativar / Desativar acesso
  const handleToggleStatus = async () => {
    if (!confirmDialog.user || !activeCompany) return
    setIsActing(true)

    const nextStatus: AccessStatus = confirmDialog.action === 'activate' ? 'active' : 'inactive'
    const res = await toggleUserCompanyAccessStatus(activeCompany.id, confirmDialog.user.id, nextStatus)

    setIsActing(false)
    if (res.success) {
      toast({
        title: confirmDialog.action === 'activate' ? 'Acesso Ativado' : 'Acesso Desativado',
        description: `O acesso do usuário ${confirmDialog.user.fullName} foi alterado com sucesso.`,
        variant: 'default',
      })
      setConfirmDialog({ open: false, user: null, action: 'deactivate' })
      void loadUsers()
    } else {
      toast({
        title: 'Erro ao alterar status',
        description: res.error,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Usuários & Permissões"
        description="Gestão de operadores, funcionários, filiais autorizadas e matriz de permissões"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRolesModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Perfis & Permissões</span>
          </Button>

          {canManageUsers && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedUserToEdit(null)
                setIsFormOpen(true)
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Usuário</span>
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, e-mail ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Filtro por Papel */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos os Cargos</option>
              <option value="owner">Proprietário</option>
              <option value="admin">Administrador</option>
              <option value="manager">Gerente</option>
              <option value="salesperson">Vendedor</option>
              <option value="cashier">Operador de Caixa</option>
              <option value="operator">Operador</option>
            </select>

            {/* Filtro por Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadUsers()}
          disabled={isLoading}
          className="self-end sm:self-auto"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Conteúdo Principal */}
      {isLoading ? (
        <LoadingState text="Carregando usuários da empresa..." />
      ) : error ? (
        <ErrorState
          title="Erro ao carregar usuários"
          description={error}
          onRetry={() => void loadUsers()}
        />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          title="Nenhum usuário encontrado"
          description={
            search || roleFilter !== 'all' || statusFilter !== 'all'
              ? 'Tente ajustar os filtros ou termos da sua busca.'
              : 'Cadastre operadores, vendedores e gerentes para começar a operar.'
          }
          action={
            canManageUsers && !search && roleFilter === 'all' ? (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedUserToEdit(null)
                  setIsFormOpen(true)
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Cadastrar Primeiro Usuário
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Usuário</th>
                  <th className="py-3.5 px-4">Cargo / Perfil</th>
                  <th className="py-3.5 px-4">Filiais Autorizadas</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredUsers.map((u) => {
                  const roleStyle = ROLE_BADGES[u.role] || ROLE_BADGES.operator
                  const isActive = u.accessStatus === 'active'

                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        'hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition',
                        !isActive && 'opacity-60 bg-slate-50/30 dark:bg-slate-900/40'
                      )}
                    >
                      {/* Usuário: Nome, e-mail e telefone */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 text-xs">
                            {u.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white text-sm">
                              {u.fullName}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {u.email}
                              </span>
                              {u.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {maskPhone(u.phone)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cargo / Perfil */}
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                            roleStyle.color
                          )}
                        >
                          {u.roleName || roleStyle.label}
                        </span>
                      </td>

                      {/* Filiais Autorizadas */}
                      <td className="py-3 px-4">
                        {u.role === 'owner' || u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                            <GitBranch className="h-3.5 w-3.5" /> Todas as filiais
                          </span>
                        ) : u.branches.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">Nenhuma filial atribuída</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {u.branches.slice(0, 2).map((b) => (
                              <span
                                key={b.id}
                                className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300"
                              >
                                {b.name}
                              </span>
                            ))}
                            {u.branches.length > 2 && (
                              <span className="inline-flex items-center rounded-md bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                +{u.branches.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <XCircle className="h-3 w-3" /> Inativo
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManageUsers && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Editar usuário"
                              onClick={() => {
                                setSelectedUserToEdit(u)
                                setIsFormOpen(true)
                              }}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}

                          {canManageUsers && u.role !== 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title={isActive ? 'Desativar acesso' : 'Reativar acesso'}
                              onClick={() => {
                                setConfirmDialog({
                                  open: true,
                                  user: u,
                                  action: isActive ? 'deactivate' : 'activate',
                                })
                              }}
                              className={cn(
                                'h-8 w-8 p-0',
                                isActive
                                  ? 'text-slate-400 hover:text-rose-600'
                                  : 'text-slate-400 hover:text-emerald-600'
                              )}
                            >
                              {isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Usuário */}
      {activeCompany && (
        <UserFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => void loadUsers()}
          companyId={activeCompany.id}
          userToEdit={selectedUserToEdit}
        />
      )}

      {/* Modal de Perfis e Matriz de Permissões */}
      {activeCompany && (
        <RolesPermissionsModal
          isOpen={isRolesModalOpen}
          onClose={() => setIsRolesModalOpen(false)}
          companyId={activeCompany.id}
        />
      )}

      {/* Diálogo de confirmação para ativar/desativar */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.action === 'activate' ? 'Reativar Usuário' : 'Desativar Usuário'}
        description={
          confirmDialog.action === 'activate'
            ? `Tem certeza que deseja reativar o acesso de "${confirmDialog.user?.fullName}"? O usuário voltará a poder acessar o ERP.`
            : `Tem certeza que deseja desativar o acesso de "${confirmDialog.user?.fullName}"? O usuário perderá o acesso imediatamente, preservando todo o histórico de operações.`
        }
        confirmText={confirmDialog.action === 'activate' ? 'Reativar' : 'Desativar'}
        variant={confirmDialog.action === 'activate' ? 'default' : 'destructive'}
        onConfirm={handleToggleStatus}
        isLoading={isActing}
      />
    </div>
  )
}
