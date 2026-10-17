import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  GitBranch, Plus, ArrowLeft, Pencil, Power, PowerOff,
  Building2, MapPin, CheckCircle2, XCircle, Loader2, Save, Search, Trash2
} from 'lucide-react'
import {
  listBranches, getCompany, createBranch, updateBranch,
  activateBranch, deactivateBranch, deleteBranch,
  type Company, type Branch
} from '@/lib/services/companies.service'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  maskCnpj, maskCep, maskPhone, validateCnpj,
  onlyDigits, fetchCep, ESTADOS_BR
} from '@/lib/utils/masks'
import { toast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

// ─── Form de Filial ──────────────────────────────────────────────────────────

interface BranchFormData {
  name: string
  code: string
  branch_type: 'matriz' | 'filial'
  cnpj: string
  state_registration: string
  email: string
  phone: string
  zip_code: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  status: 'active' | 'inactive'
}

const EMPTY_BRANCH: BranchFormData = {
  name: '', code: '', branch_type: 'filial', cnpj: '',
  state_registration: '', email: '', phone: '', zip_code: '',
  street: '', number: '', complement: '', neighborhood: '',
  city: 'Palmas', state: 'TO', status: 'active',
}

function BranchForm({
  companyId,
  initial,
  onSave,
  onCancel,
}: {
  companyId: string
  initial?: Branch
  onSave: (branch: Branch) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<BranchFormData>(
    initial
      ? {
          name: initial.name,
          code: initial.code,
          branch_type: initial.branch_type,
          cnpj: maskCnpj(initial.cnpj ?? ''),
          state_registration: initial.state_registration ?? '',
          email: initial.email ?? '',
          phone: maskPhone(initial.phone ?? ''),
          zip_code: maskCep(initial.zip_code ?? ''),
          street: initial.street ?? '',
          number: initial.number ?? '',
          complement: initial.complement ?? '',
          neighborhood: initial.neighborhood ?? '',
          city: (!initial.city || initial.city.toLowerCase().includes('sao paulo') || initial.city.toLowerCase().includes('são paulo')) ? 'Palmas' : initial.city,
          state: (!initial.state || (initial.state.toUpperCase() === 'SP' && (!initial.city || initial.city.toLowerCase().includes('sao paulo') || initial.city.toLowerCase().includes('são paulo')))) ? 'TO' : initial.state,
          status: initial.status,
        }
      : EMPTY_BRANCH
  )
  const [errors, setErrors] = useState<Partial<Record<keyof BranchFormData, string>>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingCep, setIsFetchingCep] = useState(false)

  const set = (key: keyof BranchFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleCepLookup = async () => {
    const digits = onlyDigits(form.zip_code)
    if (digits.length !== 8) { setErrors((p) => ({ ...p, zip_code: 'CEP inválido.' })); return }
    setIsFetchingCep(true)
    const result = await fetchCep(digits)
    if (result) {
      setForm((prev) => ({
        ...prev,
        street: result.street || prev.street,
        complement: result.complement || prev.complement,
        neighborhood: result.neighborhood || prev.neighborhood,
        city: result.city || prev.city,
        state: result.state || prev.state,
        zip_code: result.zip_code,
      }))
    } else {
      setErrors((p) => ({ ...p, zip_code: 'CEP não encontrado.' }))
    }
    setIsFetchingCep(false)
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof BranchFormData, string>> = {}
    if (!form.name.trim()) errs.name = 'Nome da unidade é obrigatório.'
    if (!form.code.trim()) errs.code = 'Código é obrigatório.'
    if (!form.city.trim()) errs.city = 'Cidade é obrigatória.'
    if (!form.state) errs.state = 'Estado é obrigatório.'
    if (form.cnpj && !validateCnpj(form.cnpj)) errs.cnpj = 'CNPJ inválido.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'E-mail inválido.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSaving(true)
    const payload = {
      company_id: companyId,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      branch_type: form.branch_type,
      cnpj: onlyDigits(form.cnpj) || null,
      state_registration: form.state_registration.trim() || null,
      email: form.email.trim() || null,
      phone: onlyDigits(form.phone) || null,
      zip_code: maskCep(onlyDigits(form.zip_code)) || null,
      street: form.street.trim() || null,
      number: form.number.trim() || null,
      complement: form.complement.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      city: form.city.trim(),
      state: form.state,
      status: form.status,
    }
    const result = initial
      ? await updateBranch(initial.id, payload)
      : await createBranch(payload)
    if (result.success) {
      toast({ title: initial ? 'Filial atualizada!' : 'Filial criada!' })
      onSave(result.data)
    } else {
      toast({ title: 'Erro', description: result.error, variant: 'destructive' })
    }
    setIsSaving(false)
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-900/40 dark:bg-blue-950/10">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {initial ? 'Editar filial' : 'Nova filial'}
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="branch-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome *</label>
          <Input id="branch-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Loja Centro" />
          {errors.name && <p className="text-xs text-rose-600">{errors.name}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="branch-code" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Código *</label>
          <Input id="branch-code" value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="Ex: FIL001" maxLength={20} />
          {errors.code && <p className="text-xs text-rose-600">{errors.code}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="branch-type" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tipo *</label>
          <select id="branch-type" value={form.branch_type} onChange={(e) => set('branch_type', e.target.value)}
            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
            <option value="filial">Filial</option>
            <option value="matriz">Matriz</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="branch-cnpj" className="text-xs font-semibold text-slate-700 dark:text-slate-300">CNPJ</label>
          <Input id="branch-cnpj" value={form.cnpj} onChange={(e) => set('cnpj', maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} />
          {errors.cnpj && <p className="text-xs text-rose-600">{errors.cnpj}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="branch-phone" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Telefone</label>
          <Input id="branch-phone" value={form.phone} onChange={(e) => set('phone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
        </div>
        <div className="space-y-1">
          <label htmlFor="branch-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-mail</label>
          <Input id="branch-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="filial@empresa.com.br" />
          {errors.email && <p className="text-xs text-rose-600">{errors.email}</p>}
        </div>
      </div>

      {/* Endereço da filial */}
      <div className="grid gap-3 sm:grid-cols-3 border-t border-slate-200 pt-3 dark:border-slate-800">
        <div className="space-y-1">
          <label htmlFor="branch-cep" className="text-xs font-semibold text-slate-700 dark:text-slate-300">CEP</label>
          <div className="flex gap-1.5">
            <Input id="branch-cep" value={form.zip_code} onChange={(e) => set('zip_code', maskCep(e.target.value))} placeholder="00000-000" maxLength={9} />
            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => void handleCepLookup()} disabled={isFetchingCep}>
              {isFetchingCep ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {errors.zip_code && <p className="text-xs text-rose-600">{errors.zip_code}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="branch-state" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Estado *</label>
          <select id="branch-state" value={form.state} onChange={(e) => set('state', e.target.value)}
            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
            {ESTADOS_BR.map((s) => <option key={s.uf} value={s.uf}>{s.uf} — {s.name}</option>)}
          </select>
          {errors.state && <p className="text-xs text-rose-600">{errors.state}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="branch-city" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cidade *</label>
          <Input id="branch-city" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="São Paulo" />
          {errors.city && <p className="text-xs text-rose-600">{errors.city}</p>}
        </div>
        <div className="sm:col-span-2 space-y-1">
          <label htmlFor="branch-street" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Logradouro</label>
          <Input id="branch-street" value={form.street} onChange={(e) => set('street', e.target.value)} placeholder="Rua, Avenida..." />
        </div>
        <div className="space-y-1">
          <label htmlFor="branch-number" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Número</label>
          <Input id="branch-number" value={form.number} onChange={(e) => set('number', e.target.value)} placeholder="123" />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          {isSaving ? 'Salvando...' : initial ? 'Salvar' : 'Criar filial'}
        </Button>
      </div>
    </form>
  )
}

// ─── Página principal de filiais ──────────────────────────────────────────────

export function BranchesPage() {
  const params = useParams<{ companyId?: string; id?: string }>()
  const companyId = params.companyId ?? params.id
  const navigate = useNavigate()
  const { user, activeRole, companies: userCompanies } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const canEdit =
    activeRole === 'owner' ||
    activeRole === 'admin' ||
    userCompanies.length === 0 ||
    userCompanies.some((c) => c.role === 'owner' || c.role === 'admin' || c.company?.id === companyId) ||
    Boolean(user && company?.created_by === user.id)
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; branch: Branch | null; action: 'activate' | 'deactivate' | 'delete'
  }>({ open: false, branch: null, action: 'deactivate' })
  const [isActing, setIsActing] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) return
    setIsLoading(true)
    const [compResult, branchResult] = await Promise.all([
      getCompany(companyId),
      listBranches(companyId),
    ])
    if (compResult.success) setCompany(compResult.data)
    if (branchResult.success) setBranches(branchResult.data)
    setIsLoading(false)
  }, [companyId])

  useEffect(() => { void load() }, [load])

  const handleConfirmAction = async () => {
    if (!confirmDialog.branch) return
    setIsActing(true)
    if (confirmDialog.action === 'delete') {
      const result = await deleteBranch(confirmDialog.branch.id)
      if (result.success) {
        toast({ title: 'Filial excluída com sucesso!' })
        void load()
      } else {
        toast({ title: 'Erro ao excluir filial', description: result.error, variant: 'destructive' })
      }
    } else {
      const fn = confirmDialog.action === 'activate' ? activateBranch : deactivateBranch
      const result = await fn(confirmDialog.branch.id)
      if (result.success) {
        toast({ title: confirmDialog.action === 'activate' ? 'Filial ativada' : 'Filial desativada' })
        void load()
      } else {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' })
      }
    }
    setIsActing(false)
    setConfirmDialog({ open: false, branch: null, action: 'deactivate' })
  }

  const handleSaved = (_branch: Branch) => {
    setShowForm(false)
    setEditingBranch(null)
    void load()
  }

  if (isLoading) return <LoadingState text="Carregando filiais..." />

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Filiais — ${company?.trade_name ?? '...'}`}
        description="Gerencie as unidades desta empresa."
        icon={GitBranch}
      >
        <Button variant="outline" onClick={() => navigate('/admin/empresas-filiais')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Empresas
        </Button>
        {canEdit && !showForm && !editingBranch && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova Filial
          </Button>
        )}
      </PageHeader>

      {/* Formulário inline para nova filial */}
      {showForm && companyId && (
        <BranchForm
          companyId={companyId}
          onSave={handleSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Lista de filiais */}
      {branches.length === 0 && !showForm ? (
        <EmptyState
          icon={GitBranch}
          title="Nenhuma filial cadastrada"
          description="Adicione a primeira unidade desta empresa."
          action={canEdit ? <Button size="sm" onClick={() => setShowForm(true)}><Plus className="mr-2 h-3.5 w-3.5" />Nova Filial</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {branches.map((branch) => {
            if (editingBranch?.id === branch.id && companyId) {
              return (
                <BranchForm
                  key={branch.id}
                  companyId={companyId}
                  initial={branch}
                  onSave={handleSaved}
                  onCancel={() => setEditingBranch(null)}
                />
              )
            }
            return (
              <div
                key={branch.id}
                className="group flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    branch.branch_type === 'matriz'
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  )}>
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{branch.name}</span>
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                        branch.branch_type === 'matriz'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      )}>
                        {branch.branch_type}
                      </span>
                      {branch.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Ativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <XCircle className="h-3 w-3" /> Inativa
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono">{branch.code}</span>
                      {branch.cnpj && <span>{maskCnpj(branch.cnpj)}</span>}
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {branch.city} / {branch.state}
                      </span>
                      {branch.phone && <span>{maskPhone(branch.phone)}</span>}
                    </div>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingBranch(branch)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {branch.status === 'active' ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40" onClick={() => setConfirmDialog({ open: true, branch, action: 'deactivate' })} title="Desativar">
                        <PowerOff className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" onClick={() => setConfirmDialog({ open: true, branch, action: 'activate' })} title="Reativar">
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      onClick={() => setConfirmDialog({ open: true, branch, action: 'delete' })}
                      title="Excluir filial"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(v) => !v && setConfirmDialog((d) => ({ ...d, open: false }))}
        title={
          confirmDialog.action === 'delete'
            ? 'Excluir filial'
            : confirmDialog.action === 'deactivate'
            ? 'Desativar filial'
            : 'Reativar filial'
        }
        description={
          confirmDialog.action === 'delete'
            ? `Atenção: Deseja excluir definitivamente a unidade "${confirmDialog.branch?.name}" (${confirmDialog.branch?.code})? Esta ação é irreversível.`
            : confirmDialog.action === 'deactivate'
            ? `Deseja desativar "${confirmDialog.branch?.name}"? Os dados serão preservados.`
            : `Deseja reativar "${confirmDialog.branch?.name}"?`
        }
        confirmText={
          confirmDialog.action === 'delete'
            ? 'Excluir filial'
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
