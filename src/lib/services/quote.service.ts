import { supabase } from '@/lib/supabase'
import type {
  Quote,
  QuoteItem,
  QuoteFormData,
  QuoteFilters,
  QuoteKpis,
  QuoteStatus,
  QuoteStatusHistory,
} from '@/types/quote'

export const quoteService = {
  /**
   * Lista os orçamentos da empresa com suporte a paginação, filtros e relações.
   */
  async listQuotes(
    companyId: string,
    filters?: QuoteFilters
  ): Promise<{ data: Quote[]; totalCount: number }> {
    if (!supabase) return { data: [], totalCount: 0 }

    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('quotes')
      .select(
        `
        id,
        company_id,
        branch_id,
        quote_number,
        code,
        customer_id,
        customer_name,
        customer_document,
        customer_email,
        customer_phone,
        user_id,
        status,
        subtotal,
        discount_type,
        discount_value,
        discount_amount,
        total,
        notes,
        valid_until,
        converted_at,
        converted_to_sale_id,
        created_at,
        updated_at,
        branch:branches (id, name, code),
        customer:customers (id, name, document, phone, email, credit_limit, credit_status)
      `,
        { count: 'exact' }
      )
      .eq('company_id', companyId)

    if (filters?.branchId && filters.branchId !== 'all') {
      query = query.eq('branch_id', filters.branchId)
    }

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId)
    }

    if (filters?.dateFrom) {
      query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`)
    }

    if (filters?.dateTo) {
      query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`)
    }

    if (filters?.search && filters.search.trim()) {
      const s = filters.search.trim()
      query = query.or(
        `code.ilike.%${s}%,customer_name.ilike.%${s}%,customer_document.ilike.%${s}%`
      )
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Erro ao listar orçamentos:', error)
      throw new Error(error.message || 'Erro ao carregar lista de orçamentos.')
    }

    const quotes: Quote[] = (data || []).map((row: any) => ({
      ...row,
      subtotal: Number(row.subtotal || 0),
      discount_value: Number(row.discount_value || 0),
      discount_amount: Number(row.discount_amount || 0),
      total: Number(row.total || 0),
      branch: Array.isArray(row.branch) ? row.branch[0] : row.branch,
      customer: Array.isArray(row.customer) ? row.customer[0] : row.customer,
    }))

    return {
      data: quotes,
      totalCount: count || 0,
    }
  },

  /**
   * Obtém detalhes completos de um orçamento com seus itens e histórico.
   */
  async getQuote(quoteId: string, companyId: string): Promise<Quote | null> {
    if (!supabase) return null

    const { data, error } = await supabase
      .from('quotes')
      .select(
        `
        id,
        company_id,
        branch_id,
        quote_number,
        code,
        customer_id,
        customer_name,
        customer_document,
        customer_email,
        customer_phone,
        user_id,
        status,
        subtotal,
        discount_type,
        discount_value,
        discount_amount,
        total,
        notes,
        valid_until,
        converted_at,
        converted_to_sale_id,
        created_at,
        updated_at,
        branch:branches (id, name, code),
        customer:customers (id, name, document, phone, email, credit_limit, credit_status),
        items:quote_items (
          id,
          quote_id,
          product_id,
          product_name,
          product_sku,
          product_barcode,
          unit,
          quantity,
          unit_price,
          price_type,
          discount,
          subtotal,
          total,
          notes,
          created_at,
          product:products (id, name, sku, barcode, wholesale_price, wholesale_min_qty, sale_price)
        )
      `
      )
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Erro ao carregar orçamento:', error)
      throw new Error(error.message || 'Falha ao buscar dados do orçamento.')
    }

    if (!data) return null

    const items: QuoteItem[] = (data.items || []).map((it: any) => ({
      ...it,
      quantity: Number(it.quantity || 0),
      unit_price: Number(it.unit_price || 0),
      discount: Number(it.discount || 0),
      subtotal: Number(it.subtotal || 0),
      total: Number(it.total || 0),
      product: Array.isArray(it.product) ? it.product[0] : it.product,
    }))

    return {
      ...data,
      subtotal: Number(data.subtotal || 0),
      discount_value: Number(data.discount_value || 0),
      discount_amount: Number(data.discount_amount || 0),
      total: Number(data.total || 0),
      branch: Array.isArray(data.branch) ? data.branch[0] : data.branch,
      customer: Array.isArray(data.customer) ? data.customer[0] : data.customer,
      items,
    } as Quote
  },

  /**
   * Salva ou atualiza um orçamento com recálculo seguro no backend (RPC save_quote).
   */
  async saveQuote(formData: QuoteFormData): Promise<{ quote_id: string; code: string }> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    // 1. Tenta executar via RPC atômico
    try {
      const { data, error } = await supabase.rpc('save_quote', {
        p_payload: formData,
      })

      if (!error && data?.quote_id) {
        return {
          quote_id: data.quote_id,
          code: data.code,
        }
      }

      if (error && !error.message?.includes('function save_quote() does not exist')) {
        console.error('Erro RPC save_quote:', error)
        throw new Error(error.message || 'Erro ao processar orçamento.')
      }
    } catch (rpcErr: any) {
      // Se for erro de validação do próprio RPC, repassa para o usuário
      if (
        rpcErr.message &&
        !rpcErr.message.includes('does not exist') &&
        !rpcErr.message.includes('Failed to fetch')
      ) {
        throw rpcErr
      }
    }

    // 2. Fallback caso a migration RPC ainda não tenha sido aplicada no servidor
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) throw new Error('Usuário não autenticado.')

    // Recalcula itens com base nos produtos cadastrados
    let subtotalCalc = 0
    const calculatedItems = []

    for (const it of formData.items) {
      const { data: prod } = await supabase
        .from('products')
        .select('*')
        .eq('id', it.product_id)
        .single()

      if (!prod) throw new Error(`Produto não localizado: ${it.product_id}`)

      let unitPrice = Number(it.unit_price ?? prod.sale_price)
      let priceType = 'retail'

      // Regra de atacado
      if (
        prod.wholesale_price &&
        prod.wholesale_min_qty &&
        it.quantity >= Number(prod.wholesale_min_qty)
      ) {
        unitPrice = Number(prod.wholesale_price)
        priceType = 'wholesale'
      }

      const itemDisc = Math.max(0, Number(it.discount || 0))
      const itemSub = Math.round(unitPrice * it.quantity * 100) / 100
      const itemTot = Math.max(0, Math.round((itemSub - itemDisc) * 100) / 100)

      subtotalCalc += itemSub
      calculatedItems.push({
        product_id: prod.id,
        product_name: prod.name,
        product_sku: prod.sku,
        product_barcode: prod.barcode,
        unit: prod.unit || 'UN',
        quantity: it.quantity,
        unit_price: unitPrice,
        price_type: priceType,
        discount: itemDisc,
        subtotal: itemSub,
        total: itemTot,
        notes: it.notes || null,
      })
    }

    let discountAmount = 0
    if (formData.discount_type === 'percentage') {
      discountAmount = Math.round((subtotalCalc * (formData.discount_value / 100)) * 100) / 100
    } else {
      discountAmount = Math.min(subtotalCalc, Number(formData.discount_value || 0))
    }

    const totalCalc = Math.max(0, Math.round((subtotalCalc - discountAmount) * 100) / 100)

    if (formData.id) {
      // Edição
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .update({
          customer_id: formData.customer_id || null,
          customer_name: formData.customer_name || null,
          customer_document: formData.customer_document || null,
          customer_email: formData.customer_email || null,
          customer_phone: formData.customer_phone || null,
          status: formData.status,
          subtotal: subtotalCalc,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          discount_amount: discountAmount,
          total: totalCalc,
          notes: formData.notes || null,
          valid_until: formData.valid_until,
          updated_at: new Date().toISOString(),
        })
        .eq('id', formData.id)
        .eq('company_id', formData.company_id)
        .select()
        .single()

      if (quoteError) throw new Error(quoteError.message || 'Erro ao atualizar orçamento.')

      // Remove itens antigos e reinsere
      await supabase.from('quote_items').delete().eq('quote_id', formData.id)
      const itemsToInsert = calculatedItems.map((ci) => ({
        ...ci,
        quote_id: formData.id,
      }))
      await supabase.from('quote_items').insert(itemsToInsert)

      return { quote_id: formData.id, code: quote.code }
    } else {
      // Novo Orçamento
      const randCode = Math.floor(1000 + Math.random() * 9000)
      const code = `ORC-${randCode}`

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          company_id: formData.company_id,
          branch_id: formData.branch_id,
          code,
          customer_id: formData.customer_id || null,
          customer_name: formData.customer_name || null,
          customer_document: formData.customer_document || null,
          customer_email: formData.customer_email || null,
          customer_phone: formData.customer_phone || null,
          user_id: user.id,
          status: formData.status,
          subtotal: subtotalCalc,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          discount_amount: discountAmount,
          total: totalCalc,
          notes: formData.notes || null,
          valid_until: formData.valid_until,
        })
        .select()
        .single()

      if (quoteError) throw new Error(quoteError.message || 'Erro ao criar orçamento.')

      const itemsToInsert = calculatedItems.map((ci) => ({
        ...ci,
        quote_id: quote.id,
      }))
      await supabase.from('quote_items').insert(itemsToInsert)

      // Registra status history
      await supabase.from('quote_status_history').insert({
        quote_id: quote.id,
        company_id: formData.company_id,
        previous_status: null,
        new_status: formData.status,
        reason: 'Criação inicial do orçamento',
        user_id: user.id,
      })

      return { quote_id: quote.id, code: quote.code }
    }
  },

  /**
   * Altera status do orçamento com registro no histórico de auditoria.
   */
  async updateQuoteStatus(
    quoteId: string,
    newStatus: QuoteStatus,
    reason?: string
  ): Promise<void> {
    if (!supabase) return

    // 1. Tenta via RPC
    try {
      const { data, error } = await supabase.rpc('update_quote_status', {
        p_quote_id: quoteId,
        p_new_status: newStatus,
        p_reason: reason || null,
      })

      if (!error && data?.success) return
    } catch {
      // Continua para fallback
    }

    // 2. Fallback direto
    const { data: current } = await supabase
      .from('quotes')
      .select('status, company_id')
      .eq('id', quoteId)
      .single()

    if (current?.status === 'converted') {
      throw new Error('Não é permitido alterar um orçamento já convertido em venda.')
    }

    const { error } = await supabase
      .from('quotes')
      .update({
        status: newStatus,
        converted_at: newStatus === 'converted' ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)

    if (error) {
      throw new Error(error.message || 'Falha ao alterar status do orçamento.')
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (current) {
      await supabase.from('quote_status_history').insert({
        quote_id: quoteId,
        company_id: current.company_id,
        previous_status: current.status,
        new_status: newStatus,
        reason: reason || 'Atualização de status',
        user_id: user?.id || null,
      })
    }
  },

  /**
   * Duplica um orçamento existente como um novo rascunho com nova numeração.
   */
  async duplicateQuote(quoteId: string, companyId: string): Promise<string> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    // Tenta via RPC
    try {
      const { data, error } = await supabase.rpc('duplicate_quote', {
        p_quote_id: quoteId,
      })

      if (!error && data?.new_quote_id) {
        return data.new_quote_id
      }
    } catch {
      // Fallback manual
    }

    // Fallback manual
    const original = await this.getQuote(quoteId, companyId)
    if (!original) throw new Error('Orçamento não encontrado.')

    const result = await this.saveQuote({
      company_id: original.company_id,
      branch_id: original.branch_id,
      customer_id: original.customer_id,
      customer_name: original.customer_name,
      customer_document: original.customer_document,
      customer_email: original.customer_email,
      customer_phone: original.customer_phone,
      status: 'draft',
      discount_type: original.discount_type,
      discount_value: original.discount_value,
      notes: original.notes,
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      items: (original.items || []).map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount: it.discount,
        notes: it.notes || undefined,
      })),
    })

    return result.quote_id
  },

  /**
   * Exclui um orçamento (apenas permitido se não estiver convertido em venda).
   */
  async deleteQuote(quoteId: string, companyId: string): Promise<void> {
    if (!supabase) return

    const { data: q } = await supabase
      .from('quotes')
      .select('status')
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .single()

    if (q?.status === 'converted') {
      throw new Error('Não é permitido excluir um orçamento já convertido em venda.')
    }

    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quoteId)
      .eq('company_id', companyId)

    if (error) {
      throw new Error(error.message || 'Erro ao excluir orçamento.')
    }
  },

  /**
   * Busca o histórico de status de um orçamento.
   */
  async getQuoteHistory(quoteId: string): Promise<QuoteStatusHistory[]> {
    if (!supabase) return []

    const { data, error } = await supabase
      .from('quote_status_history')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar histórico do orçamento:', error)
      return []
    }

    return (data || []).map((h: any) => ({
      ...h,
    }))
  },

  /**
   * Calcula indicadores chave (KPIs) de orçamentos para a empresa/filial.
   */
  async fetchQuoteKpis(companyId: string, branchId?: string): Promise<QuoteKpis> {
    if (!supabase) {
      return {
        totalQuotes: 0,
        draftCount: 0,
        sentCount: 0,
        approvedCount: 0,
        convertedCount: 0,
        rejectedOrExpiredCount: 0,
        totalValue: 0,
        conversionRate: 0,
      }
    }

    try {
      let query = supabase
        .from('quotes')
        .select('id, status, total')
        .eq('company_id', companyId)

      if (branchId && branchId !== 'all') {
        query = query.eq('branch_id', branchId)
      }

      const { data } = await query

      let totalQuotes = 0
      let draftCount = 0
      let sentCount = 0
      let approvedCount = 0
      let convertedCount = 0
      let rejectedOrExpiredCount = 0
      let totalValue = 0

      if (data) {
        totalQuotes = data.length
        for (const q of data) {
          totalValue += Number(q.total || 0)
          if (q.status === 'draft') draftCount++
          else if (q.status === 'sent') sentCount++
          else if (q.status === 'approved') approvedCount++
          else if (q.status === 'converted') convertedCount++
          else if (q.status === 'rejected' || q.status === 'expired') rejectedOrExpiredCount++
        }
      }

      const closed = approvedCount + convertedCount + rejectedOrExpiredCount
      const conversionRate = closed > 0 ? Math.round((convertedCount / closed) * 100) : 0

      return {
        totalQuotes,
        draftCount,
        sentCount,
        approvedCount,
        convertedCount,
        rejectedOrExpiredCount,
        totalValue,
        conversionRate,
      }
    } catch (err) {
      console.error('Erro ao calcular KPIs de orçamentos:', err)
      return {
        totalQuotes: 0,
        draftCount: 0,
        sentCount: 0,
        approvedCount: 0,
        convertedCount: 0,
        rejectedOrExpiredCount: 0,
        totalValue: 0,
        conversionRate: 0,
      }
    }
  },
}
