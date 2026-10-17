import { supabase } from '@/lib/supabase'
import type { Category, CategoryFilters, CategoryKpis } from '@/types/category'

export const categoryService = {
  /**
   * Lista todas as categorias cadastradas na empresa ativa com contagem de produtos associados.
   * Possui fallback resiliente caso a tabela categories ainda esteja sendo migrada no Supabase.
   */
  async listCategories(companyId: string, filters?: CategoryFilters): Promise<Category[]> {
    if (!supabase) return []

    try {
      let query = supabase
        .from('categories')
        .select('*')
        .eq('company_id', companyId)

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      const { data: catData, error: catError } = await query.order('name', { ascending: true })

      if (catError) {
        // Se a tabela não existir ainda no banco, faz fallback extraindo dos produtos
        if (catError.message?.includes('does not exist') || catError.code === '42P01') {
          console.warn('Tabela categories ainda não criada no Supabase. Usando fallback de produtos.')
          return this.fallbackListFromProducts(companyId, filters)
        }
        console.error('Erro ao listar categorias:', catError)
        throw new Error(catError.message || 'Erro ao listar categorias.')
      }

      if (!catData || catData.length === 0) {
        return []
      }

      // Busca contagem de produtos vinculados para cada categoria
      const { data: prodCounts } = await supabase
        .from('products')
        .select('category, category_id')
        .eq('company_id', companyId)

      const countMap = new Map<string, number>()
      if (prodCounts) {
        for (const p of prodCounts) {
          if (p.category_id) {
            countMap.set(p.category_id, (countMap.get(p.category_id) || 0) + 1)
          }
          if (p.category) {
            const trimmedName = p.category.trim()
            countMap.set(`name:${trimmedName}`, (countMap.get(`name:${trimmedName}`) || 0) + 1)
          }
        }
      }

      let results: Category[] = catData.map((c) => {
        const byId = countMap.get(c.id) || 0
        const byName = countMap.get(`name:${c.name.trim()}`) || 0
        return {
          id: c.id,
          company_id: c.company_id,
          name: c.name,
          code: c.code || null,
          description: c.description || null,
          status: c.status || 'active',
          created_at: c.created_at,
          updated_at: c.updated_at,
          products_count: Math.max(byId, byName),
        }
      })

      // Filtro local de busca (se fornecido)
      if (filters?.search) {
        const s = filters.search.toLowerCase()
        results = results.filter(
          (c) =>
            c.name.toLowerCase().includes(s) ||
            (c.code && c.code.toLowerCase().includes(s)) ||
            (c.description && c.description.toLowerCase().includes(s))
        )
      }

      return results
    } catch (err: any) {
      console.error('Falha ao listar categorias:', err)
      return this.fallbackListFromProducts(companyId, filters)
    }
  },

  /**
   * Fallback de emergência caso a tabela categories ainda não tenha sido criada no banco.
   */
  async fallbackListFromProducts(companyId: string, filters?: CategoryFilters): Promise<Category[]> {
    if (!supabase) return []
    const { data } = await supabase
      .from('products')
      .select('category, created_at')
      .eq('company_id', companyId)

    const map = new Map<string, { count: number; date: string }>()
    if (data) {
      for (const row of data) {
        if (row.category && row.category.trim()) {
          const name = row.category.trim()
          const current = map.get(name) || { count: 0, date: row.created_at }
          map.set(name, { count: current.count + 1, date: current.date })
        }
      }
    }

    let items: Category[] = Array.from(map.entries()).map(([name, val], idx) => ({
      id: `virtual-${idx}-${name}`,
      company_id: companyId,
      name,
      code: null,
      description: null,
      status: 'active',
      created_at: val.date || new Date().toISOString(),
      updated_at: val.date || new Date().toISOString(),
      products_count: val.count,
    }))

    if (filters?.search) {
      const s = filters.search.toLowerCase()
      items = items.filter((c) => c.name.toLowerCase().includes(s))
    }

    return items
  },

  /**
   * Obtém os indicadores (KPIs) de categorias
   */
  async getCategoryKpis(companyId: string): Promise<CategoryKpis> {
    const categories = await this.listCategories(companyId)
    const totalCategories = categories.length
    const activeCategories = categories.filter((c) => c.status === 'active').length
    const inactiveCategories = totalCategories - activeCategories
    const totalCategorizedProducts = categories.reduce(
      (acc, c) => acc + (c.products_count || 0),
      0
    )

    return {
      totalCategories,
      activeCategories,
      inactiveCategories,
      totalCategorizedProducts,
    }
  },

  /**
   * Cria uma nova categoria
   */
  async createCategory(
    companyId: string,
    data: {
      name: string
      code?: string | null
      description?: string | null
      status?: 'active' | 'inactive'
    }
  ): Promise<Category> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    const payload = {
      company_id: companyId,
      name: data.name.trim(),
      code: data.code?.trim() || null,
      description: data.description?.trim() || null,
      status: data.status || 'active',
    }

    const { data: inserted, error } = await supabase
      .from('categories')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      console.error('Erro ao cadastrar categoria:', error)
      if (error.code === '23505') {
        throw new Error(`Já existe uma categoria cadastrada com o nome "${data.name.trim()}".`)
      }
      throw new Error(error.message || 'Erro ao cadastrar categoria.')
    }

    return inserted
  },

  /**
   * Atualiza dados de uma categoria existente
   */
  async updateCategory(
    companyId: string,
    id: string,
    data: {
      name: string
      code?: string | null
      description?: string | null
      status?: 'active' | 'inactive'
    }
  ): Promise<Category> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    const payload = {
      name: data.name.trim(),
      code: data.code?.trim() || null,
      description: data.description?.trim() || null,
      status: data.status || 'active',
      updated_at: new Date().toISOString(),
    }

    const { data: updated, error } = await supabase
      .from('categories')
      .update(payload)
      .eq('id', id)
      .eq('company_id', companyId)
      .select('*')
      .single()

    if (error) {
      console.error('Erro ao atualizar categoria:', error)
      if (error.code === '23505') {
        throw new Error(`Já existe uma categoria cadastrada com o nome "${data.name.trim()}".`)
      }
      throw new Error(error.message || 'Erro ao atualizar categoria.')
    }

    // Mantém sincronizado o campo textual 'category' nos produtos vinculados
    try {
      await supabase
        .from('products')
        .update({ category: data.name.trim() })
        .eq('category_id', id)
        .eq('company_id', companyId)
    } catch (err) {
      console.warn('Aviso: Não foi possível sincronizar o nome nos produtos vinculados:', err)
    }

    return updated
  },

  /**
   * Alterna o status da categoria entre ativo e inativo
   */
  async toggleCategoryStatus(
    companyId: string,
    id: string,
    currentStatus: 'active' | 'inactive'
  ): Promise<'active' | 'inactive'> {
    if (!supabase) throw new Error('Supabase client não configurado.')
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active'

    const { error } = await supabase
      .from('categories')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Erro ao alternar status da categoria:', error)
      throw new Error(error.message || 'Erro ao alterar status da categoria.')
    }

    return nextStatus
  },

  /**
   * Exclui uma categoria.
   * Se houver produtos vinculados a ela, desvincula os produtos ou alerta.
   */
  async deleteCategory(companyId: string, id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    // Desvincula products (set category_id = null) para evitar violação de FK
    try {
      await supabase
        .from('products')
        .update({ category_id: null })
        .eq('category_id', id)
        .eq('company_id', companyId)
    } catch (e) {
      console.warn('Aviso ao desvincular produtos da categoria:', e)
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Erro ao excluir categoria:', error)
      throw new Error(error.message || 'Erro ao excluir categoria.')
    }
  },

  /**
   * Sincroniza categorias que estão cadastradas apenas como texto nos produtos para a tabela de categorias
   */
  async syncFromProducts(companyId: string): Promise<number> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    const { data: prods, error: pErr } = await supabase
      .from('products')
      .select('category')
      .eq('company_id', companyId)

    if (pErr || !prods) return 0

    const uniqueNames = new Set<string>()
    for (const p of prods) {
      if (p.category && p.category.trim()) {
        uniqueNames.add(p.category.trim())
      }
    }

    if (uniqueNames.size === 0) return 0

    const rowsToInsert = Array.from(uniqueNames).map((name) => ({
      company_id: companyId,
      name,
      status: 'active',
    }))

    const { data: inserted, error: iErr } = await supabase
      .from('categories')
      .upsert(rowsToInsert, { onConflict: 'company_id,name', ignoreDuplicates: true })
      .select('id, name')

    if (iErr) {
      console.error('Erro ao sincronizar categorias:', iErr)
      throw new Error(iErr.message || 'Erro ao sincronizar categorias.')
    }

    // Se houve inserções ou se existem categorias, atualiza o category_id nos produtos
    if (inserted && inserted.length > 0) {
      for (const cat of inserted) {
        await supabase
          .from('products')
          .update({ category_id: cat.id })
          .eq('company_id', companyId)
          .eq('category', cat.name)
          .is('category_id', null)
      }
    }

    return inserted?.length || 0
  },
}
