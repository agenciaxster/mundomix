import { useState, useEffect } from 'react'
import {
  X,
  Truck,
  Save,
  Loader2,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supplierService } from '@/lib/services/supplier.service'
import type { Supplier, PersonType, SupplierStatus } from '@/types/supplier'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { maskCpf, maskCnpj, maskPhone, maskCep } from '@/lib/utils/masks'
import { toast } from '@/hooks/useToast'

interface SupplierFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (savedSupplier?: Supplier) => void
  supplierToEdit?: Supplier | null
}

export function SupplierFormModal({
  isOpen,
  onClose,
  onSuccess,
  supplierToEdit,
}: SupplierFormModalProps) {
  const { activeCompany } = useAuth()

  const [personType, setPersonType] = useState<PersonType>('PJ')
  const [name, setName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [document, setDocument] = useState('')
  const [stateRegistration, setStateRegistration] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [contactName, setContactName] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<SupplierStatus>('active')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isEditing = Boolean(supplierToEdit)

  useEffect(() => {
    if (supplierToEdit) {
      setPersonType(supplierToEdit.person_type || 'PJ')
      setName(supplierToEdit.name || '')
      setTradeName(supplierToEdit.trade_name || '')
      setDocument(supplierToEdit.document || '')
      setStateRegistration(supplierToEdit.state_registration || '')
      setEmail(supplierToEdit.email || '')
      setPhone(supplierToEdit.phone || '')
      setContactName(supplierToEdit.contact_name || '')
      setZipCode(supplierToEdit.zip_code || '')
      setStreet(supplierToEdit.street || '')
      setNumber(supplierToEdit.number || '')
      setComplement(supplierToEdit.complement || '')
      setNeighborhood(supplierToEdit.neighborhood || '')
      setCity(supplierToEdit.city || '')
      setState(supplierToEdit.state || '')
      setNotes(supplierToEdit.notes || '')
      setStatus(supplierToEdit.status || 'active')
    } else {
      setPersonType('PJ')
      setName('')
      setTradeName('')
      setDocument('')
      setStateRegistration('')
      setEmail('')
      setPhone('')
      setContactName('')
      setZipCode('')
      setStreet('')
      setNumber('')
      setComplement('')
      setNeighborhood('')
      setCity('')
      setState('')
      setNotes('')
      setStatus('active')
    }
    setErrorMessage(null)
  }, [supplierToEdit, isOpen])

  if (!isOpen) return null

  function handleDocumentChange(val: string) {
    const masked = personType === 'PJ' ? maskCnpj(val) : maskCpf(val)
    setDocument(masked)
  }

  function handlePhoneChange(val: string) {
    setPhone(maskPhone(val))
  }

  function handleZipCodeChange(val: string) {
    setZipCode(maskCep(val))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeCompany?.id) {
      toast.error('Empresa não selecionada.')
      return
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMessage('Informe a Razão Social ou Nome do Fornecedor.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const payload = {
        name: trimmedName,
        trade_name: tradeName.trim() || null,
        person_type: personType,
        document: document.trim() || null,
        state_registration: stateRegistration.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        contact_name: contactName.trim() || null,
        zip_code: zipCode.trim() || null,
        street: street.trim() || null,
        number: number.trim() || null,
        complement: complement.trim() || null,
        neighborhood: neighborhood.trim() || null,
        city: city.trim() || null,
        state: state.trim().toUpperCase() || null,
        notes: notes.trim() || null,
        status,
      }

      let saved: Supplier
      if (isEditing && supplierToEdit) {
        saved = await supplierService.updateSupplier(activeCompany.id, supplierToEdit.id, payload)
        toast.success(`Fornecedor "${trimmedName}" atualizado com sucesso!`)
      } else {
        saved = await supplierService.createSupplier(activeCompany.id, payload)
        toast.success(`Fornecedor "${trimmedName}" cadastrado com sucesso!`)
      }

      onSuccess(saved)
      onClose()
    } catch (err: any) {
      console.error('Erro ao salvar fornecedor:', err)
      setErrorMessage(err.message || 'Erro ao salvar fornecedor.')
      toast.error(err.message || 'Erro ao salvar fornecedor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h2>
              <p className="text-xs text-slate-400">
                Cadastro de parceiros comerciais, distribuidores e fabricantes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Tipo de Pessoa e Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Tipo:
              </span>
              <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setPersonType('PJ')
                    setDocument('')
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                    personType === 'PJ' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Pessoa Jurídica (PJ)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPersonType('PF')
                    setDocument('')
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                    personType === 'PF' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Pessoa Física (PF)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Status:
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SupplierStatus)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>

          {/* Dados Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {personType === 'PJ' ? 'Razão Social' : 'Nome Completo'}{' '}
                <span className="text-rose-400">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (errorMessage) setErrorMessage(null)
                }}
                placeholder={
                  personType === 'PJ' ? 'Ex: Distribuidora Brasil Ltda' : 'Ex: Carlos Eduardo Silva'
                }
                required
                className="bg-slate-800/80 border-slate-700 text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nome Fantasia (Opcional)
              </label>
              <Input
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Ex: Comercial Mix"
                className="bg-slate-800/80 border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          {/* Documentos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {personType === 'PJ' ? 'CNPJ' : 'CPF'}
              </label>
              <Input
                value={document}
                onChange={(e) => handleDocumentChange(e.target.value)}
                placeholder={personType === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                className="bg-slate-800/80 border-slate-700 text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Inscrição Estadual (Opcional)
              </label>
              <Input
                value={stateRegistration}
                onChange={(e) => setStateRegistration(e.target.value)}
                placeholder="Ex: 123.456.789.000 ou ISENTO"
                className="bg-slate-800/80 border-slate-700 text-white font-mono text-xs"
              />
            </div>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                <Mail className="h-3 w-3 text-blue-400" />
                E-mail
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pedidos@fornecedor.com"
                className="bg-slate-800/80 border-slate-700 text-white text-xs"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                <Phone className="h-3 w-3 text-emerald-400" />
                Telefone / WhatsApp
              </label>
              <Input
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(00) 00000-0000"
                className="bg-slate-800/80 border-slate-700 text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                <User className="h-3 w-3 text-purple-400" />
                Representante / Contato
              </label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ex: Roberto (Vendedor)"
                className="bg-slate-800/80 border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <MapPin className="h-3.5 w-3.5 text-emerald-400" />
              Endereço / Localização
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">CEP</label>
                <Input
                  value={zipCode}
                  onChange={(e) => handleZipCodeChange(e.target.value)}
                  placeholder="00000-000"
                  className="bg-slate-800 border-slate-700 text-white text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">Logradouro / Rua</label>
                <Input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Av. das Indústrias"
                  className="bg-slate-800 border-slate-700 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Número</label>
                <Input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="1000"
                  className="bg-slate-800 border-slate-700 text-white text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Bairro</label>
                <Input
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Distrito Industrial"
                  className="bg-slate-800 border-slate-700 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Cidade</label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="São Paulo"
                  className="bg-slate-800 border-slate-700 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">UF (Estado)</label>
                <Input
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="SP"
                  className="bg-slate-800 border-slate-700 text-white text-xs uppercase font-mono"
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              <FileText className="h-3 w-3 text-slate-400" />
              Observações Comerciais (Prazos, frete, pedido mínimo...)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Faturamento 28 dias, pedido mínimo R$ 1.500, frete CIF..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-2.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs gap-1.5 shadow-lg shadow-emerald-600/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEditing ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
