import { useState, useEffect } from 'react'
import {
  X,
  Loader2,
  Plus,
  Truck,
  Layers,
  Building2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'
import { payableService } from '@/lib/services/payable.service'
import { supplierService } from '@/lib/services/supplier.service'
import type { FinancialCategory } from '@/types/payable'
import type { Supplier } from '@/types/supplier'

interface CreatePayableModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  branchId: string
  onSuccess: () => void
}

export function CreatePayableModal({
  isOpen,
  onClose,
  companyId,
  branchId,
  onSuccess,
}: CreatePayableModalProps) {
  const { companies, activeBranch } = useAuth()
  const currentCompanyData = companies.find((c) => c.company.id === companyId)
  const availableBranches = currentCompanyData?.branches || []
  const [selectedBranchId, setSelectedBranchId] = useState(branchId || activeBranch?.id || '')

  const [description, setDescription] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [originalAmountStr, setOriginalAmountStr] = useState('')
  const [discountStr, setDiscountStr] = useState('0.00')
  const [interestStr, setInterestStr] = useState('0.00')
  const [fineStr, setFineStr] = useState('0.00')
  const [installmentsCount, setInstallmentsCount] = useState(1)
  const [intervalDays, setIntervalDays] = useState(30)
  const [notes, setNotes] = useState('')

  // Listas
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<FinancialCategory[]>([])
  const [isLoadingLists, setIsLoadingLists] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Criar categoria rápida
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  useEffect(() => {
    if (isOpen && companyId) {
      setDescription('')
      setSupplierId('')
      setDocumentNumber('')
      const today = new Date().toISOString().split('T')[0]
      setIssueDate(today)

      const defDue = new Date()
      defDue.setDate(defDue.getDate() + 30)
      setDueDate(defDue.toISOString().split('T')[0])

      setOriginalAmountStr('')
      setDiscountStr('0.00')
      setInterestStr('0.00')
      setFineStr('0.00')
      setInstallmentsCount(1)
      setIntervalDays(30)
      setNotes('')
      setIsAddingCategory(false)
      setNewCatName('')

      setSelectedBranchId(branchId || activeBranch?.id || availableBranches[0]?.id || '')
      setIsLoadingLists(true)
      Promise.all([
        supplierService.listSuppliers(companyId, { status: 'active' }),
        payableService.listCategories(companyId),
      ])
        .then(([supList, catList]) => {
          setSuppliers(supList)
          setCategories(catList)
          if (catList.length > 0) {
            setCategoryId(catList[0].id)
          }
        })
        .catch((err) => console.warn('Aviso ao carregar dados:', err))
        .finally(() => setIsLoadingLists(false))
    }
  }, [isOpen, companyId, branchId, activeBranch?.id])

  if (!isOpen) return null

  const origAmount = parseFloat(originalAmountStr) || 0
  const discAmount = parseFloat(discountStr) || 0
  const intAmount = parseFloat(interestStr) || 0
  const fineAmount = parseFloat(fineStr) || 0
  const netTotal = Math.max(0, Math.round((origAmount - discAmount + intAmount + fineAmount) * 100) / 100)

  // Pré-visualização da divisão em centavos
  const previewInstallments = (() => {
    if (netTotal <= 0 || installmentsCount <= 0 || !dueDate) return []
    const totalCents = Math.round(netTotal * 100)
    const count = Math.max(1, installmentsCount)
    const baseCents = Math.floor(totalCents / count)
    const remainderCents = totalCents - baseCents * count

    const baseDate = new Date(dueDate + 'T00:00:00')
    const list = []

    for (let i = 1; i <= count; i++) {
      const cents = i === 1 ? baseCents + remainderCents : baseCents
      const dt = new Date(baseDate)
      if (i > 1) {
        dt.setDate(dt.getDate() + (i - 1) * intervalDays)
      }
      list.push({
        num: i,
        date: dt.toLocaleDateString('pt-BR'),
        amount: cents / 100,
      })
    }
    return list
  })()

  async function handleAddQuickCategory() {
    if (!newCatName.trim()) return
    try {
      const created = await payableService.createCategory(companyId, newCatName.trim())
      setCategories((prev) => [...prev, created])
      setCategoryId(created.id)
      setNewCatName('')
      setIsAddingCategory(false)
      toast.success(`Categoria "${created.name}" adicionada!`)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar categoria.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!description.trim()) {
      toast.error('Informe a descrição da despesa.')
      return
    }

    if (origAmount <= 0) {
      toast.error('Informe um valor original maior que zero.')
      return
    }

    if (!dueDate) {
      toast.error('Informe a data de vencimento.')
      return
    }

    setIsSubmitting(true)
    try {
      await payableService.createPayable({
        company_id: companyId,
        branch_id: selectedBranchId || branchId || activeBranch?.id || '',
        supplier_id: supplierId || null,
        category_id: categoryId || null,
        document_number: documentNumber.trim() || undefined,
        description: description.trim(),
        issue_date: issueDate,
        due_date: dueDate,
        original_amount: origAmount,
        discount_amount: discAmount,
        interest_amount: intAmount,
        fine_amount: fineAmount,
        installments_count: installmentsCount,
        interval_days: intervalDays,
        notes: notes.trim() || undefined,
      })

      toast.success(
        `Conta a pagar registrada com sucesso no banco de dados! ${
          installmentsCount > 1 ? `(${installmentsCount} parcelas geradas)` : ''
        }`
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar conta a pagar.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Gestão Financeira
              </span>
              <h2 className="text-base font-bold text-white">Nova Conta a Pagar</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Seletor de Filial (quando houver mais de uma) */}
          {availableBranches.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-400" /> Filial Destino *
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none h-10"
              >
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.branch_type === 'matriz' ? 'Matriz' : 'Filial'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              Descrição da Despesa / Obrigação *
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Aluguel do galpão, Conta de energia elétrica, Fornecedor de tintas..."
              required
              className="bg-slate-800 border-slate-700 text-white text-sm h-11"
              autoFocus
            />
          </div>

          {/* Fornecedor e Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-slate-400" /> Fornecedor / Favorecido
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                disabled={isLoadingLists}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none h-10"
              >
                <option value="">Nenhum (Despesa Avulsa / Geral)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.document ? `(${s.document})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-slate-400" /> Categoria Financeira
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory((v) => !v)}
                  className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition"
                >
                  {isAddingCategory ? 'Cancelar' : '+ Nova Categoria'}
                </button>
              </div>

              {isAddingCategory ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nome da categoria..."
                    className="bg-slate-800 border-slate-700 text-white text-xs h-10"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddQuickCategory}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-10 px-3"
                  >
                    Salvar
                  </Button>
                </div>
              ) : (
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={isLoadingLists}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none h-10"
                >
                  <option value="">Selecione uma categoria...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Documento, Emissão e Vencimento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Nº Documento / Nota
              </label>
              <Input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Ex: NF 14205, BOL-990"
                className="bg-slate-800 border-slate-700 text-white text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Data de Emissão
              </label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                1º Vencimento *
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="bg-slate-800 border-slate-700 text-white text-xs h-10 font-bold focus:border-rose-500"
              />
            </div>
          </div>

          {/* Valores: Original, Desconto, Juros/Multa e Total */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Valor Original (R$) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={originalAmountStr}
                  onChange={(e) => setOriginalAmountStr(e.target.value)}
                  placeholder="0,00"
                  required
                  className="bg-slate-800 border-slate-700 text-white font-mono font-bold text-sm h-10"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Desconto (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountStr}
                  onChange={(e) => setDiscountStr(e.target.value)}
                  placeholder="0,00"
                  className="bg-slate-800 border-slate-700 text-emerald-400 font-mono text-xs h-10"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Juros (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={interestStr}
                  onChange={(e) => setInterestStr(e.target.value)}
                  placeholder="0,00"
                  className="bg-slate-800 border-slate-700 text-amber-400 font-mono text-xs h-10"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Multa (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fineStr}
                  onChange={(e) => setFineStr(e.target.value)}
                  placeholder="0,00"
                  className="bg-slate-800 border-slate-700 text-rose-400 font-mono text-xs h-10"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-400">
                Valor Total Devido:
              </span>
              <span className="font-mono text-lg font-black text-rose-400">
                R$ {netTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Parcelamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Quantidade de Parcelas
              </label>
              <select
                value={installmentsCount}
                onChange={(e) => setInstallmentsCount(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none h-10 font-bold"
              >
                <option value={1}>1x (Pagamento Único)</option>
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36].map((n) => (
                  <option key={n} value={n}>
                    {n}x parcelas
                  </option>
                ))}
              </select>
            </div>

            {installmentsCount > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Intervalo entre Parcelas (Dias)
                </label>
                <select
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none h-10 font-bold"
                >
                  <option value={15}>A cada 15 dias (Quinzenal)</option>
                  <option value={30}>A cada 30 dias (Mensal)</option>
                  <option value={60}>A cada 60 dias (Bimestral)</option>
                </select>
              </div>
            )}
          </div>

          {/* Pré-visualização do Cronograma de Parcelas */}
          {installmentsCount > 1 && previewInstallments.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Cronograma Previsto ({installmentsCount} parcelas somando exatos R$ {netTotal.toFixed(2)})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                {previewInstallments.map((p) => (
                  <div
                    key={p.num}
                    className="p-2 rounded-xl bg-slate-850 border border-slate-800 text-[11px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-300">
                      <span>Parc. {p.num}</span>
                      <span className="text-rose-400 font-mono">R$ {p.amount.toFixed(2)}</span>
                    </div>
                    <span className="text-slate-400 text-[10px] block">{p.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              Observações Adicionais
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Contrato assinado, autorização do setor financeiro..."
              className="bg-slate-800 border-slate-700 text-white text-xs"
            />
          </div>

          {/* Rodapé com Botões */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || origAmount <= 0 || !dueDate}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-blue-900/30"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                </span>
              ) : (
                `Cadastrar Conta (R$ ${netTotal.toFixed(2)})`
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
