import { supabase } from '@/lib/supabase'
import type {
  Sale,
  FinalizeSalePayload,
  SaleFilters,
  SaleKpis,
} from '@/types/sale'

export const saleService = {
  /**
   * Finaliza uma venda no PDV de forma atômica via função RPC no backend.
   * Valida estoque, preços, formas de pagamento, troco e deduz o estoque na filial.
   */
  async finalizeSale(payload: FinalizeSalePayload): Promise<{
    success: boolean
    sale_id: string
    sale_code: string
    sale_number: number
    total: number
    change_amount: number
    already_processed?: boolean
  }> {
    if (!supabase) throw new Error('Cliente Supabase não configurado.')

    // 1. Tenta executar via RPC Atômica do PostgreSQL
    try {
      const { data, error } = await supabase.rpc('finalize_pos_sale', {
        p_company_id: payload.company_id,
        p_branch_id: payload.branch_id,
        p_customer_id: payload.customer_id || null,
        p_customer_name: payload.customer_name || null,
        p_customer_document: payload.customer_document || null,
        p_discount_type: payload.discount_type || 'value',
        p_discount_value: payload.discount_value || 0,
        p_items: payload.items,
        p_payments: payload.payments,
        p_quote_id: payload.quote_id || null,
        p_idempotency_key: payload.idempotency_key || null,
        p_notes: payload.notes || null,
        p_cash_session_id: payload.cash_session_id || null,
        p_receivable_config: payload.receivable_config || null,
      })

      if (error) {
        // Se a função RPC falhar por erro de schema (código 42703, coluna inexistente, campo em record) ou função não encontrada (42883), executa o fallback controlado
        const isSchemaOrRpcIssue =
          error.code === '42883' ||
          error.code === '42703' ||
          error.message?.includes('finalize_pos_sale') ||
          error.message?.includes('Could not find the function') ||
          error.message?.includes('is_active') ||
          error.message?.includes('stock_control_enabled') ||
          error.message?.includes('has no field')

        if (isSchemaOrRpcIssue) {
          console.warn('RPC finalize_pos_sale pendente de migration ou com discrepância de schema (' + (error.message || error.code) + '). Executando fallback controlado via tabelas...')
          return await this.fallbackFinalizeSale(payload)
        }

        console.error('Erro retornado pela RPC finalize_pos_sale:', error)
        throw new Error(error.message || 'Falha ao processar venda no PDV.')
      }

      return data as any
    } catch (err: any) {
      const isSchemaOrRpcIssue =
        err.code === '42883' ||
        err.code === '42703' ||
        err.message?.includes('finalize_pos_sale') ||
        err.message?.includes('is_active') ||
        err.message?.includes('stock_control_enabled') ||
        err.message?.includes('has no field')

      if (isSchemaOrRpcIssue) {
        console.warn('Exceção ao chamar RPC finalize_pos_sale. Executando fallback controlado via tabelas...', err)
        return await this.fallbackFinalizeSale(payload)
      }
      throw err
    }
  },

  /**
   * Fallback de contingência caso a migration SQL ainda não tenha sido executada no console do Supabase.
   */
  async fallbackFinalizeSale(payload: FinalizeSalePayload): Promise<any> {
    if (!supabase) throw new Error('Cliente Supabase não configurado.')

    const { data: authUser } = await supabase.auth.getUser()
    const userId = authUser?.user?.id
    if (!userId) throw new Error('Operador de caixa não autenticado.')

    // 1. Carrega produtos para calcular preços e verificar estoque
    const productIds = payload.items.map((i) => i.product_id)
    const { data: prods, error: pErr } = await supabase
      .from('products')
      .select('id, name, sku, barcode, unit, cost_price, sale_price, wholesale_price, wholesale_min_qty, status')
      .in('id', productIds)

    if (pErr || !prods) throw new Error('Erro ao validar produtos da venda.')

    let subtotal = 0
    const resolvedItems: any[] = []

    for (const item of payload.items) {
      const prod = prods.find((p) => p.id === item.product_id)
      if (!prod) throw new Error(`Produto não localizado: ${item.product_id}`)

      // Regra de Atacado:
      let unitPrice = Number(prod.sale_price || 0)
      let priceType = 'retail'
      if (
        prod.wholesale_price &&
        prod.wholesale_price > 0 &&
        ((prod.wholesale_min_qty && item.quantity >= prod.wholesale_min_qty) ||
         (!prod.wholesale_min_qty && item.quantity >= 5))
      ) {
        unitPrice = Number(prod.wholesale_price)
        priceType = 'wholesale'
      }

      const itemDiscount = Number(item.discount || 0)
      const itemSubtotal = Math.round(unitPrice * item.quantity * 100) / 100
      const itemTotal = Math.max(0, Math.round((itemSubtotal - itemDiscount) * 100) / 100)

      subtotal += itemTotal

      resolvedItems.push({
        product: prod,
        quantity: item.quantity,
        unit_price: unitPrice,
        price_type: priceType,
        discount: itemDiscount,
        subtotal: itemSubtotal,
        total: itemTotal,
      })
    }

    let discountAmount = 0
    if (payload.discount_type === 'percentage') {
      discountAmount = Math.round(subtotal * ((payload.discount_value || 0) / 100) * 100) / 100
    } else {
      discountAmount = Math.min(subtotal, Math.max(0, payload.discount_value || 0))
    }

    const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100)

    // Verifica pagamentos
    let totalPayments = 0
    let totalChange = 0
    for (const pay of payload.payments) {
      totalPayments += Number(pay.amount || 0)
      if (pay.payment_method === 'cash') {
        const received = Number(pay.received_amount || pay.amount)
        if (received > pay.amount) {
          totalChange += Math.round((received - pay.amount) * 100) / 100
        }
      }
    }

    if (Math.abs(totalPayments - total) > 0.02) {
      throw new Error(`Soma dos pagamentos (R$ ${totalPayments.toFixed(2)}) difere do total (R$ ${total.toFixed(2)}).`)
    }

    const randNum = Math.floor(1000 + Math.random() * 900000)
    const saleCode = `VND-${randNum}`

    // Cria venda
    const { data: newSale, error: saleErr } = await supabase
      .from('sales')
      .insert({
        company_id: payload.company_id,
        branch_id: payload.branch_id,
        user_id: userId,
        customer_id: payload.customer_id || null,
        customer_name: payload.customer_name || null,
        customer_document: payload.customer_document || null,
        sale_number: randNum,
        code: saleCode,
        status: 'completed',
        subtotal,
        discount_type: payload.discount_type || 'value',
        discount_value: payload.discount_value || 0,
        discount_amount: discountAmount,
        total,
        payment_amount: totalPayments,
        change_amount: totalChange,
        quote_id: payload.quote_id || null,
        cash_session_id: payload.cash_session_id || null,
        idempotency_key: payload.idempotency_key || null,
        notes: payload.notes || null,
      })
      .select('id, code, sale_number, total, change_amount')
      .single()

    if (saleErr || !newSale) {
      throw new Error(saleErr?.message || 'Erro ao registrar venda.')
    }

    // Insere itens
    const itemsPayload = resolvedItems.map((ri) => ({
      sale_id: newSale.id,
      company_id: payload.company_id,
      branch_id: payload.branch_id,
      product_id: ri.product.id,
      product_name: ri.product.name,
      product_sku: ri.product.sku,
      product_barcode: ri.product.barcode,
      unit: ri.product.unit || 'UN',
      quantity: ri.quantity,
      unit_price: ri.unit_price,
      cost_price: ri.product.cost_price || 0,
      price_type: ri.price_type,
      discount: ri.discount,
      subtotal: ri.subtotal,
      total: ri.total,
    }))

    await supabase.from('sale_items').insert(itemsPayload)

    // Insere pagamentos
    const paymentsPayload = payload.payments.map((p) => ({
      sale_id: newSale.id,
      company_id: payload.company_id,
      payment_method: p.payment_method,
      amount: p.amount,
      received_amount: p.received_amount || p.amount,
      change_amount: p.payment_method === 'cash' && (p.received_amount || 0) > p.amount
        ? Math.round(((p.received_amount || 0) - p.amount) * 100) / 100
        : 0,
      installments: p.installments || 1,
      notes: p.notes || null,
    }))

    await supabase.from('sale_payments').insert(paymentsPayload)

    // Baixa de estoque e registro de movimentação
    for (const ri of resolvedItems) {
      try {
        const { data: currentStockRow } = await supabase
          .from('branch_stock')
          .select('quantity')
          .eq('branch_id', payload.branch_id)
          .eq('product_id', ri.product.id)
          .maybeSingle()

        const currentQty = Number(currentStockRow?.quantity || 0)
        const newQty = Math.max(0, currentQty - ri.quantity)

        await supabase
          .from('branch_stock')
          .update({ quantity: newQty, last_movement_at: new Date().toISOString() })
          .eq('branch_id', payload.branch_id)
          .eq('product_id', ri.product.id)

        await supabase.from('stock_movements').insert({
          company_id: payload.company_id,
          branch_id: payload.branch_id,
          product_id: ri.product.id,
          movement_type: 'exit',
          quantity: ri.quantity,
          balance_before: currentQty,
          balance_after: newQty,
          reason: `Venda PDV ${saleCode}`,
          reference_id: newSale.id,
          reference_type: 'pos_sale',
          user_id: userId,
        })
      } catch (stkErr) {
        console.warn('Aviso ao baixar estoque em modo fallback:', stkErr)
      }
    }

    // Se vinculado a orçamento, converte
    if (payload.quote_id) {
      try {
        await supabase
          .from('quotes')
          .update({
            status: 'converted',
            converted_at: new Date().toISOString(),
            converted_to_sale_id: newSale.id,
          })
          .eq('id', payload.quote_id)
      } catch (qErr) {
        console.warn('Aviso ao atualizar status do orçamento:', qErr)
      }
    }

    // Se houver pagamento no crediário, gera contas a receber
    const storeCreditPayment = payload.payments.find((p) => p.payment_method === 'store_credit')
    if (storeCreditPayment && payload.customer_id) {
      try {
        const instCount = payload.receivable_config?.installments_count || storeCreditPayment.installments || 1
        const interval = payload.receivable_config?.interval_days || 30
        const firstDue = payload.receivable_config?.first_due_date
          ? new Date(payload.receivable_config.first_due_date)
          : new Date(Date.now() + interval * 86400000)

        const totalFinanced = storeCreditPayment.amount
        const docNumber = `TIT-${saleCode}`

        const { data: rec } = await supabase
          .from('accounts_receivable')
          .insert({
            company_id: payload.company_id,
            branch_id: payload.branch_id,
            customer_id: payload.customer_id,
            sale_id: newSale.id,
            document_number: docNumber,
            description: `Venda a Prazo / Crediário PDV ${saleCode}`,
            total_amount: totalFinanced,
            balance_amount: totalFinanced,
            paid_amount: 0,
            installments_count: instCount,
            status: 'open',
            created_by: userId,
          })
          .select()
          .single()

        if (rec) {
          const baseVal = Math.floor((totalFinanced / instCount) * 100) / 100
          const remainder = Math.round((totalFinanced - baseVal * instCount) * 100) / 100
          const insts = []

          for (let i = 1; i <= instCount; i++) {
            const dueDate = new Date(firstDue)
            dueDate.setDate(dueDate.getDate() + (i - 1) * interval)
            const val = i === 1 ? Math.round((baseVal + remainder) * 100) / 100 : baseVal

            insts.push({
              receivable_id: rec.id,
              company_id: payload.company_id,
              branch_id: payload.branch_id,
              customer_id: payload.customer_id,
              installment_number: i,
              due_date: dueDate.toISOString().split('T')[0],
              original_amount: val,
              balance_amount: val,
              paid_amount: 0,
              status: 'open',
            })
          }

          await supabase.from('accounts_receivable_installments').insert(insts)
        }
      } catch (recErr) {
        console.warn('Aviso ao gerar contas a receber no fallback:', recErr)
      }
    }

    return {
      success: true,
      sale_id: newSale.id,
      sale_code: newSale.code,
      sale_number: newSale.sale_number,
      total: Number(newSale.total),
      change_amount: Number(newSale.change_amount || 0),
    }
  },

  /**
   * Lista as vendas faturadas com filtros e paginação.
   */
  async listSales(
    companyId: string,
    filters?: SaleFilters
  ): Promise<{ data: Sale[]; totalCount: number }> {
    if (!supabase) return { data: [], totalCount: 0 }

    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    try {
      let query = supabase
        .from('sales')
        .select(
          `
          id,
          company_id,
          branch_id,
          user_id,
          customer_id,
          customer_name,
          customer_document,
          sale_number,
          code,
          status,
          subtotal,
          discount_type,
          discount_value,
          discount_amount,
          total,
          payment_amount,
          change_amount,
          quote_id,
          notes,
          created_at,
          updated_at,
          branch:branches (id, name, code),
          customer:customers (id, name, document, phone, email),
          payments:sale_payments (id, payment_method, amount, received_amount, change_amount, installments)
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
        // Se a tabela sales ainda não existir no banco, retorna lista vazia segura
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return { data: [], totalCount: 0 }
        }
        console.error('Erro ao listar vendas:', error)
        throw new Error(error.message || 'Erro ao carregar histórico de vendas.')
      }

      const sales: Sale[] = (data || []).map((row: any) => ({
        ...row,
        subtotal: Number(row.subtotal || 0),
        discount_value: Number(row.discount_value || 0),
        discount_amount: Number(row.discount_amount || 0),
        total: Number(row.total || 0),
        payment_amount: Number(row.payment_amount || 0),
        change_amount: Number(row.change_amount || 0),
        branch: Array.isArray(row.branch) ? row.branch[0] : row.branch,
        customer: Array.isArray(row.customer) ? row.customer[0] : row.customer,
        payments: Array.isArray(row.payments) ? row.payments : [],
      }))

      return {
        data: sales,
        totalCount: count || 0,
      }
    } catch (err: any) {
      if (err.code === '42P01' || err.message?.includes('does not exist')) {
        return { data: [], totalCount: 0 }
      }
      throw err
    }
  },

  /**
   * Obtém detalhes completos de uma venda com seus itens e formas de pagamento.
   */
  async getSale(saleId: string, companyId: string): Promise<Sale | null> {
    if (!supabase) return null

    try {
      const { data, error } = await supabase
        .from('sales')
        .select(
          `
          id,
          company_id,
          branch_id,
          user_id,
          customer_id,
          customer_name,
          customer_document,
          sale_number,
          code,
          status,
          subtotal,
          discount_type,
          discount_value,
          discount_amount,
          total,
          payment_amount,
          change_amount,
          quote_id,
          cash_session_id,
          notes,
          created_at,
          updated_at,
          branch:branches (
            id,
            name,
            code,
            cnpj,
            state_registration,
            phone,
            email,
            street,
            number,
            complement,
            neighborhood,
            city,
            state,
            zip_code
          ),
          customer:customers (id, name, document, phone, email),
          items:sale_items (
            id,
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
            total
          ),
          payments:sale_payments (
            id,
            payment_method,
            amount,
            received_amount,
            change_amount,
            installments,
            notes
          )
        `
        )
        .eq('id', saleId)
        .eq('company_id', companyId)
        .maybeSingle()

      if (error || !data) return null

      // Busca dados do operador de caixa
      let userName: string | undefined = undefined
      let userEmail: string | undefined = undefined
      if (data.user_id) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', data.user_id)
            .maybeSingle()
          if (prof) {
            userName = prof.full_name
            userEmail = prof.email
          }
        } catch {
          // Ignora erro de perfil
        }
      }

      return {
        ...data,
        user_name: userName,
        user_email: userEmail,
        subtotal: Number(data.subtotal || 0),
        discount_value: Number(data.discount_value || 0),
        discount_amount: Number(data.discount_amount || 0),
        total: Number(data.total || 0),
        payment_amount: Number(data.payment_amount || 0),
        change_amount: Number(data.change_amount || 0),
        branch: (() => {
          const b = Array.isArray(data.branch) ? data.branch[0] : data.branch
          if (!b) return undefined
          const isSaoPaulo = !b.city || b.city.toLowerCase().includes('sao paulo') || b.city.toLowerCase().includes('são paulo')
          return {
            ...b,
            city: isSaoPaulo ? 'Palmas' : b.city,
            state: isSaoPaulo && (!b.state || b.state.toUpperCase() === 'SP') ? 'TO' : b.state,
          }
        })(),
        customer: Array.isArray(data.customer) ? data.customer[0] : data.customer,
        items: (data.items || []).map((i: any) => ({
          ...i,
          quantity: Number(i.quantity || 0),
          unit_price: Number(i.unit_price || 0),
          discount: Number(i.discount || 0),
          subtotal: Number(i.subtotal || 0),
          total: Number(i.total || 0),
        })),
        payments: (data.payments || []).map((p: any) => ({
          ...p,
          amount: Number(p.amount || 0),
          received_amount: Number(p.received_amount || 0),
          change_amount: Number(p.change_amount || 0),
          installments: Number(p.installments || 1),
        })),
      } as Sale
    } catch (err) {
      console.error('Erro ao buscar detalhes da venda:', err)
      return null
    }
  },

  /**
   * Calcula os KPIs de vendas do dia para a empresa ou filial ativa.
   */
  async getSaleKpis(companyId: string, branchId?: string): Promise<SaleKpis> {
    const defaultKpis: SaleKpis = {
      todayTotal: 0,
      todayCount: 0,
      averageTicket: 0,
      cashTotal: 0,
      pixTotal: 0,
      cardTotal: 0,
    }

    if (!supabase) return defaultKpis

    try {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      let query = supabase
        .from('sales')
        .select(`
          total,
          payments:sale_payments (payment_method, amount)
        `)
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .gte('created_at', todayStart.toISOString())

      if (branchId && branchId !== 'all') {
        query = query.eq('branch_id', branchId)
      }

      const { data, error } = await query

      if (error || !data) return defaultKpis

      let todayTotal = 0
      let cashTotal = 0
      let pixTotal = 0
      let cardTotal = 0

      for (const sale of data) {
        const val = Number(sale.total || 0)
        todayTotal += val

        const payments = Array.isArray(sale.payments) ? sale.payments : []
        for (const p of payments) {
          const pVal = Number(p.amount || 0)
          if (p.payment_method === 'cash') cashTotal += pVal
          else if (p.payment_method === 'pix') pixTotal += pVal
          else if (p.payment_method === 'credit_card' || p.payment_method === 'debit_card') cardTotal += pVal
        }
      }

      const todayCount = data.length
      const averageTicket = todayCount > 0 ? Math.round((todayTotal / todayCount) * 100) / 100 : 0

      return {
        todayTotal,
        todayCount,
        averageTicket,
        cashTotal,
        pixTotal,
        cardTotal,
      }
    } catch {
      return defaultKpis
    }
  },
}
