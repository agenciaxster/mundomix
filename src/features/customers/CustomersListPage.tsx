import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  CreditCard,
  CheckCircle2,
  XCircle,
  Pencil,
  Power,
  PowerOff,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { customerService } from '@/lib/services/customer.service'
import type { Customer, CustomerKpis, PersonType, CustomerStatus, CreditStatus } from '@/types/customer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import { CreditLimitModal } from './modals/CreditLimitModal'
import { maskCpf, maskCnpj, maskPhone } from '@/lib/utils/masks'
import { toast } from '@/hooks/useToast'

export function CustomersListPage() {
  const navigate = useNavigate()
  const { activeCompany, hasPermission, activeRole } = useAuth()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [kpis, setKpis] = useState<CustomerKpis>({
    totalCustomers: 0,
    activeCustomers: 0,
    withCreditLimitCount: 0,
    totalCreditGranted: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState('')
  const [personTypeFilter, setPersonTypeFilter] = useState<'all' | PersonType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | CustomerStatus>('all')
  const [creditStatusFilter, setCreditStatusFilter] = useState<'all' | CreditStatus>('all')
  const [page, setPage] = useState(1)
  const pageSize = 15

  // Modais
  const [selectedCustomerForCredit, setSelectedCustomerForCredit] = useState<Customer | null>(null)
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false)

  const canCreate =
    activeRole === 'owner' ||
    activeRole === 'admin' ||
    hasPermission('sales', 'create')

  const loadData = useCallback(
    async (refresh = false) => {
      if (!activeCompany?.id) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const [result, kpiData] = await Promise.all([
          customerService.listCustomers(activeCompany.id, {
            search: searchTerm,
            personType: personTypeFilter,
            status: statusFilter,
            creditStatus: creditStatusFilter,
            page,
            pageSize,
          }),
          customerService.getCustomerKpis(activeCompany.id),
        ])

        setCustomers(result.data)
        setTotalCount(result.totalCount)
        setKpis(kpiData)
      } catch (err) {
        console.error('Erro ao carregar clientes:', err)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [activeCompany, searchTerm, personTypeFilter, statusFilter, creditStatusFilter, page]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleToggleStatus(customer: Customer) {
    if (!activeCompany?.id) return
    const newStatus = customer.status === 'active' ? 'inactive' : 'active'
    try {
      await customerService.setCustomerStatus(customer.id, activeCompany.id, newStatus)
      toast.success(
        `Cliente "${customer.name}" ${newStatus === 'active' ? 'ativado' : 'inativado'} com sucesso!`
      )
      loadData(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao alterar status do cliente.')
    }
  }

  function handleOpenCreditModal(customer: Customer) {
    setSelectedCustomerForCredit(customer)
    setIsCreditModalOpen(true)
  }

  function renderCreditStatusBadge(status: CreditStatus) {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
            Liberado
          </span>
        )
      case 'under_review':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
            Em Análise
          </span>
        )
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-500/20">
            Bloqueado
          </span>
        )
      default:
        return null
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Clientes e Limites de Crédito
            </h1>
            {activeCompany && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                <Building2 className="h-3.5 w-3.5" />
                {activeCompany.trade_name || activeCompany.legal_name}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Base unificada de pessoas físicas e jurídicas com políticas e histórico auditável de crédito
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            title="Atualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          {canCreate && (
            <Button
              size="sm"
              onClick={() => navigate('/cadastros/clientes/novo')}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-2 font-medium"
            >
              <UserPlus className="h-4 w-4" />
              Novo Cliente
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Clientes */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total de Clientes
            </span>
            <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{kpis.totalCustomers}</span>
            <span className="text-xs text-slate-400">registrados</span>
          </div>
          <div className="mt-2 text-xs text-blue-400/90 font-medium">Base de clientes ativa no grupo</div>
        </div>

        {/* Clientes Ativos */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Clientes Ativos
            </span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">
              {kpis.activeCustomers}
            </span>
            <span className="text-xs text-slate-400">aptos para compra</span>
          </div>
          <div className="mt-2 text-xs text-emerald-400/90 font-medium">
            {kpis.totalCustomers > 0
              ? `${Math.round((kpis.activeCustomers / kpis.totalCustomers) * 100)}% da base ativa`
              : 'Nenhum registro'}
          </div>
        </div>

        {/* Clientes com Limite de Crédito */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Com Limite de Crédito
            </span>
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400 border border-amber-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {kpis.withCreditLimitCount}
            </span>
            <span className="text-xs text-slate-400">clientes com limite</span>
          </div>
          <div className="mt-2 text-xs text-amber-400/90 font-medium">Habilitados para venda a prazo</div>
        </div>

        {/* Limite Total Concedido */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Crédito Total Concedido
            </span>
            <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-400 border border-cyan-500/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-cyan-400">
              R$ {kpis.totalCreditGranted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 font-medium">
            Exposição máxima autorizada
          </div>
        </div>
      </div>

      {/* Painel de Filtros e Busca */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        {/* Busca por texto */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pesquisa
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              type="text"
              placeholder="Nome, CPF/CNPJ, fone..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="pl-9 bg-slate-800/80 border-slate-700 text-white text-sm placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Tipo de Pessoa */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tipo de Pessoa
          </label>
          <select
            value={personTypeFilter}
            onChange={(e) => {
              setPersonTypeFilter(e.target.value as any)
              setPage(1)
            }}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Todos os Tipos</option>
            <option value="individual">Pessoa Física (PF)</option>
            <option value="company">Pessoa Jurídica (PJ)</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Status Cadastral
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any)
              setPage(1)
            }}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Somente Ativos</option>
            <option value="inactive">Somente Inativos</option>
          </select>
        </div>

        {/* Situação do Crédito */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Situação do Crédito
          </label>
          <select
            value={creditStatusFilter}
            onChange={(e) => {
              setCreditStatusFilter(e.target.value as any)
              setPage(1)
            }}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Todas as Situações</option>
            <option value="available">Crédito Liberado</option>
            <option value="under_review">Em Análise</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12">
            <LoadingState message="Carregando base de clientes..." />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="mx-auto h-12 w-12 text-slate-600" />
            <h3 className="mt-3 text-lg font-semibold text-white">Nenhum cliente encontrado</h3>
            <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
              {searchTerm || personTypeFilter !== 'all' || statusFilter !== 'all'
                ? 'Nenhum registro corresponde aos filtros selecionados.'
                : 'Sua empresa ainda não possui clientes cadastrados. Adicione o primeiro cliente para iniciar.'}
            </p>
            {canCreate && (
              <Button
                onClick={() => navigate('/cadastros/clientes/novo')}
                className="mt-4 bg-blue-600 hover:bg-blue-500 text-white gap-2 font-medium"
              >
                <UserPlus className="h-4 w-4" />
                Cadastrar Primeiro Cliente
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-850 text-xs font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Nome / Documento</th>
                  <th className="p-4">Contato</th>
                  <th className="p-4">Cidade / UF</th>
                  <th className="p-4 text-center">Limite Concedido</th>
                  <th className="p-4 text-center">Situação Crédito</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {customers.map((c) => {
                  const formattedDoc = c.document
                    ? c.person_type === 'individual'
                      ? maskCpf(c.document)
                      : maskCnpj(c.document)
                    : 'Não informado'

                  return (
                    <tr key={c.id} className="hover:bg-slate-850/50 transition">
                      {/* Tipo */}
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                            c.person_type === 'individual'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          {c.person_type === 'individual' ? 'PF' : 'PJ'}
                        </span>
                      </td>

                      {/* Nome / Documento */}
                      <td className="p-4">
                        <div className="font-semibold text-white">{c.name}</div>
                        {c.trade_name && (
                          <div className="text-xs text-slate-400">{c.trade_name}</div>
                        )}
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {formattedDoc}
                        </div>
                      </td>

                      {/* Contato */}
                      <td className="p-4 text-xs text-slate-300">
                        {c.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-slate-500" />
                            <span>{maskPhone(c.phone)}</span>
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-slate-400 truncate max-w-[180px] mt-0.5">
                            <Mail className="h-3 w-3 text-slate-500" />
                            <span>{c.email}</span>
                          </div>
                        )}
                        {!c.phone && !c.email && <span className="text-slate-500">—</span>}
                      </td>

                      {/* Cidade / UF */}
                      <td className="p-4 whitespace-nowrap text-xs text-slate-300">
                        {c.city ? `${c.city} - ${c.state || ''}` : '—'}
                      </td>

                      {/* Limite Concedido */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className="font-bold text-white">
                          R${' '}
                          {c.credit_limit.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>

                      {/* Situação do Crédito */}
                      <td className="p-4 text-center whitespace-nowrap">
                        {renderCreditStatusBadge(c.credit_status)}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center whitespace-nowrap">
                        {c.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                            <XCircle className="h-3.5 w-3.5" /> Inativo
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenCreditModal(c)}
                            className="text-amber-400 hover:bg-amber-500/10 h-8 px-2 text-xs gap-1"
                            title="Ajustar Limite de Crédito"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Crédito
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/cadastros/clientes/${c.id}`)}
                            className="text-blue-400 hover:bg-blue-500/10 h-8 px-2 text-xs"
                            title="Editar Cliente"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleStatus(c)}
                            className={`h-8 px-2 text-xs ${
                              c.status === 'active'
                                ? 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/10'
                                : 'text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                            title={c.status === 'active' ? 'Inativar Cliente' : 'Ativar Cliente'}
                          >
                            {c.status === 'active' ? (
                              <PowerOff className="h-3.5 w-3.5" />
                            ) : (
                              <Power className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalCount > pageSize && (
          <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 text-xs text-slate-400">
            <span>
              Mostrando {customers.length} de {totalCount} clientes
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 h-8 px-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 h-8 px-2"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Limite de Crédito */}
      <CreditLimitModal
        isOpen={isCreditModalOpen}
        onClose={() => {
          setIsCreditModalOpen(false)
          setSelectedCustomerForCredit(null)
        }}
        customer={selectedCustomerForCredit}
        onSuccess={() => loadData(true)}
      />
    </div>
  )
}
