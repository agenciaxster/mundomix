import { supabase } from '@/lib/supabase'
import type {
  BranchStockItem,
  StockMovement,
  StockTransfer,
  StockKpis,
  ExecuteMovementPayload,
  CreateTransferPayload,
  Product,
} from '@/types/stock'

export const stockService = {
  /**
   * Busca os registros de estoque de uma determinada filial, com dados do produto.
   */
  async fetchBranchStock(
    companyId: string,
    branchId: string,
    filters?: {
      search?: string
      onlyLowStock?: boolean
      onlyZeroStock?: boolean
      category?: string
    }
  ): Promise<BranchStockItem[]> {
    if (!supabase) return []

    // 1. Garante que os produtos da empresa existam na tabela branch_stock desta filial
    // ou busca via join
    let query = supabase
      .from('branch_stock')
      .select(`
        id,
        company_id,
        branch_id,
        product_id,
        quantity,
        reserved_quantity,
        min_stock,
        last_movement_at,
        created_at,
        updated_at,
        product:products (
          id,
          company_id,
          name,
          sku,
          barcode,
          category,
          unit,
          cost_price,
          sale_price,
          min_stock,
          status,
          created_at,
          updated_at
        )
      `)
      .eq('company_id', companyId)
      .eq('branch_id', branchId)

    if (filters?.onlyZeroStock) {
      query = query.lte('quantity', 0)
    }

    const { data, error } = await query.order('updated_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar estoque da filial:', error)
      throw new Error(error.message || 'Erro ao carregar saldo de estoque')
    }

    let items = (data || []).map((row: any) => ({
      ...row,
      quantity: Number(row.quantity || 0),
      reserved_quantity: Number(row.reserved_quantity || 0),
      min_stock: Number(row.min_stock || row.product?.min_stock || 0),
      product: row.product as Product,
    })) as BranchStockItem[]

    // Filtros no lado da aplicação para busca e low stock
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim()
      items = items.filter(
        (i) =>
          i.product?.name.toLowerCase().includes(q) ||
          (i.product?.sku && i.product.sku.toLowerCase().includes(q)) ||
          (i.product?.barcode && i.product.barcode.toLowerCase().includes(q))
      )
    }

    if (filters?.onlyLowStock) {
      items = items.filter((i) => i.quantity <= i.min_stock && i.quantity > 0)
    }

    if (filters?.category && filters.category !== 'all') {
      items = items.filter((i) => i.product?.category === filters.category)
    }

    return items
  },

  /**
   * Busca o histórico de movimentações com filtros por filial, tipo e período.
   */
  async fetchStockMovements(
    companyId: string,
    branchId: string,
    filters?: {
      type?: string
      productId?: string
      startDate?: string
      endDate?: string
      search?: string
    }
  ): Promise<StockMovement[]> {
    if (!supabase) return []

    let query = supabase
      .from('stock_movements')
      .select(`
        id,
        company_id,
        branch_id,
        product_id,
        movement_type,
        quantity,
        balance_before,
        balance_after,
        reason,
        notes,
        user_id,
        reference_id,
        reference_type,
        created_at,
        product:products (
          id,
          company_id,
          name,
          sku,
          barcode,
          unit
        )
      `)
      .eq('company_id', companyId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })

    if (filters?.type && filters.type !== 'all') {
      query = query.eq('movement_type', filters.type)
    }

    if (filters?.productId) {
      query = query.eq('product_id', filters.productId)
    }

    if (filters?.startDate) {
      query = query.gte('created_at', `${filters.startDate}T00:00:00Z`)
    }

    if (filters?.endDate) {
      query = query.lte('created_at', `${filters.endDate}T23:59:59Z`)
    }

    const { data, error } = await query.limit(100)

    if (error) {
      console.error('Erro ao buscar movimentações:', error)
      throw new Error(error.message || 'Erro ao carregar histórico de movimentações')
    }

    let list = (data || []).map((row: any) => ({
      ...row,
      quantity: Number(row.quantity),
      balance_before: Number(row.balance_before),
      balance_after: Number(row.balance_after),
      product: row.product as Product,
    })) as StockMovement[]

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim()
      list = list.filter(
        (m) =>
          m.product?.name.toLowerCase().includes(q) ||
          m.product?.sku?.toLowerCase().includes(q) ||
          m.product?.barcode?.toLowerCase().includes(q) ||
          m.reason.toLowerCase().includes(q)
      )
    }

    return list
  },

  /**
   * Executa movimentação atômica (entrada, saída, ajuste) via RPC no Supabase.
   */
  async executeMovement(payload: ExecuteMovementPayload): Promise<{
    success: boolean
    movement_id: string
    balance_before: number
    balance_after: number
  }> {
    if (!supabase) throw new Error('Supabase client não configurado')

    const { data, error } = await supabase.rpc('execute_stock_movement', {
      p_company_id: payload.company_id,
      p_branch_id: payload.branch_id,
      p_product_id: payload.product_id,
      p_movement_type: payload.movement_type,
      p_quantity: payload.quantity,
      p_reason: payload.reason,
      p_notes: payload.notes ?? null,
      p_reference_id: payload.reference_id ?? null,
      p_reference_type: payload.reference_type ?? null,
    })

    if (error) {
      console.error('Erro RPC execute_stock_movement:', error)
      throw new Error(error.message || 'Falha ao processar movimentação de estoque')
    }

    return data as any
  },

  /**
   * Busca transferências entre filiais.
   */
  async fetchStockTransfers(
    companyId: string,
    branchId?: string,
    statusFilter?: string
  ): Promise<StockTransfer[]> {
    if (!supabase) return []

    let query = supabase
      .from('stock_transfers')
      .select(`
        id,
        company_id,
        code,
        origin_branch_id,
        destination_branch_id,
        status,
        notes,
        shipped_by,
        shipped_at,
        received_by,
        received_at,
        cancelled_by,
        cancelled_at,
        created_by,
        created_at,
        updated_at,
        origin_branch:branches!stock_transfers_origin_branch_id_fkey (id, name, code),
        destination_branch:branches!stock_transfers_destination_branch_id_fkey (id, name, code),
        items:stock_transfer_items (
          id,
          transfer_id,
          product_id,
          quantity_sent,
          quantity_received,
          created_at,
          product:products (id, name, sku, barcode, unit)
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (branchId) {
      query = query.or(`origin_branch_id.eq.${branchId},destination_branch_id.eq.${branchId}`)
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar transferências:', error)
      throw new Error(error.message || 'Erro ao carregar transferências')
    }

    return (data || []).map((t: any) => ({
      ...t,
      items: (t.items || []).map((item: any) => ({
        ...item,
        quantity_sent: Number(item.quantity_sent),
        quantity_received: Number(item.quantity_received),
      })),
    })) as StockTransfer[]
  },

  /**
   * Cria uma nova transferência em rascunho com seus itens.
   */
  async createTransfer(payload: CreateTransferPayload): Promise<StockTransfer> {
    if (!supabase) throw new Error('Supabase client não configurado')

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randCode = Math.floor(1000 + Math.random() * 9000)
    const code = `TRF-${dateStr}-${randCode}`

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // 1. Insere o cabeçalho da transferência
    const { data: transfer, error: transferError } = await supabase
      .from('stock_transfers')
      .insert({
        company_id: payload.company_id,
        code,
        origin_branch_id: payload.origin_branch_id,
        destination_branch_id: payload.destination_branch_id,
        status: 'draft',
        notes: payload.notes || null,
        created_by: user?.id || null,
      })
      .select()
      .single()

    if (transferError || !transfer) {
      console.error('Erro ao criar cabeçalho da transferência:', transferError)
      throw new Error(transferError?.message || 'Falha ao criar transferência')
    }

    // 2. Insere os itens
    const itemsToInsert = payload.items.map((item) => ({
      transfer_id: transfer.id,
      product_id: item.product_id,
      quantity_sent: item.quantity,
      quantity_received: 0,
    }))

    const { error: itemsError } = await supabase
      .from('stock_transfer_items')
      .insert(itemsToInsert)

    if (itemsError) {
      // Rollback manual do cabeçalho
      await supabase.from('stock_transfers').delete().eq('id', transfer.id)
      console.error('Erro ao adicionar itens da transferência:', itemsError)
      throw new Error(itemsError.message || 'Falha ao incluir itens na transferência')
    }

    return transfer as unknown as StockTransfer
  },

  /**
   * Despacha / envia a transferência via RPC.
   */
  async shipTransfer(transferId: string, notes?: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client não configurado')

    const { error } = await supabase.rpc('ship_stock_transfer', {
      p_transfer_id: transferId,
      p_notes: notes || null,
    })

    if (error) {
      console.error('Erro ao despachar transferência:', error)
      throw new Error(error.message || 'Falha ao despachar transferência')
    }
  },

  /**
   * Registra o recebimento da transferência na filial de destino via RPC.
   */
  async receiveTransfer(transferId: string, notes?: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client não configurado')

    const { error } = await supabase.rpc('receive_stock_transfer', {
      p_transfer_id: transferId,
      p_notes: notes || null,
    })

    if (error) {
      console.error('Erro ao receber transferência:', error)
      throw new Error(error.message || 'Falha ao confirmar recebimento da transferência')
    }
  },

  /**
   * Cancela uma transferência via RPC (se estava em trânsito, estorna o estoque).
   */
  async cancelTransfer(transferId: string, notes?: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client não configurado')

    const { error } = await supabase.rpc('cancel_stock_transfer', {
      p_transfer_id: transferId,
      p_notes: notes || null,
    })

    if (error) {
      console.error('Erro ao cancelar transferência:', error)
      throw new Error(error.message || 'Falha ao cancelar transferência')
    }
  },

  /**
   * Calcula indicadores chave de estoque (KPIs reais) para a filial.
   */
  async fetchStockKpis(companyId: string, branchId: string): Promise<StockKpis> {
    if (!supabase) {
      return {
        totalProductsWithStock: 0,
        lowStockCount: 0,
        zeroStockCount: 0,
        monthlyEntries: 0,
        monthlyExits: 0,
        pendingTransfersCount: 0,
      }
    }

    try {
      // 1. Itens de estoque da filial
      const { data: stockRows } = await supabase
        .from('branch_stock')
        .select('quantity, min_stock')
        .eq('company_id', companyId)
        .eq('branch_id', branchId)

      let totalProductsWithStock = 0
      let lowStockCount = 0
      let zeroStockCount = 0

      if (stockRows) {
        for (const row of stockRows) {
          const q = Number(row.quantity || 0)
          const m = Number(row.min_stock || 0)
          if (q > 0) totalProductsWithStock++
          if (q <= 0) zeroStockCount++
          if (q > 0 && q <= m) lowStockCount++
        }
      }

      // 2. Movimentações do mês atual
      const firstDayOfMonth = new Date()
      firstDayOfMonth.setDate(1)
      firstDayOfMonth.setHours(0, 0, 0, 0)

      const { data: movements } = await supabase
        .from('stock_movements')
        .select('movement_type, quantity')
        .eq('company_id', companyId)
        .eq('branch_id', branchId)
        .gte('created_at', firstDayOfMonth.toISOString())

      let monthlyEntries = 0
      let monthlyExits = 0

      if (movements) {
        for (const m of movements) {
          const q = Number(m.quantity || 0)
          if (['entry', 'transfer_in'].includes(m.movement_type)) {
            monthlyEntries += q
          } else if (['exit', 'transfer_out'].includes(m.movement_type)) {
            monthlyExits += q
          }
        }
      }

      // 3. Transferências pendentes (em trânsito com destino para esta filial)
      const { count: pendingTransfersCount } = await supabase
        .from('stock_transfers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('destination_branch_id', branchId)
        .eq('status', 'in_transit')

      return {
        totalProductsWithStock,
        lowStockCount,
        zeroStockCount,
        monthlyEntries,
        monthlyExits,
        pendingTransfersCount: pendingTransfersCount || 0,
      }
    } catch (err) {
      console.error('Erro ao calcular KPIs de estoque:', err)
      return {
        totalProductsWithStock: 0,
        lowStockCount: 0,
        zeroStockCount: 0,
        monthlyEntries: 0,
        monthlyExits: 0,
        pendingTransfersCount: 0,
      }
    }
  },

  /**
   * Pesquisa catálogo de produtos da empresa por nome, SKU ou código de barras.
   */
  async searchProducts(companyId: string, searchTerm: string): Promise<Product[]> {
    if (!supabase) return []

    const q = searchTerm.trim()
    let query = supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')

    if (q) {
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`)
    }

    const { data, error } = await query.limit(30)

    if (error) {
      console.error('Erro ao buscar produtos:', error)
      return []
    }

    return (data || []).map((p: any) => ({
      ...p,
      cost_price: Number(p.cost_price || 0),
      sale_price: Number(p.sale_price || 0),
      min_stock: Number(p.min_stock || 0),
    })) as Product[]
  },
}
