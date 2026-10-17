import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Tag,
  Plus,
  Search,
  RefreshCw,
  Package,
  Pencil,
  Trash2,
  CheckCircle2,
  Power,
  PowerOff,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { brandService } from '@/lib/services/brand.service'
import type { Brand, BrandKpis } from '@/types/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import { toast } from '@/hooks/useToast'
import { BrandFormModal } from './modals/BrandFormModal'

export function BrandsListPage() {
  const navigate = useNavigate()
  const { activeCompany } = useAuth()

  const [brands, setBrands] = useState<Brand[]>([])
  const [kpis, setKpis] = useState<BrandKpis>({
    totalBrands: 0,
    activeBrands: 0,
    inactiveBrands: 0,
    totalBrandedProducts: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [selectedBrandToEdit, setSelectedBrandToEdit] = useState<Brand | null>(null)

  const loadData = useCallback(
    async (refresh = false) => {
      if (!activeCompany?.id) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const [brandList, kpiData] = await Promise.all([
          brandService.listBrands(activeCompany.id, {
            search: searchTerm,
            status: statusFilter,
          }),
          brandService.getBrandKpis(activeCompany.id),
        ])

        setBrands(brandList)
        setKpis(kpiData)
      } catch (err: any) {
        console.error('Erro ao carregar marcas:', err)
        toast.error(err.message || 'Erro ao carregar marcas.')
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [activeCompany, searchTerm, statusFilter]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  function handleOpenCreate() {
    setSelectedBrandToEdit(null)
    setIsFormModalOpen(true)
  }

  function handleOpenEdit(b: Brand) {
    setSelectedBrandToEdit(b)
    setIsFormModalOpen(true)
  }

  async function handleToggleStatus(b: Brand) {
    if (!activeCompany?.id) return
    try {
      const nextStatus = await brandService.toggleBrandStatus(
        activeCompany.id,
        b.id,
        b.status
      )
      toast.success(
        `Marca "${b.name}" ${nextStatus === 'active' ? 'ativada' : 'inativada'} com sucesso!`
      )
      loadData(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao alterar status da marca.')
    }
  }

  async function handleDelete(b: Brand) {
    if (!activeCompany?.id) return
    const count = b.products_count || 0
    const msg =
      count > 0
        ? `Atenção: A marca "${b.name}" possui ${count} produto(s) associado(s). A exclusão removerá o vínculo desses produtos com esta marca. Deseja continuar?`
        : `Deseja realmente excluir a marca "${b.name}"?`

    if (!window.confirm(msg)) return

    try {
      await brandService.deleteBrand(activeCompany.id, b.id)
      toast.success(`Marca "${b.name}" excluída com sucesso.`)
      loadData(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao excluir marca.')
    }
  }

  async function handleSyncFromProducts() {
    if (!activeCompany?.id) return
    setIsSyncing(true)
    try {
      const count = await brandService.syncFromProducts(activeCompany.id)
      toast.success(
        count > 0
          ? `${count} marcas sincronizadas a partir dos produtos já cadastrados!`
          : 'Todas as marcas dos produtos já estão cadastradas e sincronizadas.'
      )
      loadData(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao sincronizar marcas.')
    } finally {
      setIsSyncing(false)
    }
  }

  function handleViewProductsOfBrand(b: Brand) {
    navigate(`/cadastros/produtos?brand=${encodeURIComponent(b.name)}`)
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Marcas & Fabricantes
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
              <Tag className="h-3 w-3" />
              Catálogo Comercial
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre fabricantes e marcas para organizar itens, filtrar buscas no catálogo e orientar vendas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncFromProducts}
            disabled={isSyncing}
            className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs gap-1.5"
            title="Importa marcas que já constam no texto dos produtos"
          >
            <Sparkles className={`h-3.5 w-3.5 text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} />
            Sincronizar dos Produtos
          </Button>

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
            variant="outline"
            size="sm"
            onClick={() => navigate('/cadastros/produtos')}
            className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs gap-1.5"
          >
            <Package className="h-3.5 w-3.5 text-blue-400" />
            Ver Catálogo
          </Button>

          <Button
            onClick={handleOpenCreate}
            className="bg-amber-600 hover:bg-amber-500 text-white gap-2 font-medium shadow-lg shadow-amber-600/20 text-xs"
          >
            <Plus className="h-4 w-4" />
            Nova Marca
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total de Marcas</span>
            <Tag className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{kpis.totalBrands}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Cadastradas na empresa</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Marcas Ativas</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400">{kpis.activeBrands}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Disponíveis no catálogo</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Inativas</span>
            <PowerOff className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-400">{kpis.inactiveBrands}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Ocultas para novos itens</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Produtos Associados</span>
            <Package className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-purple-400">{kpis.totalBrandedProducts}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Itens com marca definida</div>
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
              placeholder="Pesquisar por nome, sigla ou descrição da marca..."
              className="pl-9 bg-slate-800/80 border-slate-700 text-white text-xs w-full"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none h-9 w-full sm:w-40"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Apenas Ativas</option>
              <option value="inactive">Apenas Inativas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Marcas */}
      {isLoading ? (
        <LoadingState message="Carregando marcas e fabricantes..." />
      ) : brands.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-500 mb-4 border border-slate-700/60">
            <Tag className="h-7 w-7 text-amber-400" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhuma marca encontrada</h3>
          <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
            {searchTerm || statusFilter !== 'all'
              ? 'Nenhuma marca corresponde aos filtros aplicados.'
              : 'Você ainda não cadastrou fabricantes. Cadastre sua primeira marca comercial ou sincronize a partir dos produtos já existentes.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <Button
              type="button"
              onClick={handleOpenCreate}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold gap-2 shadow-lg shadow-amber-600/20"
            >
              <Plus className="h-4 w-4" />
              Cadastrar Nova Marca
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleSyncFromProducts}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Sincronizar das existentes
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-850 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Marca / Fabricante</th>
                  <th className="py-3 px-3">Código / Sigla</th>
                  <th className="py-3 px-3">Descrição</th>
                  <th className="py-3 px-3 text-center">Produtos Associados</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Cadastro</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {brands.map((b) => {
                  const prodCount = b.products_count || 0

                  return (
                    <tr key={b.id} className="hover:bg-slate-850/50 transition group">
                      {/* Marca */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 overflow-hidden">
                            {b.logo_url ? (
                              <img
                                src={b.logo_url}
                                alt={b.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  ;(e.target as any).style.display = 'none'
                                }}
                              />
                            ) : (
                              <Tag className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-amber-400 transition text-sm">
                              {b.name}
                            </div>
                            <div className="text-[10px] text-slate-500">ID: {b.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>

                      {/* Código */}
                      <td className="py-3 px-3">
                        {b.code ? (
                          <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300 border border-slate-700/60">
                            {b.code}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Descrição */}
                      <td className="py-3 px-3 max-w-xs truncate text-slate-400 text-xs">
                        {b.description || <span className="text-slate-600">—</span>}
                      </td>

                      {/* Produtos Vinculados */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleViewProductsOfBrand(b)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 hover:bg-amber-600/20 hover:text-amber-300 hover:border-amber-500/30 border border-slate-700/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300 transition"
                          title="Clique para filtrar catálogo por esta marca"
                        >
                          <Package className="h-3 w-3 text-amber-400" />
                          <span>{prodCount} {prodCount === 1 ? 'produto' : 'produtos'}</span>
                          <ArrowRight className="h-2.5 w-2.5 opacity-60" />
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(b)}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${
                            b.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                          }`}
                          title="Clique para alternar status"
                        >
                          {b.status === 'active' ? (
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

                      {/* Data de Cadastro */}
                      <td className="py-3 px-3 text-center text-[11px] text-slate-400">
                        {new Date(b.created_at).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewProductsOfBrand(b)}
                            title="Ver produtos desta marca"
                            className="text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 h-7 w-7 p-0"
                          >
                            <Package className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(b)}
                            title="Editar marca"
                            className="text-slate-400 hover:text-white hover:bg-slate-800 h-7 w-7 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(b)}
                            title="Excluir marca"
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

      {/* Modal de Criação / Edição de Marca */}
      <BrandFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false)
          setSelectedBrandToEdit(null)
        }}
        onSuccess={() => loadData(true)}
        brandToEdit={selectedBrandToEdit}
      />
    </div>
  )
}
