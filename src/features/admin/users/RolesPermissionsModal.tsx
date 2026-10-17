import { useState, useEffect } from 'react'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Plus,
  Lock,
} from 'lucide-react'
import {
  listRoles,
  getRolePermissions,
  saveCustomRole,
} from '@/lib/services/users.service'
import type { Role, SystemModule } from '@/types/auth'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import { toast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

const MODULE_DEFINITIONS: { id: SystemModule; label: string; description: string }[] = [
  { id: 'users', label: 'Usuários e Permissões', description: 'Controle de usuários, operadores e permissões de acesso' },
  { id: 'companies', label: 'Empresas e Filiais', description: 'Visualização e gestão das unidades de negócio' },
  { id: 'products', label: 'Produtos e Catálogo', description: 'Cadastros de mercadorias, SKUs, preços e marcas' },
  { id: 'sales', label: 'Vendas e PDV', description: 'Pedidos de venda, orçamentos e frente de caixa PDV' },
  { id: 'stock', label: 'Estoque', description: 'Movimentações, transferências entre filiais e inventário' },
  { id: 'financial', label: 'Financeiro', description: 'Contas a pagar/receber, crediário e fluxo de caixa' },
  { id: 'reports', label: 'Relatórios e Dashboards', description: 'Relatórios executivos, de vendas e desempenho' },
  { id: 'settings', label: 'Configurações', description: 'Configurações globais e preferências da empresa' },
]

export function RolesPermissionsModal({
  isOpen,
  onClose,
  companyId,
}: {
  isOpen: boolean
  onClose: () => void
  companyId: string
}) {
  const { activeRole } = useAuth()
  const isOwnerOrAdmin = activeRole === 'owner' || activeRole === 'admin'

  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [rolePermissions, setRolePermissions] = useState<
    Record<SystemModule, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }>
  >({
    users: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    companies: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    products: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    sales: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    stock: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    financial: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    reports: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    settings: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')

  // Carrega lista de roles
  useEffect(() => {
    if (!isOpen || !companyId) return
    async function fetchRoles() {
      setIsLoading(true)
      const res = await listRoles(companyId)
      if (res.success && res.data.length > 0) {
        setRoles(res.data)
        setSelectedRole(res.data[0])
      }
      setIsLoading(false)
    }
    void fetchRoles()
  }, [isOpen, companyId])

  // Carrega permissões do role selecionado
  useEffect(() => {
    if (!selectedRole) return
    async function fetchPermissions() {
      if (selectedRole?.slug === 'admin' || selectedRole?.slug === 'owner') {
        const full: typeof rolePermissions = {} as typeof rolePermissions
        MODULE_DEFINITIONS.forEach((m) => {
          full[m.id] = { can_view: true, can_create: true, can_edit: true, can_delete: true }
        })
        setRolePermissions(full)
        return
      }

      const res = await getRolePermissions(selectedRole!.id)
      const initial: typeof rolePermissions = {
        users: { can_view: false, can_create: false, can_edit: false, can_delete: false },
        companies: { can_view: false, can_create: false, can_edit: false, can_delete: false },
        products: { can_view: false, can_create: false, can_edit: false, can_delete: false },
        sales: { can_view: false, can_create: false, can_edit: false, can_delete: false },
        stock: { can_view: false, can_create: false, can_edit: false, can_delete: false },
        financial: { can_view: false, can_create: false, can_edit: false, can_delete: false },
        reports: { can_view: false, can_create: false, can_edit: false, can_delete: false },
        settings: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      }

      if (res.success && res.data) {
        res.data.forEach((p) => {
          const mod = p.module as SystemModule
          if (initial[mod]) {
            initial[mod] = {
              can_view: p.can_view,
              can_create: p.can_create,
              can_edit: p.can_edit,
              can_delete: p.can_delete,
            }
          }
        })
      }
      setRolePermissions(initial)
    }
    void fetchPermissions()
  }, [selectedRole])

  const togglePermission = (mod: SystemModule, action: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') => {
    if (selectedRole?.is_system && !isCreatingNew) return // Perfis de sistema são pré-configurados
    setRolePermissions((prev) => {
      const current = prev[mod]
      const nextValue = !current[action]
      const updated = { ...current, [action]: nextValue }
      if (nextValue && action !== 'can_view') {
        updated.can_view = true
      }
      return { ...prev, [mod]: updated }
    })
  }

  const handleSaveCustomRole = async () => {
    if (!companyId) return
    if (isCreatingNew && !newRoleName.trim()) {
      toast({ title: 'Atenção', description: 'Informe o nome do novo perfil.', variant: 'destructive' })
      return
    }

    setIsSaving(true)
    const permissionsArray = MODULE_DEFINITIONS.map((m) => ({
      module: m.id,
      ...rolePermissions[m.id],
    }))

    const res = await saveCustomRole({
      companyId,
      roleId: isCreatingNew ? undefined : selectedRole?.id,
      name: isCreatingNew ? newRoleName.trim() : (selectedRole?.name || ''),
      description: isCreatingNew ? newRoleDesc.trim() : selectedRole?.description || '',
      permissions: permissionsArray,
    })

    setIsSaving(false)
    if (res.success) {
      toast({
        title: isCreatingNew ? 'Perfil criado' : 'Permissões atualizadas',
        description: 'As regras de acesso foram salvas com sucesso.',
        variant: 'default',
      })
      setIsCreatingNew(false)
      setNewRoleName('')
      setNewRoleDesc('')
      const refreshed = await listRoles(companyId)
      if (refreshed.success) {
        setRoles(refreshed.data)
        const updatedTarget = refreshed.data.find((r) => r.id === res.data.id) ?? refreshed.data[0]
        setSelectedRole(updatedTarget)
      }
    } else {
      toast({
        title: 'Erro ao salvar perfil',
        description: res.error,
        variant: 'destructive',
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Perfis de Acesso & Permissões
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visualize e configure privilégios por módulo (visualizar, criar, editar, excluir)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
          {/* Coluna Esquerda: Lista de Cargos/Perfis */}
          <div className="p-4 overflow-y-auto space-y-2 bg-slate-50/40 dark:bg-slate-900/40">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cargos / Perfis
              </span>
              {isOwnerOrAdmin && !isCreatingNew && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(true)
                    setSelectedRole(null)
                    setNewRoleName('')
                    setNewRoleDesc('')
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  <Plus className="h-3.5 w-3.5" /> Novo Perfil
                </button>
              )}
            </div>

            {isCreatingNew && (
              <div className="p-3 rounded-xl border border-indigo-500/50 bg-indigo-50/40 dark:bg-indigo-950/30 space-y-2">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Novo Perfil Personalizado</span>
                <Input
                  placeholder="Nome do cargo (ex: Supervisor)"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Descrição breve..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white w-full"
                    onClick={handleSaveCustomRole}
                    disabled={isSaving}
                  >
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs w-full"
                    onClick={() => {
                      setIsCreatingNew(false)
                      if (roles.length > 0) setSelectedRole(roles[0])
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <LoadingState text="Carregando perfis..." />
            ) : (
              roles.map((r) => {
                const isSelected = selectedRole?.id === r.id && !isCreatingNew
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(false)
                      setSelectedRole(r)
                    }}
                    className={cn(
                      'w-full text-left p-3 rounded-xl transition flex flex-col gap-1 border',
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500/40 text-indigo-900 dark:text-indigo-200'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{r.name}</span>
                      {r.is_system ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500 font-medium">
                          <Lock className="h-2.5 w-2.5" /> Padrão
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">
                          Custom
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {r.description}
                      </p>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Coluna Direita: Matriz de Permissões */}
          <div className="p-6 md:col-span-2 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {isCreatingNew ? (newRoleName || 'Novo Cargo') : selectedRole?.name}
                  {selectedRole?.is_system && (
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      Perfil nativo do sistema (somente leitura)
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isCreatingNew
                    ? 'Defina os privilégios concedidos a este perfil nos módulos do ERP'
                    : selectedRole?.description}
                </p>
              </div>

              {isOwnerOrAdmin && selectedRole && !selectedRole.is_system && !isCreatingNew && (
                <Button
                  size="sm"
                  onClick={handleSaveCustomRole}
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              )}
            </div>

            {/* Matriz de Módulos */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Módulo</th>
                    <th className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">Visualizar</th>
                    <th className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">Criar</th>
                    <th className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">Editar</th>
                    <th className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">Excluir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {MODULE_DEFINITIONS.map((m) => {
                    const perm = rolePermissions[m.id]
                    const isSystemLocked = selectedRole?.is_system && !isCreatingNew

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900 dark:text-white text-xs">{m.label}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{m.description}</p>
                        </td>

                        {/* Visualizar */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={isSystemLocked}
                            onClick={() => togglePermission(m.id, 'can_view')}
                            className={cn(
                              'inline-flex h-6 w-6 items-center justify-center rounded-lg transition',
                              perm?.can_view
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
                              isSystemLocked ? 'opacity-80 cursor-not-allowed' : 'hover:scale-105'
                            )}
                          >
                            {perm?.can_view ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </button>
                        </td>

                        {/* Criar */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={isSystemLocked}
                            onClick={() => togglePermission(m.id, 'can_create')}
                            className={cn(
                              'inline-flex h-6 w-6 items-center justify-center rounded-lg transition',
                              perm?.can_create
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
                              isSystemLocked ? 'opacity-80 cursor-not-allowed' : 'hover:scale-105'
                            )}
                          >
                            {perm?.can_create ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </button>
                        </td>

                        {/* Editar */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={isSystemLocked}
                            onClick={() => togglePermission(m.id, 'can_edit')}
                            className={cn(
                              'inline-flex h-6 w-6 items-center justify-center rounded-lg transition',
                              perm?.can_edit
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
                              isSystemLocked ? 'opacity-80 cursor-not-allowed' : 'hover:scale-105'
                            )}
                          >
                            {perm?.can_edit ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </button>
                        </td>

                        {/* Excluir */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={isSystemLocked}
                            onClick={() => togglePermission(m.id, 'can_delete')}
                            className={cn(
                              'inline-flex h-6 w-6 items-center justify-center rounded-lg transition',
                              perm?.can_delete
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
                              isSystemLocked ? 'opacity-80 cursor-not-allowed' : 'hover:scale-105'
                            )}
                          >
                            {perm?.can_delete ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
