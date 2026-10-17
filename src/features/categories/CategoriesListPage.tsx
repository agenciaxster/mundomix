import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers,
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
import { categoryService } from '@/lib/services/category.service'
import type { Category, CategoryKpis } from '@/types/category'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import { toast } from '@/hooks/useToast'
import { CategoryFormModal } from './modals/CategoryFormModal'

export function CategoriesListPage() {
  const navigate = useNavigate()
  const { activeCompany } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [kpis, setKpis] = useState<CategoryKpis>({
    totalCategories: 0,
    activeCategories: 0,
    inactiveCategories: 0,
    totalCategorizedProducts: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [selectedCategoryToEdit, setSelectedCategoryToEdit] = useState<Category | null>(null)

  const loadData = useCallback(
    async (refresh = false) => {
      if (!activeCompany?.id) return
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)

      try {
        const [cats, kpiData] = await Promise.all([
          categoryService.listCategories(activeCompany.id, {
            search: searchTerm,
            status: statusFilter,
          }),
          categoryService.getCategoryKpis(activeCompany.id),
        ])

        setCategories(cats)
        setKpis(kpiData)
      } catch (err: any) {
        console.error('Erro ao carregar categorias:', err)
        toast.error(err.message || 'Erro ao carregar categorias.')
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
    setSelectedCategoryToEdit(null)
    setIsFormModalOpen(true)
  }

  function handleOpenEdit(cat: Category) {
    setSelectedCategoryToEdit(cat)
    setIsFormModalOpen(true)
  }

  async function handleToggleStatus(cat: Category) {
    if (!activeCompany?.id) return
    try {
      const nextStatus = await categoryService.toggleCategoryStatus(
        activeCompany.id,
        cat.id,
        cat.status
      )
      toast.success(
        `Categoria "${cat.name}" ${nextStatus === 'active' ? 'ativada' : 'inativada'} com sucesso!`
      )
      loadData(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao alterar status da categoria.')
    }
  }

  async function handleDelete(cat: Category) {
    if (!activeCompany?.id) return
    const count = cat.products_count || 0
    const msg =
      count > 0
        ? `Atenção: A categoria "${cat.name}" possui ${count} produto(s) associado(s). A exclusão removerá o vínculo desses produtos com esta categoria. Deseja continuar?`
        : `Deseja realmente excluir a categoria "${cat.name}"?`

    if (!window.confirm(msg)) return

    try {
      await categoryService.deleteCategory(activeCompany.id, cat.id)
      toast.success(`Categoria "${cat.name}" excluída com sucesso.`)
      loadData(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao excluir categoria.')
    }
  }

  async function handleSyncFromProducts() {
    if (!activeCompany?.id) return
    setIsSyncing(true)
    try {
      const count = await categoryService.syncFromProducts(activeCompany.id)
      toast.success(
        count > 0
          ? `${count} categorias sincronizadas a partir dos produtos já cadastrados!`
          : 'Todas as categorias dos produtos já estão cadastradas e sincronizadas.'
      )
      loadData(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao sincronizar categorias.')
    } finally {
      setIsSyncing(false)
    }
  }

  function handleViewProductsOfCategory(cat: Category) {
    navigate(`/cadastros/produtos?category=${encodeURIComponent(cat.name)}`)
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Categorias de Produtos
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
              <Layers className="h-3 w-3" />
              Catálogo & Departamentos
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre departamentos e categorias para organizar produtos, filtrar estoque e facilitar a venda no PDV
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncFromProducts}
            disabled={isSyncing}
            className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs gap-1.5"
            title="Importa categorias que já estejam cadastradas como texto nos produtos"
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
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2 font-medium shadow-lg shadow-blue-600/20 text-xs"
          >
            <Plus className="h-4 w-4" />
            Nova Categoria
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total de Categorias</span>
            <Layers className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{kpis.totalCategories}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Cadastradas na empresa</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Ativas no Catálogo</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400">{kpis.activeCategories}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Disponíveis no cadastro</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Inativas</span>
            <PowerOff className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-400">{kpis.inactiveCategories}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Ocultas para novos itens</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Produtos Categorizados</span>
            <Package className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-purple-400">{kpis.totalCategorizedProducts}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Itens vinculados</div>
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
              placeholder="Pesquisar por nome, sigla ou descrição da categoria..."
              className="pl-9 bg-slate-800/80 border-slate-700 text-white text-xs w-full"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none h-9 w-full sm:w-40"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Apenas Ativas</option>
              <option value="inactive">Apenas Inativas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Categorias */}
      {isLoading ? (
        <LoadingState message="Carregando categorias..." />
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-500 mb-4 border border-slate-700/60">
            <Layers className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhuma categoria encontrada</h3>
          <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
            {searchTerm || statusFilter !== 'all'
              ? 'Nenhuma categoria corresponde aos filtros aplicados.'
              : 'Você ainda não cadastrou categorias personalizadas. Crie sua primeira categoria ou sincronize as que já constam nos seus produtos.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <Button
              type="button"
              onClick={handleOpenCreate}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold gap-2 shadow-lg shadow-blue-600/20"
            >
              <Plus className="h-4 w-4" />
              Cadastrar Nova Categoria
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
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-3">Código / Sigla</th>
                  <th className="py-3 px-3">Descrição</th>
                  <th className="py-3 px-3 text-center">Produtos Vinculados</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Cadastro</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {categories.map((c) => {
                  const prodCount = c.products_count || 0

                  return (
                    <tr key={c.id} className="hover:bg-slate-850/50 transition group">
                      {/* Categoria */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Layers className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-blue-400 transition text-sm">
                              {c.name}
                            </div>
                            <div className="text-[10px] text-slate-500">ID: {c.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>

                      {/* Código */}
                      <td className="py-3 px-3">
                        {c.code ? (
                          <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300 border border-slate-700/60">
                            {c.code}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Descrição */}
                      <td className="py-3 px-3 max-w-xs truncate text-slate-400 text-xs">
                        {c.description || <span className="text-slate-600">—</span>}
                      </td>

                      {/* Produtos Vinculados */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleViewProductsOfCategory(c)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 hover:bg-blue-600/20 hover:text-blue-300 hover:border-blue-500/30 border border-slate-700/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300 transition"
                          title="Clique para filtrar catálogo por esta categoria"
                        >
                          <Package className="h-3 w-3 text-blue-400" />
                          <span>{prodCount} {prodCount === 1 ? 'produto' : 'produtos'}</span>
                          <ArrowRight className="h-2.5 w-2.5 opacity-60" />
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(c)}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${
                            c.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                          }`}
                          title="Clique para alternar status"
                        >
                          {c.status === 'active' ? (
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
                        {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewProductsOfCategory(c)}
                            title="Ver produtos desta categoria"
                            className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 h-7 w-7 p-0"
                          >
                            <Package className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(c)}
                            title="Editar categoria"
                            className="text-slate-400 hover:text-white hover:bg-slate-800 h-7 w-7 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(c)}
                            title="Excluir categoria"
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

      {/* Modal de Criação / Edição */}
      <CategoryFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false)
          setSelectedCategoryToEdit(null)
        }}
        onSuccess={() => loadData(true)}
        categoryToEdit={selectedCategoryToEdit}
      />
    </div>
  )
}
