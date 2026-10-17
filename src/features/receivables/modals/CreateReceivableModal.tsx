import { useState, useEffect, useMemo } from 'react'
import {
  X,
  Loader2,
  Plus,
  User,
  Search,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'
import { receivableService } from '@/lib/services/receivable.service'
import { customerService } from '@/lib/services/customer.service'
import { supabase } from '@/lib/supabase'
import type { Customer } from '@/types/customer'

interface CreateReceivableModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  branchId: string
  onSuccess: () => void
}

export function CreateReceivableModal({
  isOpen,
  onClose,
  companyId,
  branchId,
  onSuccess,
}: CreateReceivableModalProps) {
  const { activeCompany, companies, activeBranch } = useAuth()
  const effectiveCompanyId = companyId || activeCompany?.id || ''
  const currentCompanyData = companies.find((c) => c.company.id === effectiveCompanyId)
  const availableBranches = currentCompanyData?.branches || []
  const [selectedBranchId, setSelectedBranchId] = useState(branchId || activeBranch?.id || '')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)

  const [description, setDescription] = useState('')
  const [totalAmountStr, setTotalAmountStr] = useState('')
  const [downPaymentStr, setDownPaymentStr] = useState('0')
  const [installmentsCount, setInstallmentsCount] = useState<number>(1)
  const [firstDueDate, setFirstDueDate] = useState('')
  const [intervalDays, setIntervalDays] = useState<number>(30)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Carrega clientes com fallback robusto
  useEffect(() => {
    async function loadCustomers() {
      if (!isOpen || !effectiveCompanyId) return
      setIsLoadingCustomers(true)

      try {
        let list: Customer[] = []
        try {
          const res = await customerService.listCustomers(effectiveCompanyId, { pageSize: 300 })
          list = res.data || []
        } catch (err) {
          console.warn('Erro ao chamar customerService.listCustomers, tentando consulta direta:', err)
        }

        // Se a lista veio vazia ou falhou, tenta select direto na tabela customers
        if (list.length === 0 && supabase) {
          const { data: directData, error: dirErr } = await supabase
            .from('customers')
            .select('*')
            .eq('company_id', effectiveCompanyId)
            .order('name', { ascending: true })

          if (!dirErr && directData && directData.length > 0) {
            list = directData as Customer[]
          }
        }

        setCustomers(list)
      } catch (err) {
        console.error('Falha geral ao carregar clientes:', err)
      } finally {
        setIsLoadingCustomers(false)
      }
    }

    if (isOpen) {
      setSelectedBranchId(branchId || activeBranch?.id || availableBranches[0]?.id || '')
      loadCustomers()
      setSelectedCustomerId('')
      setCustomerSearchQuery('')
      setDescription('')
      setTotalAmountStr('')
      setDownPaymentStr('0')
      setInstallmentsCount(1)
      setIntervalDays(30)
      setNotes('')

      const defaultDue = new Date()
      defaultDue.setDate(defaultDue.getDate() + 30)
      setFirstDueDate(defaultDue.toISOString().split('T')[0])
    }
  }, [isOpen, effectiveCompanyId, branchId, activeBranch?.id])

  // Cliente selecionado no momento
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null
  }, [customers, selectedCustomerId])

  // Clientes filtrados pela busca
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers
    const q = customerSearchQuery.toLowerCase().trim()
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.trade_name && c.trade_name.toLowerCase().includes(q)) ||
        (c.document && c.document.includes(q)) ||
        (c.phone && c.phone.includes(q))
    )
  }, [customers, customerSearchQuery])

  if (!isOpen) return null

  const numTotal = parseFloat(totalAmountStr) || 0
  const numDown = parseFloat(downPaymentStr) || 0
  const financed = Math.max(0, Math.round((numTotal - numDown) * 100) / 100)
  const count = Math.max(1, installmentsCount)
  const approxPerInst = financed > 0 ? financed / count : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedCustomerId) {
      toast.error('Selecione um cliente para vincular ao título.')
      return
    }

    if (numTotal <= 0) {
      toast.error('Informe um valor total maior que zero.')
      return
    }

    if (numDown >= numTotal) {
      toast.error('O valor de entrada não pode ser igual ou maior que o valor total.')
      return
    }

    if (!firstDueDate) {
      toast.error('Informe a data do primeiro vencimento.')
      return
    }

    setIsSubmitting(true)
    try {
      await receivableService.createManualReceivable({
        company_id: effectiveCompanyId,
        branch_id: selectedBranchId || branchId || activeBranch?.id || '',
        customer_id: selectedCustomerId,
        description: description.trim() || 'Título a Receber Avulso',
        total_amount: numTotal,
        down_payment: numDown,
        installments_count: count,
        first_due_date: firstDueDate,
        interval_days: intervalDays,
        notes: notes.trim() || undefined,
      })

      toast.success('Conta a receber e parcelas cadastradas com sucesso no banco de dados!')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Erro ao criar conta a receber:', err)
      toast.error(err.message || 'Falha ao criar conta a receber.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-150">
        <form onSubmit={handleSubmit}>
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Lançamento Financeiro
                </span>
                <h2 className="text-base font-bold text-white">Nova Conta a Receber</h2>
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

          {/* Campos */}
          <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
            {/* Seletor de Filial (quando houver mais de uma) */}
            {availableBranches.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Filial Destino *
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

            {/* ─── SELEÇÃO DO CLIENTE ─── */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>Cliente Cadastrado *</span>
                {isLoadingCustomers && (
                  <span className="text-[11px] font-normal text-blue-400 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Carregando base de clientes...
                  </span>
                )}
              </label>

              {/* Se o cliente já foi selecionado, exibe card com dados e botão de alterar */}
              {selectedCustomer ? (
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-blue-500/30 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-400 shrink-0" />
                      <span className="font-bold text-white text-sm">{selectedCustomer.name}</span>
                      {selectedCustomer.trade_name && (
                        <span className="text-xs text-slate-400">({selectedCustomer.trade_name})</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                      <span>{selectedCustomer.document || 'Sem documento'}</span>
                      <span>&bull;</span>
                      <span className="text-emerald-400 font-semibold">
                        Limite: R$ {Number(selectedCustomer.credit_limit || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCustomerId('')}
                    className="text-xs text-blue-400 hover:text-blue-300 h-8 px-2.5 rounded-xl border border-blue-500/20 bg-blue-500/10"
                  >
                    Alterar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Busca textual de clientes */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      placeholder="Pesquise por nome, CPF/CNPJ ou telefone..."
                      className="pl-9 bg-slate-800 border-slate-700 text-white text-xs h-10"
                      autoFocus
                    />
                  </div>

                  {/* Lista de clientes pesquisáveis */}
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded-2xl border border-slate-800 bg-slate-950/70 p-1.5">
                    {isLoadingCustomers ? (
                      <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                        Buscando clientes cadastrados...
                      </div>
                    ) : filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 space-y-2">
                        <AlertCircle className="h-5 w-5 mx-auto text-amber-400" />
                        <div>
                          {customerSearchQuery
                            ? `Nenhum cliente encontrado para "${customerSearchQuery}".`
                            : 'Nenhum cliente cadastrado ainda no sistema.'}
                        </div>
                      </div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(c.id)
                            setCustomerSearchQuery('')
                          }}
                          className="w-full text-left p-2.5 rounded-xl border border-slate-800/60 bg-slate-900/60 hover:bg-slate-800 hover:border-blue-500/40 text-xs text-white transition flex items-center justify-between group"
                        >
                          <div className="space-y-0.5 min-w-0 pr-2">
                            <div className="font-bold truncate text-slate-200 group-hover:text-white">
                              {c.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">
                              {c.document || 'Sem CPF/CNPJ'} &bull; Tel: {c.phone || c.whatsapp || '-'}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Limite
                            </span>
                            <span className="font-mono text-emerald-400 font-bold text-xs">
                              R$ {Number(c.credit_limit || 0).toFixed(2)}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Descrição do Título
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Prestação de serviço, venda sob medida, crediário avulso..."
                className="bg-slate-800 border-slate-700 text-white text-xs h-10"
              />
            </div>

            {/* Valores */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Valor Total (R$) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={totalAmountStr}
                  onChange={(e) => setTotalAmountStr(e.target.value)}
                  placeholder="0,00"
                  required
                  className="bg-slate-800 border-slate-700 text-white text-sm font-mono font-bold h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Valor de Entrada (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={downPaymentStr}
                  onChange={(e) => setDownPaymentStr(e.target.value)}
                  placeholder="0,00"
                  className="bg-slate-800 border-slate-700 text-emerald-400 text-sm font-mono font-bold h-10"
                />
              </div>
            </div>

            {/* Resumo do Financiamento */}
            {numTotal > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total a Prazo (Financiado):</span>
                  <span className="font-bold text-amber-400 font-mono text-sm">
                    R$ {financed.toFixed(2)}
                  </span>
                </div>
                {count > 1 && (
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Distribuição Prevista:</span>
                    <span className="font-mono">
                      {count}x de aprox. R$ {approxPerInst.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Parcelas e Vencimento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Qtd. de Parcelas
                </label>
                <select
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none h-10 font-bold"
                >
                  <option value={1}>1x (Única)</option>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={n}>
                      {n}x parcelas
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  1º Vencimento *
                </label>
                <Input
                  type="date"
                  value={firstDueDate}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-white text-xs h-10 font-bold focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Intervalo (Dias)
                </label>
                <select
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none h-10 font-bold"
                >
                  <option value={15}>15 dias</option>
                  <option value={30}>30 dias</option>
                  <option value={60}>60 dias</option>
                </select>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Observações
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Título emitido sob termo de confissão de dívida..."
                className="bg-slate-800 border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          {/* Rodapé com Botões */}
          <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-850/80">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-white text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedCustomerId || numTotal <= 0 || !firstDueDate}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-blue-900/30"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando Título...
                </span>
              ) : (
                `Confirmar e Gerar Parcelas`
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
