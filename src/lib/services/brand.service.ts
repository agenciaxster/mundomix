import { supabase } from '@/lib/supabase'
import type { Brand, BrandFilters, BrandKpis } from '@/types/brand'

export const brandService = {
  /**
   * Lista todas as marcas cadastradas na empresa ativa com contagem de produtos vinculados.
   * Possui fallback resiliente caso a tabela brands ainda esteja sendo migrada no Supabase.
   */
  async listBrands(companyId: string, filters?: BrandFilters): Promise<Brand[]> {
    if (!supabase) return []

    try {
      let query = supabase
        .from('brands')
        .select('*')
        .eq('company_id', companyId)

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      const { data: brandData, error: brandError } = await query.order('name', { ascending: true })

      if (brandError) {
        if (brandError.message?.includes('does not exist') || brandError.code === '42P01') {
          console.warn('Tabela brands ainda não criada no Supabase. Usando fallback de produtos.')
          return this.fallbackListFromProducts(companyId, filters)
        }
        console.error('Erro ao listar marcas:', brandError)
        throw new Error(brandError.message || 'Erro ao listar marcas.')
      }

      if (!brandData || brandData.length === 0) {
        return []
      }

      // Busca contagem de produtos vinculados
      const { data: prodCounts } = await supabase
        .from('products')
        .select('brand, brand_id')
        .eq('company_id', companyId)

      const countMap = new Map<string, number>()
      if (prodCounts) {
        for (const p of prodCounts) {
          if (p.brand_id) {
            countMap.set(p.brand_id, (countMap.get(p.brand_id) || 0) + 1)
          }
          if (p.brand) {
            const trimmed = p.brand.trim()
            countMap.set(`name:${trimmed}`, (countMap.get(`name:${trimmed}`) || 0) + 1)
          }
        }
      }

      let results: Brand[] = brandData.map((b) => {
        const byId = countMap.get(b.id) || 0
        const byName = countMap.get(`name:${b.name.trim()}`) || 0
        return {
          id: b.id,
          company_id: b.company_id,
          name: b.name,
          code: b.code || null,
          description: b.description || null,
          logo_url: b.logo_url || null,
          status: b.status || 'active',
          created_at: b.created_at,
          updated_at: b.updated_at,
          products_count: Math.max(byId, byName),
        }
      })

      if (filters?.search) {
        const s = filters.search.toLowerCase()
        results = results.filter(
          (b) =>
            b.name.toLowerCase().includes(s) ||
            (b.code && b.code.toLowerCase().includes(s)) ||
            (b.description && b.description.toLowerCase().includes(s))
        )
      }

      return results
    } catch (err: any) {
      console.error('Falha ao listar marcas:', err)
      return this.fallbackListFromProducts(companyId, filters)
    }
  },

  /**
   * Fallback caso a tabela brands ainda não exista no banco
   */
  async fallbackListFromProducts(companyId: string, filters?: BrandFilters): Promise<Brand[]> {
    if (!supabase) return []
    const { data } = await supabase
      .from('products')
      .select('brand, created_at')
      .eq('company_id', companyId)

    const map = new Map<string, { count: number; date: string }>()
    if (data) {
      for (const row of data) {
        if (row.brand && row.brand.trim()) {
          const name = row.brand.trim()
          const current = map.get(name) || { count: 0, date: row.created_at }
          map.set(name, { count: current.count + 1, date: current.date })
        }
      }
    }

    let items: Brand[] = Array.from(map.entries()).map(([name, val], idx) => ({
      id: `virtual-brand-${idx}-${name}`,
      company_id: companyId,
      name,
      code: null,
      description: null,
      logo_url: null,
      status: 'active',
      created_at: val.date || new Date().toISOString(),
      updated_at: val.date || new Date().toISOString(),
      products_count: val.count,
    }))

    if (filters?.search) {
      const s = filters.search.toLowerCase()
      items = items.filter((b) => b.name.toLowerCase().includes(s))
    }

    return items
  },

  /**
   * KPIs de Marcas
   */
  async getBrandKpis(companyId: string): Promise<BrandKpis> {
    const brands = await this.listBrands(companyId)
    const totalBrands = brands.length
    const activeBrands = brands.filter((b) => b.status === 'active').length
    const inactiveBrands = totalBrands - activeBrands
    const totalBrandedProducts = brands.reduce((acc, b) => acc + (b.products_count || 0), 0)

    return {
      totalBrands,
      activeBrands,
      inactiveBrands,
      totalBrandedProducts,
    }
  },

  /**
   * Cria nova marca
   */
  async createBrand(
    companyId: string,
    data: {
      name: string
      code?: string | null
      description?: string | null
      logo_url?: string | null
      status?: 'active' | 'inactive'
    }
  ): Promise<Brand> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    const payload = {
      company_id: companyId,
      name: data.name.trim(),
      code: data.code?.trim() || null,
      description: data.description?.trim() || null,
      logo_url: data.logo_url?.trim() || null,
      status: data.status || 'active',
    }

    const { data: inserted, error } = await supabase
      .from('brands')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      console.error('Erro ao cadastrar marca:', error)
      if (error.code === '23505') {
        throw new Error(`Já existe uma marca cadastrada com o nome "${data.name.trim()}".`)
      }
      throw new Error(error.message || 'Erro ao cadastrar marca.')
    }

    return inserted
  },

  /**
   * Atualiza uma marca
   */
  async updateBrand(
    companyId: string,
    id: string,
    data: {
      name: string
      code?: string | null
      description?: string | null
      logo_url?: string | null
      status?: 'active' | 'inactive'
    }
  ): Promise<Brand> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    const payload = {
      name: data.name.trim(),
      code: data.code?.trim() || null,
      description: data.description?.trim() || null,
      logo_url: data.logo_url?.trim() || null,
      status: data.status || 'active',
      updated_at: new Date().toISOString(),
    }

    const { data: updated, error } = await supabase
      .from('brands')
      .update(payload)
      .eq('id', id)
      .eq('company_id', companyId)
      .select('*')
      .single()

    if (error) {
      console.error('Erro ao atualizar marca:', error)
      if (error.code === '23505') {
        throw new Error(`Já existe uma marca cadastrada com o nome "${data.name.trim()}".`)
      }
      throw new Error(error.message || 'Erro ao atualizar marca.')
    }

    // Mantém sincronizado o campo textual 'brand' nos produtos vinculados
    try {
      await supabase
        .from('products')
        .update({ brand: data.name.trim() })
        .eq('brand_id', id)
        .eq('company_id', companyId)
    } catch (err) {
      console.warn('Aviso: Não foi possível sincronizar o nome nos produtos vinculados:', err)
    }

    return updated
  },

  /**
   * Alterna status da marca
   */
  async toggleBrandStatus(
    companyId: string,
    id: string,
    currentStatus: 'active' | 'inactive'
  ): Promise<'active' | 'inactive'> {
    if (!supabase) throw new Error('Supabase client não configurado.')
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active'

    const { error } = await supabase
      .from('brands')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Erro ao alternar status da marca:', error)
      throw new Error(error.message || 'Erro ao alterar status da marca.')
    }

    return nextStatus
  },

  /**
   * Exclui uma marca
   */
  async deleteBrand(companyId: string, id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    // Desvincula products (set brand_id = null)
    try {
      await supabase
        .from('products')
        .update({ brand_id: null })
        .eq('brand_id', id)
        .eq('company_id', companyId)
    } catch (e) {
      console.warn('Aviso ao desvincular produtos da marca:', e)
    }

    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Erro ao excluir marca:', error)
      throw new Error(error.message || 'Erro ao excluir marca.')
    }
  },

  /**
   * Sincroniza marcas existentes nos produtos para a tabela brands
   */
  async syncFromProducts(companyId: string): Promise<number> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    const { data: prods, error: pErr } = await supabase
      .from('products')
      .select('brand')
      .eq('company_id', companyId)

    if (pErr || !prods) return 0

    const uniqueNames = new Set<string>()
    for (const p of prods) {
      if (p.brand && p.brand.trim()) {
        uniqueNames.add(p.brand.trim())
      }
    }

    if (uniqueNames.size === 0) return 0

    const rowsToInsert = Array.from(uniqueNames).map((name) => ({
      company_id: companyId,
      name,
      status: 'active',
    }))

    const { data: inserted, error: iErr } = await supabase
      .from('brands')
      .upsert(rowsToInsert, { onConflict: 'company_id,name', ignoreDuplicates: true })
      .select('id, name')

    if (iErr) {
      console.error('Erro ao sincronizar marcas:', iErr)
      throw new Error(iErr.message || 'Erro ao sincronizar marcas.')
    }

    if (inserted && inserted.length > 0) {
      for (const b of inserted) {
        await supabase
          .from('products')
          .update({ brand_id: b.id })
          .eq('company_id', companyId)
          .eq('brand', b.name)
          .is('brand_id', null)
      }
    }

    return inserted?.length || 0
  },
}
