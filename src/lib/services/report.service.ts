import { supabase } from '@/lib/supabase'
import type {
  ReportFilterState,
  ExecutiveDashboardData,
  SalesReportItem,
  ProductRankingItem,
  StockReportItem,
  FinancialReportData,
  SellerPerformanceItem,
} from '@/types/report'

export const reportService = {
  /**
   * Obtém os indicadores e séries consolidadas para o Dashboard Executivo
   */
  async getExecutiveDashboard(filters: ReportFilterState): Promise<ExecutiveDashboardData> {
    if (!supabase) throw new Error('Cliente Supabase não configurado.')

    const { companyId, branchId, dateFrom, dateTo, sellerId, paymentMethod } = filters

    // 1. Busca vendas no período
    let salesQuery = supabase
      .from('sales')
      .select(`
        id,
        code,
        status,
        subtotal,
        discount_amount,
        total,
        user_id,
        branch_id,
        created_at
      `)
      .eq('company_id', companyId)
      .gte('created_at', `${dateFrom}T00:00:00.000Z`)
      .lte('created_at', `${dateTo}T23:59:59.999Z`)

    if (branchId && branchId !== 'all') {
      salesQuery = salesQuery.eq('branch_id', branchId)
    }
    if (sellerId && sellerId !== 'all') {
      salesQuery = salesQuery.eq('user_id', sellerId)
    }

    const { data: salesData, error: salesErr } = await salesQuery
    if (salesErr) throw new Error(salesErr.message)

    const rawSales = salesData || []

    // 2. Busca pagamentos das vendas para apurar formas de pagamento
    const saleIds = rawSales.map((s) => s.id)
    let paymentsMap: Record<string, { method: string; amount: number }[]> = {}

    if (saleIds.length > 0) {
      // Chunking if needed, but for typical range:
      const { data: payData } = await supabase
        .from('sale_payments')
        .select('sale_id, payment_method, amount')
        .in('sale_id', saleIds.slice(0, 1000))

      if (payData) {
        for (const p of payData) {
          if (!paymentsMap[p.sale_id]) paymentsMap[p.sale_id] = []
          paymentsMap[p.sale_id].push({ method: p.payment_method, amount: Number(p.amount || 0) })
        }
      }
    }

    // Filtra vendas se houver filtro específico de forma de pagamento
    const validSales = rawSales.filter((s) => {
      if (!paymentMethod || paymentMethod === 'all') return true
      const pList = paymentsMap[s.id] || []
      return pList.some((p) => p.method === paymentMethod)
    })

    // Apuração dos Totais de Vendas (Diferenciando Bruto, Desconto, Líquido e Canceladas)
    let grossTotal = 0
    let discountTotal = 0
    let netTotal = 0
    let completedCount = 0
    let cancelledTotal = 0
    let cancelledCount = 0

    // Linha do tempo de vendas (evolução diária)
    const timelineMap: Record<string, { gross: number; net: number; count: number }> = {}

    for (const s of validSales) {
      const isCancelled = s.status === 'cancelled'
      const sSubtotal = Number(s.subtotal || 0)
      const sDiscount = Number(s.discount_amount || 0)
      const sTotal = Number(s.total || 0)

      const dayKey = s.created_at ? s.created_at.split('T')[0] : dateFrom

      if (isCancelled) {
        cancelledTotal += sTotal
        cancelledCount += 1
      } else {
        grossTotal += sSubtotal
        discountTotal += sDiscount
        netTotal += sTotal
        completedCount += 1

        if (!timelineMap[dayKey]) {
          timelineMap[dayKey] = { gross: 0, net: 0, count: 0 }
        }
        timelineMap[dayKey].gross += sSubtotal
        timelineMap[dayKey].net += sTotal
        timelineMap[dayKey].count += 1
      }
    }

    const averageTicket = completedCount > 0 ? Math.round((netTotal / completedCount) * 100) / 100 : 0

    // Ordenar timeline por data
    const salesEvolutionTimeline = Object.entries(timelineMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, item]) => {
        const parts = date.split('-')
        const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date
        return {
          date,
          label,
          grossTotal: Math.round(item.gross * 100) / 100,
          netTotal: Math.round(item.net * 100) / 100,
          salesCount: item.count,
        }
      })

    // Distribuição por Forma de Pagamento
    const methodTotals: Record<string, { amount: number; count: number }> = {}
    let totalPaymentsSum = 0

    const methodLabels: Record<string, string> = {
      cash: 'Dinheiro',
      pix: 'PIX',
      credit_card: 'Cartão de Crédito',
      debit_card: 'Cartão de Débito',
      store_credit: 'Crediário / A Prazo',
      other: 'Outros',
    }

    for (const s of validSales) {
      if (s.status === 'cancelled') continue
      const plist = paymentsMap[s.id] || []
      for (const p of plist) {
        if (!methodTotals[p.method]) {
          methodTotals[p.method] = { amount: 0, count: 0 }
        }
        methodTotals[p.method].amount += p.amount
        methodTotals[p.method].count += 1
        totalPaymentsSum += p.amount
      }
    }

    const salesByPaymentMethod = Object.entries(methodTotals).map(([method, val]) => ({
      paymentMethod: method,
      paymentMethodLabel: methodLabels[method] || method,
      totalAmount: Math.round(val.amount * 100) / 100,
      count: val.count,
      percentage:
        totalPaymentsSum > 0 ? Math.round((val.amount / totalPaymentsSum) * 1000) / 10 : 0,
    }))

    // 3. Comparativo com período anterior (mesmo delta de dias)
    const startMs = new Date(dateFrom).getTime()
    const endMs = new Date(dateTo).getTime()
    const durationMs = Math.max(86400000, endMs - startMs + 86400000)
    const prevStart = new Date(startMs - durationMs).toISOString().split('T')[0]
    const prevEnd = new Date(endMs - durationMs).toISOString().split('T')[0]

    let prevSalesQuery = supabase
      .from('sales')
      .select('total, status')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .gte('created_at', `${prevStart}T00:00:00.000Z`)
      .lte('created_at', `${prevEnd}T23:59:59.999Z`)

    if (branchId && branchId !== 'all') {
      prevSalesQuery = prevSalesQuery.eq('branch_id', branchId)
    }

    const { data: prevSales } = await prevSalesQuery
    const previousNetTotal = (prevSales || []).reduce((acc, curr) => acc + Number(curr.total || 0), 0)
    const growthPercentage =
      previousNetTotal > 0
        ? Math.round(((netTotal - previousNetTotal) / previousNetTotal) * 1000) / 10
        : netTotal > 0
        ? 100
        : 0

    // 4. Indicadores Financeiros (Contas a Receber e Pagar)
    // Títulos a Receber
    let recQuery = supabase
      .from('accounts_receivable')
      .select('status, balance_amount, total_amount')
      .eq('company_id', companyId)
    if (branchId && branchId !== 'all') {
      recQuery = recQuery.eq('branch_id', branchId)
    }
    const { data: recData } = await recQuery

    let receivablesOpen = 0
    let receivablesOverdue = 0
    let overdueReceivablesCount = 0

    for (const r of recData || []) {
      const bal = Number(r.balance_amount || 0)
      if (['open', 'partially_paid', 'pending'].includes(r.status)) {
        receivablesOpen += bal
      } else if (r.status === 'overdue') {
        receivablesOpen += bal
        receivablesOverdue += bal
        overdueReceivablesCount += 1
      }
    }

    // Recebimentos efetivamente liquidados no período (receivable_payments)
    const { data: recPayments } = await supabase
      .from('receivable_payments')
      .select('amount_paid, payment_date')
      .eq('company_id', companyId)
      .gte('payment_date', dateFrom)
      .lte('payment_date', dateTo)

    const receivablesPaidPeriod = (recPayments || []).reduce(
      (acc, curr: any) => acc + Number(curr.amount_paid || curr.amount || 0),
      0
    )

    // Títulos a Pagar (Consolidado via parcelas ativas para garantir consistência total com Contas a Pagar)
    let payQuery = supabase
      .from('accounts_payable_installments')
      .select(`
        balance_amount,
        due_date,
        status,
        payable:accounts_payable ( status )
      `)
      .eq('company_id', companyId)
      .neq('status', 'cancelled')

    if (branchId && branchId !== 'all') {
      payQuery = payQuery.eq('branch_id', branchId)
    }
    const { data: payInstData } = await payQuery

    let payablesOpen = 0
    let payablesOverdue = 0
    let overduePayablesCount = 0
    const todayStr = new Date().toISOString().split('T')[0]

    for (const inst of payInstData || []) {
      const parent = Array.isArray(inst.payable) ? inst.payable[0] : inst.payable
      // Se a conta principal estiver cancelada, desconsidera
      if (parent && parent.status === 'cancelled') continue

      const bal = Number(inst.balance_amount || 0)
      if (['pending', 'partially_paid', 'overdue'].includes(inst.status) && bal > 0.009) {
        payablesOpen += bal
        if (inst.due_date < todayStr || inst.status === 'overdue') {
          payablesOverdue += bal
          overduePayablesCount += 1
        }
      }
    }

    // Pagamentos efetivamente realizados no período (payable_payments)
    const { data: payPayments } = await supabase
      .from('payable_payments')
      .select('amount_paid, payment_date')
      .eq('company_id', companyId)
      .gte('payment_date', dateFrom)
      .lte('payment_date', dateTo)

    const payablesPaidPeriod = (payPayments || []).reduce(
      (acc, curr: any) => acc + Number(curr.amount_paid || curr.amount || 0),
      0
    )

    // 5. Alertas de Estoque Baixo e Zerado
    let stockQuery = supabase
      .from('branch_stock')
      .select('quantity, min_stock')
      .eq('company_id', companyId)
    if (branchId && branchId !== 'all') {
      stockQuery = stockQuery.eq('branch_id', branchId)
    }
    const { data: stockData } = await stockQuery

    let lowStockCount = 0
    let zeroStockCount = 0

    for (const item of stockData || []) {
      const qty = Number(item.quantity || 0)
      const min = Number(item.min_stock || 0)
      if (qty <= 0) {
        zeroStockCount += 1
      } else if (min > 0 && qty < min) {
        lowStockCount += 1
      }
    }

    // 6. Lista de Contas a Receber Pendentes (Em aberto e vencidas)
    let pendingRecsQuery = supabase
      .from('accounts_receivable')
      .select(`
        id,
        document_number,
        balance_amount,
        issue_date,
        status,
        customer:customers (name)
      `)
      .eq('company_id', companyId)
      .in('status', ['open', 'partially_paid', 'overdue'])
      .order('issue_date', { ascending: true })
      .limit(6)

    if (branchId && branchId !== 'all') {
      pendingRecsQuery = pendingRecsQuery.eq('branch_id', branchId)
    }
    const { data: pendingRecsData } = await pendingRecsQuery

    const pendingReceivables = (pendingRecsData || []).map((r: any) => {
      const cust = Array.isArray(r.customer) ? r.customer[0] : r.customer
      const isOver = r.status === 'overdue' || (r.issue_date && r.issue_date < todayStr)
      return {
        id: r.id,
        documentNumber: r.document_number || 'Sem doc',
        customerName: cust?.name || 'Cliente',
        balanceAmount: Number(r.balance_amount || 0),
        dueDate: r.issue_date || todayStr,
        isOverdue: isOver,
      }
    })

    // 7. Lista de Contas a Pagar Pendentes (Em aberto e vencidas - a partir de parcelas ativas)
    let upcomingPaysQuery = supabase
      .from('accounts_payable_installments')
      .select(`
        id,
        payable_id,
        installment_number,
        balance_amount,
        due_date,
        status,
        payable:accounts_payable (
          id,
          document_number,
          description,
          status,
          category:financial_categories (name)
        ),
        supplier:suppliers (name)
      `)
      .eq('company_id', companyId)
      .in('status', ['pending', 'partially_paid', 'overdue'])
      .gt('balance_amount', 0.009)
      .order('due_date', { ascending: true })
      .limit(10)

    if (branchId && branchId !== 'all') {
      upcomingPaysQuery = upcomingPaysQuery.eq('branch_id', branchId)
    }
    const { data: upcomingPaysData } = await upcomingPaysQuery

    const upcomingPayables = (upcomingPaysData || [])
      .filter((inst: any) => {
        const parent = Array.isArray(inst.payable) ? inst.payable[0] : inst.payable
        return parent && parent.status !== 'cancelled'
      })
      .slice(0, 6)
      .map((inst: any) => {
        const parent = Array.isArray(inst.payable) ? inst.payable[0] : inst.payable
        const supp = Array.isArray(inst.supplier) ? inst.supplier[0] : inst.supplier
        const cat = Array.isArray(parent?.category) ? parent.category[0] : parent?.category
        const isOver = inst.due_date && inst.due_date < todayStr

        return {
          id: inst.payable_id || inst.id,
          documentNumber: parent?.document_number || `Parc. ${inst.installment_number}`,
          supplierName: supp?.name || parent?.description || 'Fornecedor',
          categoryName: cat?.name || 'Despesa',
          balanceAmount: Number(inst.balance_amount || 0),
          dueDate: inst.due_date || todayStr,
          isOverdue: isOver || inst.status === 'overdue',
        }
      })

    return {
      salesSummary: {
        grossTotal: Math.round(grossTotal * 100) / 100,
        discountTotal: Math.round(discountTotal * 100) / 100,
        netTotal: Math.round(netTotal * 100) / 100,
        completedCount,
        averageTicket,
        cancelledTotal: Math.round(cancelledTotal * 100) / 100,
        cancelledCount,
      },
      comparisonPreviousPeriod: {
        previousNetTotal: Math.round(previousNetTotal * 100) / 100,
        growthPercentage,
      },
      salesByPaymentMethod,
      salesEvolutionTimeline,
      financialSummary: {
        receivablesOpen: Math.round(receivablesOpen * 100) / 100,
        receivablesOverdue: Math.round(receivablesOverdue * 100) / 100,
        receivablesPaidPeriod: Math.round(receivablesPaidPeriod * 100) / 100,
        payablesOpen: Math.round(payablesOpen * 100) / 100,
        payablesOverdue: Math.round(payablesOverdue * 100) / 100,
        payablesPaidPeriod: Math.round(payablesPaidPeriod * 100) / 100,
      },
      criticalAlerts: {
        lowStockCount,
        zeroStockCount,
        overdueReceivablesCount,
        overduePayablesCount,
      },
      pendingReceivables,
      upcomingPayables,
    }
  },

  /**
   * Relatório Analítico de Vendas
   */
  async getSalesReport(filters: ReportFilterState): Promise<SalesReportItem[]> {
    if (!supabase) return []

    const { companyId, branchId, dateFrom, dateTo, sellerId, paymentMethod } = filters

    let query = supabase
      .from('sales')
      .select(`
        id,
        code,
        sale_number,
        created_at,
        customer_name,
        user_id,
        branch_id,
        status,
        subtotal,
        discount_amount,
        total,
        branch:branches (name),
        payments:sale_payments (payment_method, amount)
      `)
      .eq('company_id', companyId)
      .gte('created_at', `${dateFrom}T00:00:00.000Z`)
      .lte('created_at', `${dateTo}T23:59:59.999Z`)
      .order('created_at', { ascending: false })

    if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId)
    if (sellerId && sellerId !== 'all') query = query.eq('user_id', sellerId)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    // Busca nomes dos usuários/vendedores associados
    const userIds = Array.from(new Set((data || []).map((s) => s.user_id).filter(Boolean)))
    let userNameMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
      if (profs) {
        for (const pr of profs) {
          userNameMap[pr.id] = pr.full_name || 'Vendedor'
        }
      }
    }

    const methodLabels: Record<string, string> = {
      cash: 'Dinheiro',
      pix: 'PIX',
      credit_card: 'Crédito',
      debit_card: 'Débito',
      store_credit: 'Crediário',
      other: 'Outro',
    }

    const items: SalesReportItem[] = []

    for (const row of data || []) {
      const pays = (row.payments as any[]) || []
      if (paymentMethod && paymentMethod !== 'all') {
        const matches = pays.some((p) => p.payment_method === paymentMethod)
        if (!matches) continue
      }

      const paymentMethodNames = pays
        .map((p) => methodLabels[p.payment_method] || p.payment_method)
        .join(', ')

      const branchObj = Array.isArray(row.branch) ? row.branch[0] : row.branch

      items.push({
        id: row.id,
        code: row.code,
        saleNumber: row.sale_number,
        createdAt: row.created_at,
        customerName: row.customer_name || 'Consumidor Final',
        sellerName: userNameMap[row.user_id] || 'Operador',
        branchName: branchObj?.name || 'Filial',
        status: row.status as 'completed' | 'cancelled',
        subtotal: Number(row.subtotal || 0),
        discountAmount: Number(row.discount_amount || 0),
        total: Number(row.total || 0),
        paymentMethods: paymentMethodNames || 'N/A',
      })
    }

    return items
  },

  /**
   * Relatório de Ranking e Curva ABC de Produtos Mais Vendidos
   */
  async getProductsRankingReport(filters: ReportFilterState): Promise<ProductRankingItem[]> {
    if (!supabase) return []

    const { companyId, branchId, dateFrom, dateTo } = filters

    // 1. Busca itens de vendas concluídas no período
    let query = supabase
      .from('sale_items')
      .select(`
        product_id,
        product_name,
        product_sku,
        unit,
        quantity,
        unit_price,
        cost_price,
        total,
        sale:sales!inner (status, created_at, company_id, branch_id)
      `)
      .eq('sale.company_id', companyId)
      .eq('sale.status', 'completed')
      .gte('sale.created_at', `${dateFrom}T00:00:00.000Z`)
      .lte('sale.created_at', `${dateTo}T23:59:59.999Z`)

    if (branchId && branchId !== 'all') {
      query = query.eq('sale.branch_id', branchId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    // Agrupa por produto
    const groupMap: Record<string, ProductRankingItem> = {}

    for (const row of data || []) {
      const pid = row.product_id
      const qty = Number(row.quantity || 0)
      const tot = Number(row.total || 0)
      const cost = Number(row.cost_price || 0)
      const hasCost = cost > 0

      if (!groupMap[pid]) {
        groupMap[pid] = {
          productId: pid,
          productName: row.product_name,
          sku: row.product_sku || '-',
          category: 'Geral',
          unit: row.unit || 'UN',
          quantitySold: 0,
          costPrice: cost,
          totalRevenue: 0,
          estimatedCostTotal: 0,
          hasValidCost: hasCost,
        }
      }

      groupMap[pid].quantitySold += qty
      groupMap[pid].totalRevenue += tot
      if (hasCost) {
        groupMap[pid].estimatedCostTotal += qty * cost
      }
    }

    // Converte e ordena decrescente por faturamento gerado
    return Object.values(groupMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .map((item) => ({
        ...item,
        quantitySold: Math.round(item.quantitySold * 1000) / 1000,
        totalRevenue: Math.round(item.totalRevenue * 100) / 100,
        estimatedCostTotal: Math.round(item.estimatedCostTotal * 100) / 100,
      }))
  },

  /**
   * Relatório de Posição de Estoque por Filial e Valoração de Custo
   */
  async getStockReport(filters: {
    companyId: string
    branchId: string
    statusFilter?: 'all' | 'low' | 'zero'
  }): Promise<StockReportItem[]> {
    if (!supabase) return []

    const { companyId, branchId, statusFilter } = filters

    let query = supabase
      .from('branch_stock')
      .select(`
        id,
        branch_id,
        product_id,
        quantity,
        reserved_quantity,
        min_stock,
        last_movement_at,
        branch:branches (name),
        product:products (
          name,
          sku,
          barcode,
          category,
          unit,
          cost_price
        )
      `)
      .eq('company_id', companyId)

    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const list: StockReportItem[] = []

    for (const row of data || []) {
      const prod = Array.isArray(row.product) ? row.product[0] : row.product
      const branchObj = Array.isArray(row.branch) ? row.branch[0] : row.branch

      const qty = Number(row.quantity || 0)
      const res = Number(row.reserved_quantity || 0)
      const min = Number(row.min_stock || 0)
      const cost = Number(prod?.cost_price || 0)
      const hasCost = cost > 0

      const isZero = qty <= 0
      const isBelowMin = min > 0 && qty < min

      if (statusFilter === 'zero' && !isZero) continue
      if (statusFilter === 'low' && !isBelowMin) continue

      list.push({
        productId: row.product_id,
        productName: prod?.name || 'Produto',
        sku: prod?.sku || '-',
        barcode: prod?.barcode || '-',
        category: prod?.category || 'Geral',
        unit: prod?.unit || 'UN',
        branchId: row.branch_id,
        branchName: branchObj?.name || 'Filial',
        quantity: qty,
        reservedQuantity: res,
        availableQuantity: Math.max(0, qty - res),
        minStock: min,
        isBelowMin,
        isZero,
        costPrice: cost,
        hasValidCost: hasCost,
        estimatedStockValue: Math.round(qty * cost * 100) / 100,
        lastMovementAt: row.last_movement_at,
      })
    }

    return list.sort((a, b) => a.productName.localeCompare(b.productName))
  },

  /**
   * Relatório Consolidado Financeiro (Previsto vs Realizado, Caixas e Liquidações)
   */
  async getFinancialReport(filters: ReportFilterState): Promise<FinancialReportData> {
    if (!supabase) throw new Error('Cliente Supabase não configurado.')

    const { companyId, branchId, dateFrom, dateTo } = filters
    const todayStr = new Date().toISOString().split('T')[0]

    // 1. Recebimentos liquidados no período (receivable_payments)
    let recPayQuery = supabase
      .from('receivable_payments')
      .select(`
        id,
        document_number,
        amount_paid,
        payment_method,
        payment_date,
        receivable:accounts_receivable (customer:customers (name))
      `)
      .eq('company_id', companyId)
      .gte('payment_date', dateFrom)
      .lte('payment_date', dateTo)
      .order('payment_date', { ascending: false })

    const { data: recPayData } = await recPayQuery
    const effectiveReceivedPeriod = (recPayData || []).reduce(
      (acc, curr: any) => acc + Number(curr.amount_paid || curr.amount || 0),
      0
    )

    const recentReceivableSettlements = (recPayData || []).map((rp: any) => {
      const rec = Array.isArray(rp.receivable) ? rp.receivable[0] : rp.receivable
      const cust = Array.isArray(rec?.customer) ? rec.customer[0] : rec?.customer
      return {
        id: rp.id,
        documentNumber: rp.document_number || '-',
        customerName: cust?.name || 'Cliente',
        amount: Number(rp.amount_paid || rp.amount || 0),
        paymentMethod: rp.payment_method || 'Outro',
        paidAt: rp.payment_date,
      }
    })

    // 2. Pagamentos liquidados no período (payable_payments)
    let payPayQuery = supabase
      .from('payable_payments')
      .select(`
        id,
        document_number,
        amount_paid,
        payment_method,
        payment_date,
        payable:accounts_payable (
          supplier:suppliers (name),
          category:financial_categories (name)
        )
      `)
      .eq('company_id', companyId)
      .gte('payment_date', dateFrom)
      .lte('payment_date', dateTo)
      .order('payment_date', { ascending: false })

    const { data: payPayData } = await payPayQuery
    const effectivePaidPeriod = (payPayData || []).reduce(
      (acc, curr: any) => acc + Number(curr.amount_paid || curr.amount || 0),
      0
    )

    const recentPayableSettlements = (payPayData || []).map((pp: any) => {
      const pay = Array.isArray(pp.payable) ? pp.payable[0] : pp.payable
      const supp = Array.isArray(pay?.supplier) ? pay.supplier[0] : pay?.supplier
      const cat = Array.isArray(pay?.category) ? pay.category[0] : pay?.category
      return {
        id: pp.id,
        documentNumber: pp.document_number || '-',
        supplierName: supp?.name || 'Fornecedor Diversos',
        categoryName: cat?.name || 'Despesa Geral',
        amount: Number(pp.amount_paid || pp.amount || 0),
        paymentMethod: pp.payment_method || 'Outro',
        paidAt: pp.payment_date,
      }
    })

    // 3. Títulos em Aberto e Vencidos (Receber)
    let recsQuery = supabase
      .from('accounts_receivable')
      .select('status, balance_amount, issue_date')
      .eq('company_id', companyId)
    if (branchId && branchId !== 'all') recsQuery = recsQuery.eq('branch_id', branchId)
    const { data: allRecs } = await recsQuery

    let openReceivablesTotal = 0
    let overdueReceivablesTotal = 0
    let futureReceivablesTotal = 0

    for (const r of allRecs || []) {
      const bal = Number(r.balance_amount || 0)
      if (r.status === 'open' || r.status === 'partially_paid') {
        openReceivablesTotal += bal
        futureReceivablesTotal += bal
      } else if (r.status === 'overdue') {
        openReceivablesTotal += bal
        overdueReceivablesTotal += bal
      }
    }

    // 4. Títulos em Aberto e Vencidos (Pagar - via parcelas ativas)
    let paysQuery = supabase
      .from('accounts_payable_installments')
      .select(`
        balance_amount,
        due_date,
        status,
        payable:accounts_payable ( status )
      `)
      .eq('company_id', companyId)
      .neq('status', 'cancelled')

    if (branchId && branchId !== 'all') paysQuery = paysQuery.eq('branch_id', branchId)
    const { data: allPayInsts } = await paysQuery

    let openPayablesTotal = 0
    let overduePayablesTotal = 0
    let futurePayablesTotal = 0

    for (const inst of allPayInsts || []) {
      const parent = Array.isArray(inst.payable) ? inst.payable[0] : inst.payable
      if (parent && parent.status === 'cancelled') continue

      const bal = Number(inst.balance_amount || 0)
      if (['pending', 'partially_paid', 'overdue'].includes(inst.status) && bal > 0.009) {
        openPayablesTotal += bal
        if (inst.due_date && inst.due_date < todayStr) {
          overduePayablesTotal += bal
        } else {
          futurePayablesTotal += bal
        }
      }
    }

    // 5. Histórico de Fechamentos de Caixa e Auditoria de Diferenças (Sobra/Falta)
    let cashQuery = supabase
      .from('cash_sessions')
      .select(`
        id,
        terminal_name,
        opened_at,
        closed_at,
        opened_by_name,
        closed_by_name,
        status,
        initial_amount,
        counted_cash,
        expected_cash,
        difference_cash,
        difference_reason,
        total_sales_cash,
        total_sales_pix,
        total_sales_debit,
        total_sales_credit,
        total_sales_store_credit,
        total_sales_other
      `)
      .eq('company_id', companyId)
      .order('opened_at', { ascending: false })
      .limit(50)

    if (branchId && branchId !== 'all') cashQuery = cashQuery.eq('branch_id', branchId)
    const { data: cashData } = await cashQuery

    const cashSessionsHistory = (cashData || []).map((cs) => {
      const nonCash =
        Number(cs.total_sales_pix || 0) +
        Number(cs.total_sales_debit || 0) +
        Number(cs.total_sales_credit || 0) +
        Number(cs.total_sales_store_credit || 0) +
        Number(cs.total_sales_other || 0)

      return {
        id: cs.id,
        terminalName: cs.terminal_name,
        openedAt: cs.opened_at,
        closedAt: cs.closed_at,
        openedByName: cs.opened_by_name || 'Operador',
        closedByName: cs.closed_by_name || null,
        status: cs.status as 'open' | 'closed',
        initialAmount: Number(cs.initial_amount || 0),
        countedCash: cs.counted_cash !== null ? Number(cs.counted_cash) : null,
        expectedCash: cs.expected_cash !== null ? Number(cs.expected_cash) : null,
        differenceCash: cs.difference_cash !== null ? Number(cs.difference_cash) : null,
        differenceReason: cs.difference_reason || null,
        totalSalesCash: Number(cs.total_sales_cash || 0),
        totalSalesNonCash: nonCash,
      }
    })

    return {
      summary: {
        effectiveReceivedPeriod: Math.round(effectiveReceivedPeriod * 100) / 100,
        effectivePaidPeriod: Math.round(effectivePaidPeriod * 100) / 100,
        openReceivablesTotal: Math.round(openReceivablesTotal * 100) / 100,
        overdueReceivablesTotal: Math.round(overdueReceivablesTotal * 100) / 100,
        openPayablesTotal: Math.round(openPayablesTotal * 100) / 100,
        overduePayablesTotal: Math.round(overduePayablesTotal * 100) / 100,
        futureReceivablesTotal: Math.round(futureReceivablesTotal * 100) / 100,
        futurePayablesTotal: Math.round(futurePayablesTotal * 100) / 100,
      },
      cashSessionsHistory,
      recentReceivableSettlements,
      recentPayableSettlements,
    }
  },

  /**
   * Relatório de Desempenho por Vendedor / Equipe Comercial
   */
  async getSellersPerformanceReport(
    filters: ReportFilterState
  ): Promise<SellerPerformanceItem[]> {
    if (!supabase) return []

    const { companyId, branchId, dateFrom, dateTo } = filters

    // 1. Busca vendas concluídas agrupadas
    let query = supabase
      .from('sales')
      .select(`
        id,
        user_id,
        branch_id,
        subtotal,
        discount_amount,
        total,
        branch:branches (name)
      `)
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .gte('created_at', `${dateFrom}T00:00:00.000Z`)
      .lte('created_at', `${dateTo}T23:59:59.999Z`)

    if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const sellerIds = Array.from(new Set((data || []).map((s) => s.user_id).filter(Boolean)))
    let profMap: Record<string, { name: string; email: string }> = {}

    if (sellerIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', sellerIds)

      if (profs) {
        for (const p of profs) {
          profMap[p.id] = { name: p.full_name || 'Vendedor', email: p.email || '' }
        }
      }
    }

    const sellerMap: Record<string, SellerPerformanceItem> = {}

    for (const s of data || []) {
      const uid = s.user_id
      const sub = Number(s.subtotal || 0)
      const disc = Number(s.discount_amount || 0)
      const tot = Number(s.total || 0)
      const branchObj = Array.isArray(s.branch) ? s.branch[0] : s.branch

      if (!sellerMap[uid]) {
        sellerMap[uid] = {
          userId: uid,
          userName: profMap[uid]?.name || 'Operador Comercial',
          userEmail: profMap[uid]?.email || '',
          branchName: branchObj?.name || 'Filial Principal',
          salesCount: 0,
          grossTotal: 0,
          discountTotal: 0,
          netTotal: 0,
          averageTicket: 0,
        }
      }

      sellerMap[uid].salesCount += 1
      sellerMap[uid].grossTotal += sub
      sellerMap[uid].discountTotal += disc
      sellerMap[uid].netTotal += tot
    }

    return Object.values(sellerMap)
      .map((item) => ({
        ...item,
        grossTotal: Math.round(item.grossTotal * 100) / 100,
        discountTotal: Math.round(item.discountTotal * 100) / 100,
        netTotal: Math.round(item.netTotal * 100) / 100,
        averageTicket:
          item.salesCount > 0 ? Math.round((item.netTotal / item.salesCount) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.netTotal - a.netTotal)
  },
}
