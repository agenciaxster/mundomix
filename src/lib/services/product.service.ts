import { supabase } from '@/lib/supabase'
import type { Product } from '@/types/stock'

export interface ProductWithBranchStock extends Product {
  current_stock: number
  reserved_stock: number
  available_stock: number
  branch_name?: string
}

export interface ProductSearchFilters {
  search?: string
  category?: string
  brand?: string
  onlyInStock?: boolean
}

export const productService = {
  /**
   * Busca catálogo de produtos com saldo de estoque específico e exclusivo da filial informada.
   * Não mistura ou apresenta estoque de outra filial.
   */
  async fetchProductsWithBranchStock(
    companyId: string,
    branchId: string,
    filters?: ProductSearchFilters
  ): Promise<ProductWithBranchStock[]> {
    if (!supabase) return []

    // 1. Busca produtos da empresa
    let prodQuery = supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')

    if (filters?.category && filters.category !== 'all') {
      prodQuery = prodQuery.eq('category', filters.category)
    }

    if (filters?.brand && filters.brand !== 'all') {
      prodQuery = prodQuery.eq('brand', filters.brand)
    }

    const { data: productsData, error: prodError } = await prodQuery.order('name', { ascending: true })

    if (prodError) {
      console.error('Erro ao buscar produtos:', prodError)
      throw new Error(prodError.message || 'Erro ao carregar catálogo de produtos.')
    }

    if (!productsData || productsData.length === 0) {
      return []
    }

    // 2. Busca o saldo de estoque EXCLUSIVAMENTE para a filial especificada
    const productIds = productsData.map((p) => p.id)
    const { data: stockData, error: stockError } = await supabase
      .from('branch_stock')
      .select('product_id, quantity, reserved_quantity, branch:branches (name)')
      .eq('company_id', companyId)
      .eq('branch_id', branchId)
      .in('product_id', productIds)

    if (stockError) {
      console.warn('Aviso: Não foi possível carregar saldo de estoque da filial:', stockError)
    }

    // Mapeia o estoque por ID de produto
    const stockMap = new Map<string, { qty: number; reserved: number; branchName?: string }>()
    if (stockData) {
      for (const s of stockData) {
        const branchObj = Array.isArray(s.branch) ? s.branch[0] : s.branch
        stockMap.set(s.product_id, {
          qty: Number(s.quantity || 0),
          reserved: Number(s.reserved_quantity || 0),
          branchName: branchObj?.name,
        })
      }
    }

    let results: ProductWithBranchStock[] = productsData.map((p: any) => {
      const stockInfo = stockMap.get(p.id) || { qty: 0, reserved: 0 }
      const qty = stockInfo.qty
      const reserved = stockInfo.reserved
      const available = Math.max(0, qty - reserved)

      return {
        id: p.id,
        company_id: p.company_id,
        name: p.name,
        sku: p.sku || null,
        barcode: p.barcode || null,
        category: p.category || null,
        brand: p.brand || null,
        image_url: p.image_url || null,
        unit: p.unit || 'UN',
        cost_price: Number(p.cost_price || 0),
        sale_price: Number(p.sale_price || 0),
        wholesale_price: p.wholesale_price ? Number(p.wholesale_price) : null,
        wholesale_min_qty: p.wholesale_min_qty ? Number(p.wholesale_min_qty) : null,
        max_discount_percentage: p.max_discount_percentage ? Number(p.max_discount_percentage) : 0,
        min_stock: Number(p.min_stock || 0),
        status: p.status || 'active',
        created_at: p.created_at,
        updated_at: p.updated_at,
        current_stock: qty,
        reserved_stock: reserved,
        available_stock: available,
        branch_name: stockInfo.branchName,
      }
    })

    // 3. Aplica busca textual rápida (Nome, SKU, Código de Barras, Categoria ou Marca)
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.toLowerCase().trim()
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.sku && p.sku.toLowerCase().includes(term)) ||
          (p.barcode && p.barcode.toLowerCase().includes(term)) ||
          (p.category && p.category.toLowerCase().includes(term)) ||
          (p.brand && p.brand.toLowerCase().includes(term))
      )
    }

    // 4. Filtro de apenas com estoque disponível
    if (filters?.onlyInStock) {
      results = results.filter((p) => p.available_stock > 0)
    }

    return results
  },

  /**
   * Localiza um produto por código de barras exato ou SKU (ideal para leitor USB / bip).
   */
  async findByBarcodeOrSku(
    companyId: string,
    branchId: string,
    code: string
  ): Promise<ProductWithBranchStock | null> {
    if (!supabase || !code.trim()) return null
    const clean = code.trim()

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .or(`barcode.eq.${clean},sku.eq.${clean}`)
      .maybeSingle()

    if (error || !data) {
      // Tenta fallback com ilike para código
      const { data: fallback } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .or(`barcode.ilike.%${clean}%,sku.ilike.%${clean}%`)
        .limit(1)
        .maybeSingle()

      if (!fallback) return null

      // Busca estoque da filial para o produto
      const { data: stock } = await supabase
        .from('branch_stock')
        .select('quantity, reserved_quantity')
        .eq('company_id', companyId)
        .eq('branch_id', branchId)
        .eq('product_id', fallback.id)
        .maybeSingle()

      const qty = Number(stock?.quantity || 0)
      const res = Number(stock?.reserved_quantity || 0)

      return {
        ...fallback,
        cost_price: Number(fallback.cost_price || 0),
        sale_price: Number(fallback.sale_price || 0),
        wholesale_price: fallback.wholesale_price ? Number(fallback.wholesale_price) : null,
        wholesale_min_qty: fallback.wholesale_min_qty ? Number(fallback.wholesale_min_qty) : null,
        max_discount_percentage: fallback.max_discount_percentage ? Number(fallback.max_discount_percentage) : 0,
        min_stock: Number(fallback.min_stock || 0),
        current_stock: qty,
        reserved_stock: res,
        available_stock: Math.max(0, qty - res),
      } as ProductWithBranchStock
    }

    const { data: stock } = await supabase
      .from('branch_stock')
      .select('quantity, reserved_quantity')
      .eq('company_id', companyId)
      .eq('branch_id', branchId)
      .eq('product_id', data.id)
      .maybeSingle()

    const qty = Number(stock?.quantity || 0)
    const res = Number(stock?.reserved_quantity || 0)

    return {
      ...data,
      cost_price: Number(data.cost_price || 0),
      sale_price: Number(data.sale_price || 0),
      wholesale_price: data.wholesale_price ? Number(data.wholesale_price) : null,
      wholesale_min_qty: data.wholesale_min_qty ? Number(data.wholesale_min_qty) : null,
      max_discount_percentage: data.max_discount_percentage ? Number(data.max_discount_percentage) : 0,
      min_stock: Number(data.min_stock || 0),
      current_stock: qty,
      reserved_stock: res,
      available_stock: Math.max(0, qty - res),
    } as ProductWithBranchStock
  },

  /**
   * Obtém categorias e marcas únicas cadastradas para alimentar os filtros.
   */
  async getCategoriesAndBrands(companyId: string): Promise<{ categories: string[]; brands: string[] }> {
    if (!supabase) return { categories: [], brands: [] }

    const catSet = new Set<string>()
    const brandSet = new Set<string>()

    // 1. Busca da tabela oficial categories
    try {
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('name')
        .eq('company_id', companyId)
        .eq('status', 'active')

      if (categoriesData) {
        for (const c of categoriesData) {
          if (c.name && c.name.trim()) catSet.add(c.name.trim())
        }
      }
    } catch {
      // Tabela ainda não criada, segue para fallback
    }

    // 2. Busca da tabela oficial brands
    try {
      const { data: brandsData } = await supabase
        .from('brands')
        .select('name')
        .eq('company_id', companyId)
        .eq('status', 'active')

      if (brandsData) {
        for (const b of brandsData) {
          if (b.name && b.name.trim()) brandSet.add(b.name.trim())
        }
      }
    } catch {
      // Tabela ainda não criada
    }

    // 3. Busca de produtos cadastrados (compatibilidade)
    const { data } = await supabase
      .from('products')
      .select('category, brand')
      .eq('company_id', companyId)
      .eq('status', 'active')

    if (data) {
      for (const row of data) {
        if (row.category && row.category.trim()) catSet.add(row.category.trim())
        if (row.brand && row.brand.trim()) brandSet.add(row.brand.trim())
      }
    }

    return {
      categories: Array.from(catSet).sort(),
      brands: Array.from(brandSet).sort(),
    }
  },

  /**
   * Exclui um produto do catálogo.
   * Remove o estoque na branch_stock e exclui da tabela products.
   * Caso haja restrição de FK ou RLS, aplica fallback seguro para status 'inactive'.
   */
  async deleteProduct(companyId: string, productId: string): Promise<boolean> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    // 1. Tenta limpar branch_stock
    try {
      await supabase
        .from('branch_stock')
        .delete()
        .eq('company_id', companyId)
        .eq('product_id', productId)
    } catch (e) {
      console.warn('Aviso ao remover branch_stock:', e)
    }

    // 2. Tenta hard delete na tabela products
    const { error: hardDeleteErr } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('company_id', companyId)

    if (hardDeleteErr) {
      console.warn('Hard delete falhou, aplicando desativação do produto (soft-delete):', hardDeleteErr)
      const { error: softDeleteErr } = await supabase
        .from('products')
        .update({ status: 'inactive' })
        .eq('id', productId)
        .eq('company_id', companyId)

      if (softDeleteErr) {
        throw new Error(softDeleteErr.message || 'Erro ao excluir/desativar produto.')
      }
    }

    return true
  },

  /**
   * Exclui todos os produtos cadastrados da empresa atual (útil para limpar dados de teste/mock).
   */
  async clearAllProducts(companyId: string): Promise<number> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    // Busca todos os produtos da empresa
    const { data: prods } = await supabase
      .from('products')
      .select('id')
      .eq('company_id', companyId)

    if (!prods || prods.length === 0) return 0

    const ids = prods.map((p) => p.id)

    // Remove estoque
    try {
      await supabase
        .from('branch_stock')
        .delete()
        .eq('company_id', companyId)
        .in('product_id', ids)
    } catch (e) {
      console.warn('Aviso ao limpar branch_stock:', e)
    }

    // Tenta hard delete em lote
    const { error: hardErr } = await supabase
      .from('products')
      .delete()
      .eq('company_id', companyId)

    if (hardErr) {
      console.warn('Hard delete em lote falhou, aplicando soft-delete:', hardErr)
      await supabase
        .from('products')
        .update({ status: 'inactive' })
        .eq('company_id', companyId)
    }

    return prods.length
  },

  /**
   * Cria um produto individual real no catálogo com saldo inicial opcional para a filial ativa.
   */
  async createProduct(
    companyId: string,
    branchId: string,
    data: {
      name: string
      sku?: string | null
      barcode?: string | null
      category?: string | null
      category_id?: string | null
      brand?: string | null
      brand_id?: string | null
      image_url?: string | null
      unit?: string
      cost_price?: number
      sale_price: number
      wholesale_price?: number | null
      wholesale_min_qty?: number | null
      max_discount_percentage?: number | null
      min_stock?: number
      initial_stock?: number
    }
  ): Promise<any> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    const payload: any = {
      company_id: companyId,
      name: data.name.trim(),
      sku: data.sku?.trim() || null,
      barcode: data.barcode?.trim() || null,
      category: data.category?.trim() || null,
      category_id: data.category_id || null,
      brand: data.brand?.trim() || null,
      brand_id: data.brand_id || null,
      image_url: data.image_url?.trim() || null,
      unit: (data.unit?.trim() || 'UN').toUpperCase(),
      cost_price: Math.max(0, Number(data.cost_price || 0)),
      sale_price: Math.max(0, Number(data.sale_price || 0)),
      wholesale_price:
        data.wholesale_price && Number(data.wholesale_price) > 0
          ? Number(data.wholesale_price)
          : null,
      wholesale_min_qty:
        data.wholesale_min_qty && Number(data.wholesale_min_qty) > 0
          ? Number(data.wholesale_min_qty)
          : null,
      max_discount_percentage:
        data.max_discount_percentage && Number(data.max_discount_percentage) > 0
          ? Math.min(100, Math.max(0, Number(data.max_discount_percentage)))
          : 0,
      min_stock: Math.max(0, Number(data.min_stock || 0)),
      status: 'active',
    }

    let inserted: any = null
    const { data: resData, error: insertError } = await supabase
      .from('products')
      .insert(payload)
      .select('*')
      .single()

    if (insertError) {
      // Se der erro de coluna inexistente (max_discount_percentage, category_id ou brand_id), tenta sem elas
      let needRetry = false
      if (insertError.message?.includes('max_discount_percentage')) {
        delete payload.max_discount_percentage
        needRetry = true
      }
      if (insertError.message?.includes('category_id')) {
        delete payload.category_id
        needRetry = true
      }
      if (insertError.message?.includes('brand_id')) {
        delete payload.brand_id
        needRetry = true
      }

      if (needRetry) {
        const { data: retryData, error: retryErr } = await supabase
          .from('products')
          .insert(payload)
          .select('*')
          .single()
        if (retryErr) {
          console.error('Erro ao cadastrar produto:', retryErr)
          throw new Error(retryErr.message || 'Erro ao cadastrar produto.')
        }
        inserted = retryData
      } else {
        console.error('Erro ao cadastrar produto:', insertError)
        throw new Error(insertError.message || 'Erro ao cadastrar produto.')
      }
    } else {
      inserted = resData
    }

    // Se informou estoque inicial ou estoque mínimo, grava na filial ativa
    const initialQty = Number(data.initial_stock || 0)
    if (initialQty > 0 || Number(data.min_stock || 0) > 0) {
      const { error: stockErr } = await supabase.from('branch_stock').upsert(
        {
          company_id: companyId,
          branch_id: branchId,
          product_id: inserted.id,
          quantity: Math.max(0, initialQty),
          reserved_quantity: 0,
          min_stock: Number(data.min_stock || 0),
        },
        { onConflict: 'branch_id,product_id' }
      )

      if (stockErr) {
        console.warn('Aviso: Não foi possível gravar saldo inicial de estoque:', stockErr)
      }
    }

    return inserted
  },

  /**
   * Atualiza dados de um produto existente no catálogo e saldo na filial
   */
  async updateProduct(
    companyId: string,
    productId: string,
    branchId: string,
    data: {
      name: string
      sku?: string | null
      barcode?: string | null
      category?: string | null
      category_id?: string | null
      brand?: string | null
      brand_id?: string | null
      image_url?: string | null
      unit?: string
      cost_price?: number
      sale_price: number
      wholesale_price?: number | null
      wholesale_min_qty?: number | null
      max_discount_percentage?: number | null
      min_stock?: number
      current_stock?: number
    }
  ): Promise<any> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    const payload: any = {
      name: data.name.trim(),
      sku: data.sku?.trim() || null,
      barcode: data.barcode?.trim() || null,
      category: data.category?.trim() || null,
      category_id: data.category_id || null,
      brand: data.brand?.trim() || null,
      brand_id: data.brand_id || null,
      image_url: data.image_url?.trim() || null,
      unit: (data.unit?.trim() || 'UN').toUpperCase(),
      cost_price: Math.max(0, Number(data.cost_price || 0)),
      sale_price: Math.max(0, Number(data.sale_price || 0)),
      wholesale_price:
        data.wholesale_price && Number(data.wholesale_price) > 0
          ? Number(data.wholesale_price)
          : null,
      wholesale_min_qty:
        data.wholesale_min_qty && Number(data.wholesale_min_qty) > 0
          ? Number(data.wholesale_min_qty)
          : null,
      max_discount_percentage:
        data.max_discount_percentage && Number(data.max_discount_percentage) > 0
          ? Math.min(100, Math.max(0, Number(data.max_discount_percentage)))
          : 0,
      min_stock: Math.max(0, Number(data.min_stock || 0)),
    }

    let updated: any = null
    const { data: resData, error: updateError } = await supabase
      .from('products')
      .update(payload)
      .eq('id', productId)
      .eq('company_id', companyId)
      .select('*')
      .single()

    if (updateError) {
      let needRetry = false
      if (updateError.message?.includes('max_discount_percentage')) {
        delete payload.max_discount_percentage
        needRetry = true
      }
      if (updateError.message?.includes('category_id')) {
        delete payload.category_id
        needRetry = true
      }
      if (updateError.message?.includes('brand_id')) {
        delete payload.brand_id
        needRetry = true
      }

      if (needRetry) {
        const { data: retryData, error: retryErr } = await supabase
          .from('products')
          .update(payload)
          .eq('id', productId)
          .eq('company_id', companyId)
          .select('*')
          .single()
        if (retryErr) {
          console.error('Erro ao atualizar produto:', retryErr)
          throw new Error(retryErr.message || 'Erro ao atualizar produto.')
        }
        updated = retryData
      } else {
        console.error('Erro ao atualizar produto:', updateError)
        throw new Error(updateError.message || 'Erro ao atualizar produto.')
      }
    } else {
      updated = resData
    }

    // Se informou estoque ou estoque mínimo, atualiza no branch_stock da filial ativa
    if (branchId && (data.current_stock !== undefined || data.min_stock !== undefined)) {
      const stockPayload: any = {
        company_id: companyId,
        branch_id: branchId,
        product_id: productId,
      }
      if (data.current_stock !== undefined) {
        stockPayload.quantity = Math.max(0, Number(data.current_stock))
      }
      if (data.min_stock !== undefined) {
        stockPayload.min_stock = Math.max(0, Number(data.min_stock))
      }

      const { error: stockErr } = await supabase
        .from('branch_stock')
        .upsert(stockPayload, { onConflict: 'branch_id,product_id' })

      if (stockErr) {
        console.warn('Aviso ao atualizar estoque da filial:', stockErr)
      }
    }

    return updated
  },

  /**
   * Consulta produtos existentes na empresa pelo SKU ou Código de Barras para prévia e detecção de duplicidade
   */
  async checkExistingProducts(
    companyId: string,
    items: Array<{ sku?: string | null; barcode?: string | null }>
  ): Promise<Map<string, { id: string; name: string; sku?: string | null; barcode?: string | null; sale_price?: number; cost_price?: number }>> {
    if (!supabase) throw new Error('Supabase client não configurado.')
    const existingMap = new Map<string, { id: string; name: string; sku?: string | null; barcode?: string | null; sale_price?: number; cost_price?: number }>()

    const skus = Array.from(new Set(items.map((i) => i.sku?.trim()).filter((s): s is string => !!s)))
    const barcodes = Array.from(new Set(items.map((i) => i.barcode?.trim()).filter((b): b is string => !!b)))

    if (skus.length === 0 && barcodes.length === 0) return existingMap

    try {
      // Divide em lotes para respeitar limites de URL do PostgREST
      const chunkSize = 150
      for (let i = 0; i < Math.max(skus.length, barcodes.length); i += chunkSize) {
        const skuChunk = skus.slice(i, i + chunkSize)
        const barcodeChunk = barcodes.slice(i, i + chunkSize)

        let query = supabase
          .from('products')
          .select('id, name, sku, barcode, sale_price, cost_price')
          .eq('company_id', companyId)

        const orClauses: string[] = []
        if (skuChunk.length > 0) {
          orClauses.push(`sku.in.(${skuChunk.map((s) => `"${s}"`).join(',')})`)
        }
        if (barcodeChunk.length > 0) {
          orClauses.push(`barcode.in.(${barcodeChunk.map((b) => `"${b}"`).join(',')})`)
        }

        if (orClauses.length > 0) {
          query = query.or(orClauses.join(','))
          const { data, error } = await query
          if (!error && data) {
            for (const p of data) {
              if (p.sku) existingMap.set(`sku:${p.sku.toLowerCase()}`, p)
              if (p.barcode) existingMap.set(`barcode:${p.barcode}`, p)
            }
          }
        }
      }
    } catch (err) {
      console.warn('Aviso ao consultar duplicidades de produtos:', err)
    }

    return existingMap
  },

  /**
   * Importa em lote produtos reais a partir de planilha (XLS/XLSX/CSV).
   * Suporta cadastro de novos produtos e atualização não destrutiva de produtos existentes.
   */
  async importProductsBatch(
    companyId: string,
    branchId: string,
    items: Array<{
      name: string
      sku?: string | null
      barcode?: string | null
      category?: string | null
      brand?: string | null
      unit?: string
      cost_price?: number
      sale_price: number
      wholesale_price?: number | null
      wholesale_min_qty?: number | null
      min_stock?: number
      initial_stock?: number
    }>,
    options: {
      updateExisting?: boolean
    } = { updateExisting: true }
  ): Promise<{ importedCount: number; updatedCount: number; errors: string[] }> {
    if (!supabase) throw new Error('Supabase client não configurado.')
    if (items.length === 0) return { importedCount: 0, updatedCount: 0, errors: [] }

    const errors: string[] = []
    let importedCount = 0
    let updatedCount = 0

    // 1. Identifica produtos já existentes na empresa
    const existingMap = await this.checkExistingProducts(companyId, items)

    const itemsToInsert: typeof items = []
    const itemsToUpdate: Array<{ existingId: string; item: (typeof items)[0] }> = []

    for (const item of items) {
      let existingMatch: { id: string } | undefined
      if (item.sku && existingMap.has(`sku:${item.sku.toLowerCase()}`)) {
        existingMatch = existingMap.get(`sku:${item.sku.toLowerCase()}`)
      } else if (item.barcode && existingMap.has(`barcode:${item.barcode}`)) {
        existingMatch = existingMap.get(`barcode:${item.barcode}`)
      }

      if (existingMatch) {
        if (options.updateExisting !== false) {
          itemsToUpdate.push({ existingId: existingMatch.id, item })
        }
      } else {
        itemsToInsert.push(item)
      }
    }

    // 2. Executa inserções dos novos produtos em lotes
    const batchSize = 50
    for (let i = 0; i < itemsToInsert.length; i += batchSize) {
      const chunk = itemsToInsert.slice(i, i + batchSize)

      const productsToInsert = chunk.map((item) => ({
        company_id: companyId,
        name: item.name.trim(),
        sku: item.sku?.trim() || null,
        barcode: item.barcode?.trim() || null,
        category: item.category?.trim() || null,
        brand: item.brand?.trim() || null,
        unit: (item.unit?.trim() || 'UN').toUpperCase(),
        cost_price: Math.max(0, Number(item.cost_price || 0)),
        sale_price: Math.max(0, Number(item.sale_price || 0)),
        wholesale_price:
          item.wholesale_price && Number(item.wholesale_price) > 0
            ? Number(item.wholesale_price)
            : null,
        wholesale_min_qty:
          item.wholesale_min_qty && Number(item.wholesale_min_qty) > 0
            ? Number(item.wholesale_min_qty)
            : null,
        min_stock: Math.max(0, Number(item.min_stock || 0)),
        status: 'active',
      }))

      const { data: inserted, error: insertError } = await supabase
        .from('products')
        .insert(productsToInsert)
        .select('id, name, min_stock, sku')

      if (insertError) {
        console.error('Erro ao importar lote de novos produtos:', insertError)
        errors.push(`Erro no lote de inclusão ${Math.floor(i / batchSize) + 1}: ${insertError.message}`)
        continue
      }

      if (inserted && inserted.length > 0) {
        importedCount += inserted.length

        // Mapeia os saldos de estoque inicial para a filial ativa
        const stockPayloads: any[] = []
        for (let j = 0; j < inserted.length; j++) {
          const insertedProd = inserted[j]
          const originalItem = chunk[j]
          const initialQty = Number(originalItem.initial_stock || 0)

          if (initialQty > 0 || insertedProd.min_stock > 0) {
            stockPayloads.push({
              company_id: companyId,
              branch_id: branchId,
              product_id: insertedProd.id,
              quantity: Math.max(0, initialQty),
              reserved_quantity: 0,
              min_stock: insertedProd.min_stock || 0,
            })
          }
        }

        if (stockPayloads.length > 0) {
          const { error: stockErr } = await supabase
            .from('branch_stock')
            .upsert(stockPayloads, { onConflict: 'branch_id,product_id' })

          if (stockErr) {
            console.warn('Aviso: Erro ao inserir saldo inicial de estoque:', stockErr)
          }
        }
      }
    }

    // 3. Executa atualizações não-destrutivas de produtos existentes
    for (const updateEntry of itemsToUpdate) {
      try {
        const item = updateEntry.item
        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        }

        // Não sobrescreve com valores vazios
        if (item.name && item.name.trim()) updatePayload.name = item.name.trim()
        if (item.cost_price && item.cost_price > 0) updatePayload.cost_price = Number(item.cost_price)
        if (item.sale_price && item.sale_price > 0) updatePayload.sale_price = Number(item.sale_price)
        if (item.unit && item.unit.trim()) updatePayload.unit = item.unit.trim().toUpperCase()
        if (item.barcode && item.barcode.trim()) updatePayload.barcode = item.barcode.trim()
        if (item.category && item.category.trim()) updatePayload.category = item.category.trim()
        if (item.brand && item.brand.trim()) updatePayload.brand = item.brand.trim()
        if (item.min_stock && item.min_stock > 0) updatePayload.min_stock = Number(item.min_stock)
        if (item.wholesale_price && item.wholesale_price > 0) updatePayload.wholesale_price = Number(item.wholesale_price)
        if (item.wholesale_min_qty && item.wholesale_min_qty > 0) updatePayload.wholesale_min_qty = Number(item.wholesale_min_qty)

        const { error: updErr } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', updateEntry.existingId)

        if (!updErr) {
          updatedCount++

          // Se forneceu estoque inicial, atualiza o estoque na filial
          const initialQty = Number(item.initial_stock || 0)
          if (initialQty > 0) {
            await supabase
              .from('branch_stock')
              .upsert(
                {
                  company_id: companyId,
                  branch_id: branchId,
                  product_id: updateEntry.existingId,
                  quantity: initialQty,
                  reserved_quantity: 0,
                  min_stock: Number(item.min_stock || 0),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'branch_id,product_id' }
              )
          }
        } else {
          errors.push(`Erro ao atualizar produto "${item.name}": ${updErr.message}`)
        }
      } catch (ex: any) {
        errors.push(`Falha ao atualizar produto "${updateEntry.item.name}": ${ex.message}`)
      }
    }

    return {
      importedCount,
      updatedCount,
      errors,
    }
  },
}
