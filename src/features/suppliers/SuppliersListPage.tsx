import { useState, useEffect, useCallback } from 'react'
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  CheckCircle2,
  Power,
  PowerOff,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supplierService } from '@/lib/services/supplier.service'
import type { Supplier, SupplierKpis, PersonType, SupplierStatus } from '@/types/supplier'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import { toast } from '@/hooks/useToast'
import { SupplierFormModal } from './modals/SupplierFormModal'

export function SuppliersListPage() {
  const { activeCompany } = useAuth()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [kpis, setKpis] = useState<SupplierKpis>({
    totalSuppliers: 0,
    activeSuppliers: 0,
    inactiveSuppliers: 0,
    pjCount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SupplierStatus>('all')
  const [personTypeFilter, setPersonTypeFilter] = useState<'all' | PersonType>('all')

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [selectedSupplierToEdit, setSelectedSupplierToEdit] = useState<Supplier | null>(null)

  const loadData = useCallback(
    async (refresh = false) => {
      if (!activeCompany?.id) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const [supList, kpiData] = await Promise.all([
          supplierService.listSuppliers(activeCompany.id, {
            search: searchTerm,
            status: statusFilter,
            personType: personTypeFilter,
          }),
          supplierService.getSupplierKpis(activeCompany.id),
        ])

        setSuppliers(supList)
        setKpis(kpiData)
      } catch (err: any) {
        console.error('Erro ao carregar fornecedores:', err)
        toast.error(err.message || 'Erro ao carregar fornecedores.')
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [activeCompany, searchTerm, statusFilter, personTypeFilter]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  function handleOpenCreate() {
    setSelectedSupplierToEdit(null)
    setIsFormModalOpen(true)
  }

  function handleOpenEdit(sup: Supplier) {
    setSelectedSupplierToEdit(sup)
    setIsFormModalOpen(true)
  }

  async function handleToggleStatus(sup: Supplier) {
    if (!activeCompany?.id) return
    try {
      const nextStatus = await supplierService.toggleSupplierStatus(
        activeCompany.id,
        sup.id,
        sup.status
      )
      toast.success(
        `Fornecedor "${sup.name}" ${nextStatus === 'active' ? 'ativado' : 'inativado'} com sucesso!`
      )
      loadData(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao alterar status do fornecedor.')
    }
  }

  async function handleDelete(sup: Supplier) {
    if (!activeCompany?.id) return
    const confirmed = window.confirm(
      `Deseja realmente excluir o fornecedor "${sup.name}" do cadastro?`
    )
    if (!confirmed) return

    try {
      await supplierService.deleteSupplier(activeCompany.id, sup.id)
      toast.success(`Fornecedor "${sup.name}" excluído com sucesso.`)
      loadData(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao excluir fornecedor.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Fornecedores & Parceiros
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              <Truck className="h-3 w-3" />
              Gestão de Compras
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre distribuidores, indústrias e representantes comerciais para controle de compras e reposição
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={handleOpenCreate}
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-medium shadow-lg shadow-emerald-600/20 text-xs"
          >
            <Plus className="h-4 w-4" />
            Novo Fornecedor
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total de Fornecedores</span>
            <Truck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{kpis.totalSuppliers}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Cadastrados na empresa</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Ativos</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400">{kpis.activeSuppliers}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Habilitados para pedidos</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Inativos</span>
            <PowerOff className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-400">{kpis.inactiveSuppliers}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Bloqueados ou sem uso</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Empresas (PJ)</span>
            <Building2 className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-400">{kpis.pjCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Com CNPJ cadastrado</div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por Razão Social, Fantasia, CNPJ/CPF, Telefone ou Cidade..."
              className="pl-9 bg-slate-800/80 border-slate-700 text-white text-xs w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <select
              value={personTypeFilter}
              onChange={(e) => setPersonTypeFilter(e.target.value as any)}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none h-9"
            >
              <option value="all">Todos os Tipos</option>
              <option value="PJ">Apenas PJ (Empresas)</option>
              <option value="PF">Apenas PF (Autônomos)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none h-9"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Apenas Ativos</option>
              <option value="inactive">Apenas Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Fornecedores */}
      {isLoading ? (
        <LoadingState message="Carregando fornecedores..." />
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-500 mb-4 border border-slate-700/60">
            <Truck className="h-7 w-7 text-emerald-400" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhum fornecedor encontrado</h3>
          <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
            {searchTerm || statusFilter !== 'all' || personTypeFilter !== 'all'
              ? 'Nenhum fornecedor corresponde aos filtros aplicados.'
              : 'Você ainda não cadastrou fornecedores parceiros. Cadastre suas distribuidoras e fabricantes para registrar compras e cotações.'}
          </p>

          <div className="mt-6">
            <Button
              type="button"
              onClick={handleOpenCreate}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-2 shadow-lg shadow-emerald-600/20"
            >
              <Plus className="h-4 w-4" />
              Cadastrar Primeiro Fornecedor
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-850 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Fornecedor</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Contato / Comercial</th>
                  <th className="py-3 px-3">Localização</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {suppliers.map((sup) => {
                  return (
                    <tr key={sup.id} className="hover:bg-slate-850/50 transition group">
                      {/* Fornecedor */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {sup.person_type === 'PJ' ? (
                              <Building2 className="h-4 w-4" />
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-emerald-400 transition text-sm">
                              {sup.name}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                              {sup.trade_name && (
                                <span className="font-sans text-slate-300">
                                  ({sup.trade_name})
                                </span>
                              )}
                              {sup.document && <span>Doc: {sup.document}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            sup.person_type === 'PJ'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          {sup.person_type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                        </span>
                      </td>

                      {/* Contato */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5 text-xs">
                          {sup.phone && (
                            <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
                              <Phone className="h-3 w-3 text-emerald-400 shrink-0" />
                              {sup.phone}
                            </div>
                          )}
                          {sup.email && (
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                              <Mail className="h-3 w-3 text-blue-400 shrink-0" />
                              {sup.email}
                            </div>
                          )}
                          {sup.contact_name && (
                            <div className="text-[10px] text-slate-500 font-medium">
                              Contato: {sup.contact_name}
                            </div>
                          )}
                          {!sup.phone && !sup.email && !sup.contact_name && (
                            <span className="text-slate-500">—</span>
                          )}
                        </div>
                      </td>

                      {/* Localização */}
                      <td className="py-3 px-3">
                        {sup.city || sup.state ? (
                          <div className="flex items-center gap-1 text-slate-300 text-xs">
                            <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            <span>
                              {sup.city || '—'}
                              {sup.state ? ` / ${sup.state}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(sup)}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${
                            sup.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                          }`}
                          title="Clique para alternar status"
                        >
                          {sup.status === 'active' ? (
                            <>
                              <Power className="h-3 w-3" />
                              Ativo
                            </>
                          ) : (
                            <>
                              <PowerOff className="h-3 w-3" />
                              Inativo
                            </>
                          )}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(sup)}
                            title="Editar fornecedor"
                            className="text-slate-400 hover:text-white hover:bg-slate-800 h-7 w-7 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(sup)}
                            title="Excluir fornecedor"
                            className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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

      {/* Modal de Criação / Edição de Fornecedor */}
      <SupplierFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false)
          setSelectedSupplierToEdit(null)
        }}
        onSuccess={() => loadData(true)}
        supplierToEdit={selectedSupplierToEdit}
      />
    </div>
  )
}
