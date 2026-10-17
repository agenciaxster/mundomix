import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Building2, Loader2, ArrowLeft, Save, MapPin, Search } from 'lucide-react'
import {
  createCompany, updateCompany, getCompany, type Company
} from '@/lib/services/companies.service'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/shared/LoadingState'
import {
  maskCnpj, maskCep, maskPhone, validateCnpj,
  onlyDigits, fetchCep, ESTADOS_BR
} from '@/lib/utils/masks'
import { toast } from '@/hooks/useToast'

interface FormData {
  legal_name: string
  trade_name: string
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
  status: 'active' | 'inactive' | 'suspended'
}

const EMPTY: FormData = {
  legal_name: '', trade_name: '', cnpj: '', state_registration: '',
  email: '', phone: '', zip_code: '', street: '', number: '',
  complement: '', neighborhood: '', city: 'Palmas', state: 'TO',
  status: 'active',
}

function FormField({
  label, id, required, error, children
}: { label: string; id: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}{required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  )
}

export function CompanyFormPage() {
  const navigate = useNavigate()
  const params = useParams<{ companyId?: string; id?: string }>()
  const id = params.companyId ?? params.id
  const isEditing = !!id
  const { user, activeRole, companies: userCompanies, refreshProfile } = useAuth()

  const [companyData, setCompanyData] = useState<Company | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [isLoadingData, setIsLoadingData] = useState(isEditing)
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingCep, setIsFetchingCep] = useState(false)

  // Carrega dados da empresa para edição
  useEffect(() => {
    if (!isEditing || !id) {
      setIsLoadingData(false)
      return
    }
    setIsLoadingData(true)
    void getCompany(id).then((result) => {
      if (result.success) {
        const c = result.data
        setCompanyData(c)
        setForm({
          legal_name: c.legal_name,
          trade_name: c.trade_name,
          cnpj: maskCnpj(c.cnpj),
          state_registration: c.state_registration ?? '',
          email: c.email ?? '',
          phone: maskPhone(c.phone ?? ''),
          zip_code: maskCep(c.zip_code ?? ''),
          street: c.street ?? '',
          number: c.number ?? '',
          complement: c.complement ?? '',
          neighborhood: c.neighborhood ?? '',
          city: (!c.city || c.city.toLowerCase().includes('sao paulo') || c.city.toLowerCase().includes('são paulo')) ? 'Palmas' : c.city,
          state: (!c.state || (c.state.toUpperCase() === 'SP' && (!c.city || c.city.toLowerCase().includes('sao paulo') || c.city.toLowerCase().includes('são paulo')))) ? 'TO' : c.state,
          status: c.status,
        })
      } else {
        toast({ title: 'Erro ao carregar empresa', description: result.error, variant: 'destructive' })
        navigate('/admin/empresas-filiais')
      }
      setIsLoadingData(false)
    })
  }, [id, isEditing, navigate])

  const set = useCallback((key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const handleCepLookup = async () => {
    const digits = onlyDigits(form.zip_code)
    if (digits.length !== 8) {
      setErrors((prev) => ({ ...prev, zip_code: 'CEP inválido.' }))
      return
    }
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
      setErrors((prev) => ({ ...prev, zip_code: 'CEP não encontrado.' }))
    }
    setIsFetchingCep(false)
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.trade_name.trim()) errs.trade_name = 'Nome fantasia é obrigatório.'
    if (!form.legal_name.trim()) errs.legal_name = 'Razão social é obrigatória.'
    if (!form.cnpj.trim()) {
      errs.cnpj = 'CNPJ é obrigatório.'
    } else if (!validateCnpj(form.cnpj)) {
      errs.cnpj = 'CNPJ inválido. Verifique os dígitos.'
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'E-mail inválido.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    const payload = {
      legal_name: form.legal_name.trim(),
      trade_name: form.trade_name.trim(),
      cnpj: onlyDigits(form.cnpj),
      state_registration: form.state_registration.trim() || null,
      email: form.email.trim() || null,
      phone: onlyDigits(form.phone) || null,
      zip_code: maskCep(onlyDigits(form.zip_code)) || null,
      street: form.street.trim() || null,
      number: form.number.trim() || null,
      complement: form.complement.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      city: form.city.trim() || null,
      state: form.state || null,
      status: form.status,
    }

    const result = isEditing && id
      ? await updateCompany(id, payload)
      : await createCompany(payload)

    if (result.success) {
      toast({ title: isEditing ? 'Empresa atualizada com sucesso!' : 'Empresa criada com sucesso!' })
      await refreshProfile()
      navigate('/admin/empresas-filiais')
    } else {
      toast({ title: 'Erro ao salvar empresa', description: result.error, variant: 'destructive' })
    }
    setIsSaving(false)
  }

  if (isLoadingData) {
    return <LoadingState text="Carregando dados da empresa..." />
  }

  const canEdit =
    activeRole === 'owner' ||
    activeRole === 'admin' ||
    userCompanies.length === 0 ||
    userCompanies.some((c) => c.role === 'owner' || c.role === 'admin' || c.company?.id === id) ||
    Boolean(user && companyData?.created_by === user.id)
  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Você não tem permissão para {isEditing ? 'editar' : 'cadastrar'} empresas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? 'Editar Empresa' : 'Nova Empresa'}
        description={isEditing ? 'Atualize os dados da empresa.' : 'Preencha os dados para cadastrar uma nova empresa.'}
        icon={Building2}
      >
        <Button variant="outline" onClick={() => navigate('/admin/empresas-filiais')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </PageHeader>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6" noValidate>
        {/* Dados principais */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Dados da Empresa</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nome Fantasia" id="trade_name" required error={errors.trade_name}>
              <Input id="trade_name" value={form.trade_name} onChange={(e) => set('trade_name', e.target.value)} placeholder="Ex: MundoMix" />
            </FormField>
            <FormField label="Razão Social" id="legal_name" required error={errors.legal_name}>
              <Input id="legal_name" value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} placeholder="Ex: MundoMix Comércio Ltda" />
            </FormField>
            <FormField label="CNPJ" id="cnpj" required error={errors.cnpj}>
              <Input
                id="cnpj"
                value={form.cnpj}
                onChange={(e) => set('cnpj', maskCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </FormField>
            <FormField label="Inscrição Estadual" id="state_registration" error={errors.state_registration}>
              <Input id="state_registration" value={form.state_registration} onChange={(e) => set('state_registration', e.target.value)} placeholder="Opcional" />
            </FormField>
            <FormField label="Telefone" id="phone" error={errors.phone}>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => set('phone', maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </FormField>
            <FormField label="E-mail" id="email" error={errors.email}>
              <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="contato@empresa.com.br" />
            </FormField>
            {isEditing && (
              <FormField label="Status" id="status" error={errors.status}>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-900 shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="active">Ativa</option>
                  <option value="inactive">Inativa</option>
                  <option value="suspended">Suspensa</option>
                </select>
              </FormField>
            )}
          </div>
        </section>

        {/* Endereço */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <MapPin className="h-4 w-4 text-slate-400" /> Endereço da Sede
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="CEP" id="zip_code" error={errors.zip_code}>
              <div className="flex gap-2">
                <Input
                  id="zip_code"
                  value={form.zip_code}
                  onChange={(e) => set('zip_code', maskCep(e.target.value))}
                  placeholder="00000-000"
                  maxLength={9}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void handleCepLookup()}
                  disabled={isFetchingCep}
                  title="Buscar CEP"
                >
                  {isFetchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </FormField>
            <FormField label="Estado" id="state" error={errors.state}>
              <select
                id="state"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Selecione...</option>
                {ESTADOS_BR.map((e) => (
                  <option key={e.uf} value={e.uf}>{e.uf} — {e.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Cidade" id="city" error={errors.city}>
              <Input id="city" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="São Paulo" />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Logradouro" id="street" error={errors.street}>
                <Input id="street" value={form.street} onChange={(e) => set('street', e.target.value)} placeholder="Rua, Avenida..." />
              </FormField>
            </div>
            <FormField label="Número" id="number" error={errors.number}>
              <Input id="number" value={form.number} onChange={(e) => set('number', e.target.value)} placeholder="123" />
            </FormField>
            <FormField label="Bairro" id="neighborhood" error={errors.neighborhood}>
              <Input id="neighborhood" value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Centro" />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Complemento" id="complement" error={errors.complement}>
                <Input id="complement" value={form.complement} onChange={(e) => set('complement', e.target.value)} placeholder="Sala, Andar, Apto (opcional)" />
              </FormField>
            </div>
          </div>
        </section>

        {/* Ações */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/empresas-filiais')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar empresa'}
          </Button>
        </div>
      </form>
    </div>
  )
}
