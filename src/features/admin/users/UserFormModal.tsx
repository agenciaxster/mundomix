import { useState, useEffect } from 'react'
import {
  User,
  Shield,
  GitBranch,
  Save,
  X,
} from 'lucide-react'
import {
  createCompanyUser,
  updateCompanyUserAccess,
  updateUserProfile,
  listRoles,
} from '@/lib/services/users.service'
import { listBranches, type Branch } from '@/lib/services/companies.service'
import type { ManagedUser, Role, UserCompanyRole } from '@/types/auth'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { maskPhone } from '@/lib/utils/masks'
import { toast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

interface UserFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  companyId: string
  userToEdit?: ManagedUser | null
}

export function UserFormModal({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  userToEdit,
}: UserFormModalProps) {
  const { activeRole } = useAuth()
  const isOwner = activeRole === 'owner'

  const isEditing = Boolean(userToEdit)

  // Form State
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserCompanyRole>('salesperson')
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])

  // Data State
  const [availableRoles, setAvailableRoles] = useState<Role[]>([])
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Inicializa dados quando o modal abre
  useEffect(() => {
    if (!isOpen || !companyId) return

    async function loadAuxiliaryData() {
      setIsLoadingData(true)
      const [rolesRes, branchesRes] = await Promise.all([
        listRoles(companyId),
        listBranches(companyId),
      ])

      if (rolesRes.success) {
        // Filtra papéis de acordo com o nível de privilégio do usuário logado:
        // Apenas 'owner' pode atribuir papel 'owner'
        const allowedRoles = isOwner
          ? rolesRes.data
          : rolesRes.data.filter((r) => r.slug !== 'owner')

        setAvailableRoles(allowedRoles)
      }

      if (branchesRes.success) {
        setAvailableBranches(branchesRes.data)
      }

      // Se estiver editando, preenche os campos
      if (userToEdit) {
        setFullName(userToEdit.fullName)
        setEmail(userToEdit.email)
        setPhone(maskPhone(userToEdit.phone || ''))
        setSelectedRole(userToEdit.role)
        setSelectedRoleId(userToEdit.roleId || '')
        setSelectedBranchIds(userToEdit.branches.map((b) => b.id))
        setPassword('')
      } else {
        setFullName('')
        setEmail('')
        setPhone('')
        setPassword('')
        setSelectedRole('salesperson')
        setSelectedRoleId('')
        setSelectedBranchIds([])
      }

      setFormErrors({})
      setIsLoadingData(false)
    }

    void loadAuxiliaryData()
  }, [isOpen, companyId, userToEdit, isOwner])

  const toggleBranchSelection = (branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    )
  }

  const handleRoleChange = (roleSlug: UserCompanyRole, roleId?: string) => {
    setSelectedRole(roleSlug)
    if (roleId) setSelectedRoleId(roleId)
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!fullName.trim()) errs.fullName = 'O nome completo é obrigatório.'
    if (!email.trim() || !email.includes('@')) errs.email = 'E-mail corporativo válido é obrigatório.'

    if (!isEditing) {
      if (password && password.length < 6) {
        errs.password = 'A senha deve ter no mínimo 6 caracteres.'
      }
    }

    // Admins e owners têm acesso automático a todas as filiais
    if (selectedRole !== 'owner' && selectedRole !== 'admin' && selectedBranchIds.length === 0) {
      errs.branches = 'Selecione pelo menos uma filial de atuação para o operador.'
    }

    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)

    try {
      if (isEditing && userToEdit) {
        // Atualiza perfil cadastral
        await updateUserProfile({
          userId: userToEdit.id,
          fullName: fullName.trim(),
          phone: phone.trim() || null,
        })

        // Atualiza papéis e filiais na empresa
        const accessRes = await updateCompanyUserAccess({
          companyId,
          userId: userToEdit.id,
          role: selectedRole,
          roleId: selectedRoleId || undefined,
          branchIds: selectedBranchIds,
        })

        if (!accessRes.success) {
          toast({
            title: 'Erro ao atualizar acessos',
            description: accessRes.error,
            variant: 'destructive',
          })
          setIsSubmitting(false)
          return
        }

        toast({
          title: 'Usuário atualizado',
          description: 'Os dados e permissões foram salvos com sucesso.',
          variant: 'default',
        })
      } else {
        // Criação de novo usuário
        const createRes = await createCompanyUser({
          companyId,
          email: email.trim().toLowerCase(),
          password: password.trim() || undefined,
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          role: selectedRole,
          roleId: selectedRoleId || undefined,
          branchIds: selectedBranchIds,
        })

        if (!createRes.success) {
          toast({
            title: 'Erro ao cadastrar usuário',
            description: createRes.error,
            variant: 'destructive',
          })
          setIsSubmitting(false)
          return
        }

        toast({
          title: 'Usuário cadastrado',
          description: 'O usuário foi integrado ao sistema e vinculado à empresa.',
          variant: 'default',
        })
      }

      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast({
        title: 'Erro inesperado',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isEditing ? 'Editar Usuário & Acessos' : 'Novo Usuário do Sistema'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEditing
                  ? 'Altere perfil, cargo e filiais autorizadas'
                  : 'Cadastre operadores, vendedores e gerentes com vínculo direto à empresa'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Seção 1: Dados do Perfil */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Dados Pessoais & Login
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nome Completo *
                </label>
                <Input
                  placeholder="Ex: Carlos Eduardo Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={cn(formErrors.fullName && 'border-rose-500')}
                />
                {formErrors.fullName && (
                  <p className="text-[11px] text-rose-500">{formErrors.fullName}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  E-mail de Acesso *
                </label>
                <Input
                  type="email"
                  placeholder="carlos@empresa.com.br"
                  value={email}
                  disabled={isEditing}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(formErrors.email && 'border-rose-500', isEditing && 'bg-slate-100 dark:bg-slate-800 text-slate-500')}
                />
                {formErrors.email && (
                  <p className="text-[11px] text-rose-500">{formErrors.email}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Telefone / WhatsApp
                </label>
                <Input
                  placeholder="(11) 98765-4321"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                />
              </div>

              {!isEditing && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Senha Temporária (opcional)
                  </label>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 dígitos (ou gerada auto)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(formErrors.password && 'border-rose-500')}
                  />
                  {formErrors.password && (
                    <p className="text-[11px] text-rose-500">{formErrors.password}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Seção 2: Perfil / Cargo de Acesso */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" /> Cargo / Perfil de Acesso
              </h3>
              <span className="text-[11px] text-slate-500">Determina permissões nos módulos</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {availableRoles.map((role) => {
                const isSelected =
                  selectedRoleId === role.id ||
                  (!selectedRoleId && selectedRole === role.slug)

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleRoleChange(role.slug as UserCompanyRole, role.id)}
                    className={cn(
                      'p-3 rounded-xl border text-left flex flex-col justify-between transition',
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    )}
                  >
                    <div>
                      <span className="font-bold text-xs block">{role.name}</span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {role.description || 'Perfil do sistema'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Seção 3: Vínculo com Filiais Autorizadas */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5" /> Filiais Autorizadas
              </h3>
              {selectedRole === 'owner' || selectedRole === 'admin' ? (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  Acesso irrestrito a todas as filiais
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">
                  {selectedBranchIds.length} selecionada(s)
                </span>
              )}
            </div>

            {selectedRole === 'owner' || selectedRole === 'admin' ? (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                Administradores e Proprietários possuem visão consolidada de todas as unidades da empresa automaticamente.
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableBranches.map((branch) => {
                    const isChecked = selectedBranchIds.includes(branch.id)
                    return (
                      <label
                        key={branch.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition select-none',
                          isChecked
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-400/50 dark:border-indigo-600'
                            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={isChecked}
                          onChange={() => toggleBranchSelection(branch.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {branch.name}
                            </span>
                            <span className="text-[10px] uppercase font-mono text-slate-400">
                              {branch.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {branch.city} / {branch.state} • {branch.branch_type === 'matriz' ? 'Matriz' : 'Filial'}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>
                {formErrors.branches && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.branches}</p>
                )}
              </div>
            )}
          </div>

          {/* Footer do Form */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoadingData}
              className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
            >
              {isSubmitting ? (
                'Salvando...'
              ) : (
                <span className="flex items-center gap-1.5">
                  <Save className="h-4 w-4" /> {isEditing ? 'Atualizar Usuário' : 'Cadastrar Usuário'}
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
