import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  User,
  ArrowLeft,
  Save,
  Search,
  Loader2,
  AlertCircle,
  CreditCard,
  MapPin,
  Phone,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { customerService } from '@/lib/services/customer.service'
import { receivableService } from '@/lib/services/receivable.service'
import type { CustomerFormData, CreditStatus, CustomerStatus } from '@/types/customer'
import type { CustomerCreditProfile } from '@/types/receivable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import {
  maskCpf,
  maskCnpj,
  maskCep,
  maskPhone,
  validateCpf,
  validateCnpj,
  onlyDigits,
  fetchCep,
  ESTADOS_BR,
} from '@/lib/utils/masks'
import { toast } from '@/hooks/useToast'

export function CustomerFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { activeCompany, activeBranch, companies } = useAuth()

  const currentCompanyData = companies.find((c) => c.company.id === activeCompany?.id)
  const availableBranches = currentCompanyData?.branches || []

  const [isLoading, setIsLoading] = useState(isEditing)
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingCep, setIsFetchingCep] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creditProfile, setCreditProfile] = useState<CustomerCreditProfile | null>(null)

  const [form, setForm] = useState<CustomerFormData>({
    person_type: 'individual',
    name: '',
    trade_name: '',
    document: '',
    state_registration: '',
    email: '',
    phone: '',
    whatsapp: '',
    zip_code: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: 'Palmas',
    state: 'TO',
    credit_limit: 0,
    credit_status: 'available',
    status: 'active',
    notes: '',
    origin_branch_id: activeBranch?.id || null,
  })

  // Validação em tempo real do documento (CPF / CNPJ)
  const documentValidation = useMemo(() => {
    const raw = form.document || ''
    const digits = onlyDigits(raw)
    const isIndividual = form.person_type === 'individual'
    const docName = isIndividual ? 'CPF' : 'CNPJ'
    const expectedLen = isIndividual ? 11 : 14

    if (!digits) {
      return {
        status: 'empty' as const,
        isValid: false,
        message: `${docName} obrigatório (apenas números válidos)`,
        cleanDigits: '',
      }
    }

    if (digits.length < expectedLen) {
      return {
        status: 'incomplete' as const,
        isValid: false,
        message: `${docName} incompleto (${digits.length}/${expectedLen} dígitos)`,
        cleanDigits: digits,
      }
    }

    const isValid = isIndividual ? validateCpf(digits) : validateCnpj(digits)

    if (isValid) {
      return {
        status: 'valid' as const,
        isValid: true,
        message: `${docName} válido e verificado`,
        cleanDigits: digits,
      }
    } else {
      return {
        status: 'invalid' as const,
        isValid: false,
        message: `${docName} INVÁLIDO! Dígitos verificadores incorretos`,
        cleanDigits: digits,
      }
    }
  }, [form.document, form.person_type])

  useEffect(() => {
    async function loadCustomer() {
      if (!isEditing || !id || !activeCompany?.id) return
      setIsLoading(true)
      try {
        const data = await customerService.getCustomer(id, activeCompany.id)
        if (data) {
          setForm({
            person_type: data.person_type,
            name: data.name,
            trade_name: data.trade_name || '',
            document:
              data.person_type === 'individual'
                ? maskCpf(data.document || '')
                : maskCnpj(data.document || ''),
            state_registration: data.state_registration || '',
            email: data.email || '',
            phone: maskPhone(data.phone || ''),
            whatsapp: maskPhone(data.whatsapp || ''),
            zip_code: maskCep(data.zip_code || ''),
            street: data.street || '',
            number: data.number || '',
            complement: data.complement || '',
            neighborhood: data.neighborhood || '',
            city: data.city || '',
            state: data.state || 'SP',
            credit_limit: data.credit_limit || 0,
            credit_status: data.credit_status || 'available',
            status: data.status || 'active',
            notes: data.notes || '',
            origin_branch_id: data.origin_branch_id,
          })

          // Carrega perfil financeiro em modo edição
          if (activeCompany?.id) {
            receivableService
              .getCustomerCreditProfile(activeCompany.id, id!)
              .then((prof) => setCreditProfile(prof))
              .catch((e) => console.warn('Aviso ao consultar perfil de crédito:', e))
          }
        }
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Erro ao carregar dados do cliente.')
      } finally {
        setIsLoading(false)
      }
    }

    loadCustomer()
  }, [isEditing, id, activeCompany])

  function handleDocumentChange(val: string) {
    if (error && error.includes('BLOQUEIO DE SEGURANÇA')) {
      setError(null)
    }
    if (form.person_type === 'individual') {
      setForm((p) => ({ ...p, document: maskCpf(val) }))
    } else {
      setForm((p) => ({ ...p, document: maskCnpj(val) }))
    }
  }

  async function handleCepLookup() {
    const digits = onlyDigits(form.zip_code)
    if (digits.length !== 8) {
      toast.error('Informe um CEP válido com 8 dígitos para consultar.')
      return
    }

    setIsFetchingCep(true)
    try {
      const res = await fetchCep(digits)
      if (res) {
        setForm((prev) => ({
          ...prev,
          street: res.street || prev.street,
          neighborhood: res.neighborhood || prev.neighborhood,
          city: res.city || prev.city,
          state: res.state || prev.state,
        }))
        toast.success('Endereço preenchido automaticamente pelo CEP!')
      } else {
        toast.error('CEP não localizado.')
      }
    } catch {
      toast.error('Falha na consulta de CEP.')
    } finally {
      setIsFetchingCep(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!activeCompany?.id) {
      setError('Empresa ativa não identificada.')
      return
    }

    if (!form.name.trim()) {
      setError('O nome completo ou razão social é obrigatório.')
      return
    }

    // Validação estrita e bloqueante de documento (CPF ou CNPJ)
    const docName = form.person_type === 'individual' ? 'CPF' : 'CNPJ'

    if (!documentValidation.isValid) {
      const errorMsg =
        documentValidation.status === 'invalid'
          ? `BLOQUEIO DE SEGURANÇA: O ${docName} informado (${form.document}) é INVÁLIDO. O sistema não salvará o cadastro com documento inválido.`
          : `BLOQUEIO DE SEGURANÇA: O preenchimento do ${docName} é obrigatório e precisa ser um documento válido com ${form.person_type === 'individual' ? '11' : '14'} dígitos.`

      setError(errorMsg)
      toast.error(errorMsg)
      setIsSaving(false)
      const inputEl = document.getElementById('customer-document-input')
      if (inputEl) {
        inputEl.focus()
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    // Validação de e-mail se informado
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('O formato do e-mail informado é inválido.')
      return
    }

    setIsSaving(true)
    try {
      if (isEditing && id) {
        await customerService.updateCustomer(id, activeCompany.id, form)
        toast.success('Cliente atualizado com sucesso!')
      } else {
        await customerService.createCustomer(activeCompany.id, form)
        toast.success('Cliente cadastrado com sucesso!')
      }
      navigate('/cadastros/clientes')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao salvar cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <LoadingState message="Carregando cadastro do cliente..." />
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/cadastros/clientes')}
            className="border-slate-800 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
            </h1>
            <p className="text-xs text-slate-400">
              {isEditing
                ? 'Atualize os dados cadastrais e condições comerciais'
                : 'Cadastre um novo cliente físico ou jurídico na empresa'}
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => navigate('/cadastros/clientes')}
          variant="outline"
          className="border-slate-800 text-slate-400 hover:text-white"
        >
          Cancelar
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300 shadow-lg shadow-rose-950/20">
          <ShieldAlert className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-rose-200">Atenção ao Salvar</p>
            <p className="text-xs text-rose-300/90">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seção 1: Identificação do Cliente */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <User className="h-4 w-4 text-blue-400" />
              <span>Identificação e Tipo de Pessoa</span>
            </div>

            {/* Alternador PF / PJ */}
            <div className="flex rounded-xl bg-slate-850 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    person_type: 'individual',
                    document: maskCpf(onlyDigits(p.document)),
                  }))
                }
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  form.person_type === 'individual'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pessoa Física (PF)
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    person_type: 'company',
                    document: maskCnpj(onlyDigits(p.document)),
                  }))
                }
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  form.person_type === 'company'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pessoa Jurídica (PJ)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                {form.person_type === 'individual' ? 'Nome Completo *' : 'Razão Social *'}
              </label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder={
                  form.person_type === 'individual' ? 'Ex: Carlos Eduardo da Silva' : 'Ex: Distribuidora Silva Ltda'
                }
                className="bg-slate-800/80 border-slate-700 text-white"
              />
            </div>

            {form.person_type === 'company' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Nome Fantasia
                </label>
                <Input
                  value={form.trade_name}
                  onChange={(e) => setForm((p) => ({ ...p, trade_name: e.target.value }))}
                  placeholder="Ex: Comercial Silva"
                  className="bg-slate-800/80 border-slate-700 text-white"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {form.person_type === 'individual' ? 'CPF *' : 'CNPJ *'}
                </label>
                {/* Indicador de status em tempo real */}
                {documentValidation.status === 'valid' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3" />
                    Válido
                  </span>
                )}
                {documentValidation.status === 'invalid' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-300 border border-rose-500/40 animate-pulse">
                    <XCircle className="h-3 w-3 text-rose-400" />
                    Inválido
                  </span>
                )}
                {documentValidation.status === 'incomplete' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 border border-amber-500/30">
                    Incompleto
                  </span>
                )}
              </div>

              <div className="relative">
                <Input
                  id="customer-document-input"
                  required
                  value={form.document}
                  onChange={(e) => handleDocumentChange(e.target.value)}
                  placeholder={
                    form.person_type === 'individual' ? '000.000.000-00' : '00.000.000/0000-00'
                  }
                  className={`font-mono text-white pr-10 transition-colors ${
                    documentValidation.status === 'valid'
                      ? 'bg-emerald-950/20 border-emerald-500 focus:border-emerald-400 focus:ring-emerald-500/20'
                      : documentValidation.status === 'invalid'
                      ? 'bg-rose-950/30 border-rose-500 focus:border-rose-500 focus:ring-rose-500/30 text-rose-100'
                      : documentValidation.status === 'incomplete'
                      ? 'bg-slate-800/80 border-amber-500/50 focus:border-amber-500 focus:ring-amber-500/20'
                      : 'bg-slate-800/80 border-slate-700'
                  }`}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  {documentValidation.status === 'valid' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                  {documentValidation.status === 'invalid' && (
                    <XCircle className="h-4 w-4 text-rose-400" />
                  )}
                </div>
              </div>

              {/* Mensagem e aviso contextual imediato */}
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium min-h-[1.25rem]">
                {documentValidation.status === 'valid' && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    {documentValidation.message}
                  </span>
                )}
                {documentValidation.status === 'invalid' && (
                  <span className="text-rose-400 flex items-center gap-1 font-semibold">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    {documentValidation.message}
                  </span>
                )}
                {documentValidation.status === 'incomplete' && (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {documentValidation.message}
                  </span>
                )}
                {documentValidation.status === 'empty' && (
                  <span className="text-slate-400">
                    Obrigatório. Digite apenas {form.person_type === 'individual' ? 'os 11 dígitos do CPF' : 'os 14 dígitos do CNPJ'}.
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                {form.person_type === 'individual' ? 'RG (Opcional)' : 'Inscrição Estadual'}
              </label>
              <Input
                value={form.state_registration}
                onChange={(e) => setForm((p) => ({ ...p, state_registration: e.target.value }))}
                placeholder="Ex: 12.345.678-9 ou ISENTO"
                className="bg-slate-800/80 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Status Cadastral
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as CustomerStatus }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Seção 2: Contato e Comunicação */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-slate-800 pb-3">
            <Phone className="h-4 w-4 text-emerald-400" />
            <span>Contato e Notificações</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Telefone Principal
              </label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: maskPhone(e.target.value) }))}
                placeholder="(00) 0000-0000"
                className="bg-slate-800/80 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                WhatsApp Comercial
              </label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm((p) => ({ ...p, whatsapp: maskPhone(e.target.value) }))}
                placeholder="(00) 90000-0000"
                className="bg-slate-800/80 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                E-mail para Faturamento
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="cliente@email.com.br"
                className="bg-slate-800/80 border-slate-700 text-white"
              />
            </div>
          </div>
        </div>

        {/* Seção 3: Endereço */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-slate-800 pb-3">
            <MapPin className="h-4 w-4 text-cyan-400" />
            <span>Endereço e Localização</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                CEP
              </label>
              <div className="flex gap-2">
                <Input
                  value={form.zip_code}
                  onChange={(e) => setForm((p) => ({ ...p, zip_code: maskCep(e.target.value) }))}
                  placeholder="00000-000"
                  className="bg-slate-800/80 border-slate-700 text-white font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCepLookup}
                  disabled={isFetchingCep}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  title="Buscar endereço por CEP"
                >
                  {isFetchingCep ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Logradouro (Rua, Av.)
              </label>
              <Input
                value={form.street}
                onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))}
                placeholder="Ex: Rua das Flores"
                className="bg-slate-800/80 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Número
              </label>
              <Input
                value={form.number}
                onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))}
                placeholder="Ex: 120"
                className="bg-slate-800/80 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Complemento (Apto, Sala)
              </label>
              <Input
                value={form.complement}
                onChange={(e) => setForm((p) => ({ ...p, complement: e.target.value }))}
                placeholder="Ex: Sala 4"
                className="bg-slate-800/80 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Bairro
              </label>
              <Input
                value={form.neighborhood}
                onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))}
                placeholder="Ex: Centro"
                className="bg-slate-800/80 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Cidade
              </label>
              <Input
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                placeholder="Ex: São Paulo"
                className="bg-slate-800/80 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Estado
              </label>
              <select
                value={form.state}
                onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {ESTADOS_BR.map((uf) => (
                  <option key={uf.uf} value={uf.uf}>
                    {uf.uf} — {uf.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Seção 4: Condições Comerciais e Limite de Crédito */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-slate-800 pb-3">
            <CreditCard className="h-4 w-4 text-amber-400" />
            <span>Condições Comerciais e Limite de Crédito</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Limite de Crédito Concedido (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                  R$
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.credit_limit}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, credit_limit: parseFloat(e.target.value) || 0 }))
                  }
                  className="pl-9 bg-slate-800/80 border-slate-700 text-white font-bold"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Situação do Crédito
              </label>
              <select
                value={form.credit_status}
                onChange={(e) =>
                  setForm((p) => ({ ...p, credit_status: e.target.value as CreditStatus }))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="available">Liberado / Disponível</option>
                <option value="under_review">Em Análise / Avaliação</option>
                <option value="blocked">Bloqueado para Vendas</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Filial de Atendimento Principal
              </label>
              <select
                value={form.origin_branch_id || ''}
                onChange={(e) => setForm((p) => ({ ...p, origin_branch_id: e.target.value || null }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todas as Filiais (Compartilhado)</option>
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Painel Financeiro e Situação no Crediário */}
          {isEditing && creditProfile && (
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" />
                  Situação Financeira e Limite de Crédito
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/financeiro/contas-receber`)}
                  className="text-xs text-blue-400 hover:text-blue-300 h-7 px-2"
                >
                  Ver Títulos a Receber &rarr;
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Limite Total</span>
                  <span className="font-mono text-sm font-bold text-white">
                    R$ {creditProfile.credit_limit.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Utilizado</span>
                  <span className="font-mono text-sm font-bold text-amber-400">
                    R$ {creditProfile.used_credit.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Limite Disponível</span>
                  <span className="font-mono text-sm font-black text-emerald-400">
                    R$ {creditProfile.available_credit.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Vencidos em Atraso</span>
                  <span className={`font-mono text-sm font-black ${creditProfile.has_overdue ? 'text-rose-400' : 'text-slate-300'}`}>
                    R$ {creditProfile.overdue_amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {creditProfile.has_overdue && (
                <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>
                    Atenção: Este cliente possui <strong>{creditProfile.overdue_count}</strong> parcela(s) vencida(s) totalizando <strong>R$ {creditProfile.overdue_amount.toFixed(2)}</strong> em atraso.
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Observações Gerais (Restrições, Preferências de Entrega, etc.)
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Anotações comerciais, instruções de entrega, referências bancárias..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Botão de Envio com indicador de bloqueio */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div>
            {documentValidation.status === 'invalid' ? (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
                <span>
                  Bloqueio ativo: O {form.person_type === 'individual' ? 'CPF' : 'CNPJ'} é inválido. O sistema não salvará até que seja corrigido.
                </span>
              </div>
            ) : documentValidation.status === 'incomplete' ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  Preencha o {form.person_type === 'individual' ? 'CPF' : 'CNPJ'} completo ({form.person_type === 'individual' ? '11' : '14'} dígitos) para salvar.
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/cadastros/clientes')}
              disabled={isSaving}
              className="border-slate-800 text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className={`gap-2 font-medium transition ${
                documentValidation.status === 'invalid'
                  ? 'bg-rose-600/90 hover:bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
              title={
                documentValidation.status === 'invalid'
                  ? 'Não é permitido salvar com documento inválido'
                  : 'Salvar Cadastro do Cliente'
              }
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : documentValidation.status === 'invalid' ? (
                <>
                  <ShieldAlert className="h-4 w-4" />
                  Salvar Bloqueado (Documento Inválido)
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar Cadastro
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
