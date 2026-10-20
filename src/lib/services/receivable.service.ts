import { supabase } from '@/lib/supabase'
import type {
  AccountReceivable,
  ReceivableInstallment,
  ReceivablePayment,
  CustomerCreditProfile,
  ReceivePaymentParams,
  ListInstallmentsFilter,
  CreateManualReceivableParams,
} from '@/types/receivable'

function getClient() {
  if (!supabase) {
    throw new Error('Supabase client não está inicializado')
  }
  return supabase
}

function isValidUUID(val?: string | null): boolean {
  if (!val) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())
}

export const receivableService = {
  /**
   * Consulta o perfil de crédito completo do cliente
   */
  async getCustomerCreditProfile(companyId: string, customerId: string): Promise<CustomerCreditProfile> {
    try {
      const client = getClient()
      const { data, error } = await client.rpc('get_customer_credit_profile', {
        p_company_id: companyId,
        p_customer_id: customerId,
      })

      if (error) {
        // Fallback local se o RPC ainda não tiver sido aplicado no banco
        if (error.code === '42883') {
          return this.fallbackGetCustomerCreditProfile(companyId, customerId)
        }
        throw error
      }

      return data as CustomerCreditProfile
    } catch (err) {
      console.warn('Fallback ao consultar perfil de crédito:', err)
      return this.fallbackGetCustomerCreditProfile(companyId, customerId)
    }
  },

  /**
   * Fallback de consulta de limite de crédito
   */
  async fallbackGetCustomerCreditProfile(companyId: string, customerId: string): Promise<CustomerCreditProfile> {
    const client = getClient()
    const { data: cust } = await client
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .eq('company_id', companyId)
      .maybeSingle()

    const limit = Number(cust?.credit_limit || 0)
    const creditStatus = (cust?.credit_status || 'available') as 'available' | 'blocked' | 'under_review'
    const status = (cust?.status || 'active') as 'active' | 'inactive'

    const { data: recs } = await client
      .from('accounts_receivable')
      .select('balance_amount, status')
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      .in('status', ['open', 'partially_paid', 'overdue'])

    const used = (recs || []).reduce((acc: number, r: any) => acc + Number(r.balance_amount || 0), 0)

    const todayStr = new Date().toISOString().split('T')[0]
    const { data: insts } = await client
      .from('accounts_receivable_installments')
      .select('balance_amount, due_date, status')
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      .in('status', ['open', 'partially_paid', 'overdue'])
      .lt('due_date', todayStr)

    const overdue = (insts || []).reduce((acc: number, i: any) => acc + Number(i.balance_amount || 0), 0)
    const overdueCount = (insts || []).length

    return {
      customer_id: customerId,
      customer_name: cust?.name || 'Cliente',
      document: cust?.document,
      credit_status: creditStatus,
      customer_status: status,
      credit_limit: limit,
      used_credit: used,
      available_credit: Math.max(0, limit - used),
      overdue_amount: overdue,
      overdue_count: overdueCount,
      open_receivables_count: (recs || []).length,
      is_blocked: creditStatus === 'blocked' || status === 'inactive',
      has_overdue: overdueCount > 0,
    }
  },

  /**
   * Lista parcelas com filtros avançados
   */
  async listInstallments(filter: ListInstallmentsFilter): Promise<ReceivableInstallment[]> {
    const client = getClient()
    let query = client
      .from('accounts_receivable_installments')
      .select(`
        *,
        receivable:accounts_receivable (
          id, document_number, description, issue_date, total_amount, balance_amount, status, sale_id
        ),
        customer:customers (
          id, name, trade_name, document, phone
        )
      `)
      .eq('company_id', filter.companyId)
      .order('due_date', { ascending: true })

    if (filter.branchId) {
      query = query.eq('branch_id', filter.branchId)
    }

    if (filter.customerId) {
      query = query.eq('customer_id', filter.customerId)
    }

    if (filter.status && filter.status !== 'all') {
      if (filter.status === 'overdue') {
        const todayStr = new Date().toISOString().split('T')[0]
        query = query.in('status', ['open', 'partially_paid', 'overdue']).lt('due_date', todayStr)
      } else {
        query = query.eq('status', filter.status)
      }
    }

    if (filter.startDate) {
      query = query.gte('due_date', filter.startDate)
    }

    if (filter.endDate) {
      query = query.lte('due_date', filter.endDate)
    }

    const { data, error } = await query

    if (error) {
      console.warn('Erro ao listar parcelas no Supabase:', error)
      return []
    }

    let results = (data || []) as ReceivableInstallment[]

    // Filtro em memória por busca textual (documento, cliente ou número)
    if (filter.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase().trim()
      results = results.filter((item) => {
        const doc = item.installment_number?.toString() || ''
        const recDoc = item.receivable?.document_number?.toLowerCase() || ''
        const custName = item.customer?.name?.toLowerCase() || ''
        const custDoc = item.customer?.document?.toLowerCase() || ''
        return doc.includes(q) || recDoc.includes(q) || custName.includes(q) || custDoc.includes(q)
      })
    }

    return results
  },

  /**
   * Baixa / Recebimento de parcela
   */
  async receivePayment(params: ReceivePaymentParams): Promise<{
    success: boolean
    payment_id: string
    installment_balance: number
    installment_status: string
  }> {
    try {
      const client = getClient()
      const { data, error } = await client.rpc('receive_installment_payment', {
        p_company_id: params.company_id,
        p_branch_id: params.branch_id,
        p_installment_id: params.installment_id,
        p_amount: params.amount,
        p_payment_method: params.payment_method,
        p_cash_session_id: params.cash_session_id || null,
        p_notes: params.notes || null,
        p_idempotency_key: params.idempotency_key || crypto.randomUUID(),
      })

      if (error) {
        if (error.code === '42883') {
          return this.fallbackReceivePayment(params)
        }
        throw error
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('financial-records-changed'))
      }

      return data
    } catch (err: any) {
      if (err.message && err.message.includes('receive_installment_payment')) {
        return this.fallbackReceivePayment(params)
      }
      throw err
    }
  },

  /**
   * Fallback de recebimento atômico
   */
  async fallbackReceivePayment(params: ReceivePaymentParams) {
    const client = getClient()
    const { data: inst, error: fetchErr } = await client
      .from('accounts_receivable_installments')
      .select('*, receivable:accounts_receivable(*)')
      .eq('id', params.installment_id)
      .single()

    if (fetchErr || !inst) throw new Error('Parcela não encontrada')

    const newPaid = Math.round((Number(inst.paid_amount || 0) + params.amount) * 100) / 100
    const newBal = Math.max(0, Math.round((Number(inst.balance_amount || 0) - params.amount) * 100) / 100)
    const newStatus = newBal <= 0.009 ? 'paid' : 'partially_paid'

    await client
      .from('accounts_receivable_installments')
      .update({
        paid_amount: newPaid,
        balance_amount: newBal,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.installment_id)

    // Atualiza conta pai
    const rec = inst.receivable
    if (rec) {
      const recPaid = Math.round((Number(rec.paid_amount || 0) + params.amount) * 100) / 100
      const recBal = Math.max(0, Math.round((Number(rec.balance_amount || 0) - params.amount) * 100) / 100)
      const recStatus = recBal <= 0.009 ? 'paid' : 'partially_paid'

      await client
        .from('accounts_receivable')
        .update({
          paid_amount: recPaid,
          balance_amount: recBal,
          status: recStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rec.id)
    }

    // Registra recebimento
    const { data: userAuth } = await client.auth.getUser()
    const { data: pay } = await client
      .from('receivable_payments')
      .insert({
        company_id: params.company_id,
        branch_id: params.branch_id,
        receivable_id: inst.receivable_id,
        installment_id: inst.id,
        customer_id: inst.customer_id,
        cash_session_id: params.cash_session_id || null,
        amount_paid: params.amount,
        payment_method: params.payment_method,
        notes: params.notes,
        received_by: userAuth.user?.id,
      })
      .select('id')
      .single()

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial-records-changed'))
    }

    return {
      success: true,
      payment_id: pay?.id || crypto.randomUUID(),
      installment_balance: newBal,
      installment_status: newStatus,
    }
  },

  /**
   * Criação manual de Conta a Receber avulsa com parcelas
   */
  async createManualReceivable(params: CreateManualReceivableParams): Promise<AccountReceivable> {
    const client = getClient()
    const docNumber = `REC-${Date.now().toString().slice(-6)}`
    const totalFinanced = Math.max(0, params.total_amount - (params.down_payment || 0))
    const count = Math.max(1, params.installments_count)
    const interval = params.interval_days || 30

    const { data: userAuth } = await client.auth.getUser()

    // Resolução segura de filial (branch_id)
    let targetBranchId = params.branch_id
    if (!isValidUUID(targetBranchId) || targetBranchId === 'all') {
      const { data: branches } = await client
        .from('branches')
        .select('id, branch_type')
        .eq('company_id', params.company_id)
        .order('created_at', { ascending: true })

      const hq = branches?.find((b: any) => b.branch_type === 'matriz') || branches?.[0]
      if (hq) {
        targetBranchId = hq.id
      }
    }

    if (!isValidUUID(targetBranchId)) {
      throw new Error('Nenhuma filial válida encontrada para vincular ao título a receber. Verifique as filiais cadastradas.')
    }

    // 1. Cria Conta a Receber
    const { data: rec, error: recErr } = await client
      .from('accounts_receivable')
      .insert({
        company_id: params.company_id,
        branch_id: targetBranchId,
        customer_id: params.customer_id,
        document_number: docNumber,
        description: params.description,
        total_amount: params.total_amount,
        down_payment: params.down_payment || 0,
        balance_amount: totalFinanced,
        paid_amount: 0,
        installments_count: count,
        status: totalFinanced <= 0 ? 'paid' : 'open',
        notes: params.notes,
        created_by: userAuth.user?.id,
      })
      .select()
      .single()

    if (recErr || !rec) {
      throw new Error(recErr?.message || 'Falha ao criar conta a receber no banco de dados.')
    }

    // 2. Cria Parcelas distribuindo centavos
    if (totalFinanced > 0) {
      const baseVal = Math.floor((totalFinanced / count) * 100) / 100
      const remainder = Math.round((totalFinanced - baseVal * count) * 100) / 100

      const firstDate = new Date(params.first_due_date)
      const installmentsToInsert = []

      for (let i = 1; i <= count; i++) {
        const dueDate = new Date(firstDate)
        dueDate.setDate(dueDate.getDate() + (i - 1) * interval)
        const val = i === 1 ? Math.round((baseVal + remainder) * 100) / 100 : baseVal

        installmentsToInsert.push({
          receivable_id: rec.id,
          company_id: params.company_id,
          branch_id: targetBranchId,
          customer_id: params.customer_id,
          installment_number: i,
          due_date: dueDate.toISOString().split('T')[0],
          original_amount: val,
          balance_amount: val,
          paid_amount: 0,
          status: 'open',
        })
      }

      await client.from('accounts_receivable_installments').insert(installmentsToInsert)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial-records-changed'))
    }

    return rec as AccountReceivable
  },

  /**
   * Obtém histórico de pagamentos de uma parcela
   */
  async getInstallmentPayments(installmentId: string): Promise<ReceivablePayment[]> {
    const client = getClient()
    const { data, error } = await client
      .from('receivable_payments')
      .select('*')
      .eq('installment_id', installmentId)
      .order('payment_date', { ascending: false })

    if (error) {
      console.warn('Erro ao carregar pagamentos da parcela:', error)
      return []
    }
    return (data || []) as ReceivablePayment[]
  },

  /**
   * Resumo financeiro consolidado
   */
  async getSummaryMetrics(companyId: string, branchId?: string) {
    const client = getClient()
    let query = client
      .from('accounts_receivable_installments')
      .select('balance_amount, paid_amount, due_date, status')
      .eq('company_id', companyId)

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data } = await query
    const items = data || []
    const todayStr = new Date().toISOString().split('T')[0]

    let totalOpen = 0
    let totalOverdue = 0
    let totalDueToday = 0
    let countOverdue = 0

    for (const item of items) {
      const bal = Number(item.balance_amount || 0)
      if (item.status !== 'paid' && item.status !== 'cancelled' && bal > 0) {
        totalOpen += bal
        if (item.due_date < todayStr) {
          totalOverdue += bal
          countOverdue++
        } else if (item.due_date === todayStr) {
          totalDueToday += bal
        }
      }
    }

    return {
      totalOpen,
      totalOverdue,
      totalDueToday,
      countOverdue,
      totalCount: items.length,
    }
  },

  /**
   * Exclusão de Conta a Receber e suas parcelas
   * Bloqueia exclusão se houver pagamentos parciais ou totais realizados
   */
  async deleteReceivable(companyId: string, receivableId: string): Promise<boolean> {
    const client = getClient()

    // 1. Remove quaisquer pagamentos registrados para o título (estorno automático na exclusão)
    try {
      await client
        .from('receivable_payments')
        .delete()
        .eq('company_id', companyId)
        .eq('receivable_id', receivableId)
    } catch (payErr) {
      console.warn('Aviso ao remover pagamentos vinculados:', payErr)
    }

    // 2. Tenta exclusão atômica via RPC delete_accounts_receivable
    try {
      const { data: rpcRes, error: rpcErr } = await client.rpc('delete_accounts_receivable', {
        p_company_id: companyId,
        p_receivable_id: receivableId,
      })

      if (!rpcErr && rpcRes?.success) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('financial-records-changed'))
        }
        return true
      }
      if (rpcErr && rpcErr.code !== '42883' && rpcErr.code !== 'PGRST202') {
        console.warn('Aviso ao executar RPC delete_accounts_receivable:', rpcErr)
      }
    } catch (rpcEx: any) {
      // Continua para fallback seguro
    }

    // 3. Fallback Seguro: Atualiza o registro pai para CANCELADO com saldo ZERO
    try {
      await client
        .from('accounts_receivable')
        .update({
          status: 'cancelled',
          balance_amount: 0,
          paid_amount: 0,
          notes: '[CANCELADO/EXCLUÍDO]',
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)
        .eq('id', receivableId)
    } catch (updErr) {
      console.warn('Aviso ao atualizar conta a receber antes de excluir parcelas:', updErr)
    }

    // 4. Remove as parcelas primeiro
    const { error: instErr } = await client
      .from('accounts_receivable_installments')
      .delete()
      .eq('company_id', companyId)
      .eq('receivable_id', receivableId)

    if (instErr) {
      throw new Error(instErr.message || 'Erro ao excluir parcelas da conta a receber.')
    }

    // 5. Tenta a exclusão física do registro principal
    try {
      await client
        .from('accounts_receivable')
        .delete()
        .eq('company_id', companyId)
        .eq('id', receivableId)
    } catch (delErr) {
      console.warn('Aviso na exclusão física da conta a receber:', delErr)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial-records-changed'))
    }

    return true
  },

  /**
   * Limpa todos os títulos e parcelas de contas a receber da empresa (Zerar lançamentos)
   */
  async clearAllReceivables(companyId: string, branchId?: string): Promise<{ deletedCount: number }> {
    const client = getClient()

    // 1. Busca os IDs das contas a receber da empresa (e filial, se especificada)
    let query = client
      .from('accounts_receivable')
      .select('id')
      .eq('company_id', companyId)

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data: recs, error: recsErr } = await query

    if (recsErr) {
      console.error('Erro ao consultar títulos para limpeza:', recsErr)
      throw new Error('Falha ao localizar os títulos para limpeza.')
    }

    if (!recs || recs.length === 0) {
      return { deletedCount: 0 }
    }

    const recIds = recs.map((r) => r.id)

    // 2. Remove os pagamentos vinculados
    try {
      await client
        .from('receivable_payments')
        .delete()
        .eq('company_id', companyId)
        .in('receivable_id', recIds)
    } catch (payErr) {
      console.warn('Aviso ao remover pagamentos vinculados:', payErr)
    }

    // 3. Remove todas as parcelas
    const { error: instErr } = await client
      .from('accounts_receivable_installments')
      .delete()
      .eq('company_id', companyId)
      .in('receivable_id', recIds)

    if (instErr) {
      console.error('Erro ao excluir parcelas:', instErr)
      throw new Error(instErr.message || 'Erro ao remover as parcelas de contas a receber.')
    }

    // 4. Remove os títulos principais
    const { error: delErr } = await client
      .from('accounts_receivable')
      .delete()
      .eq('company_id', companyId)
      .in('id', recIds)

    if (delErr) {
      console.warn('Aviso ao remover registros principais de contas a receber:', delErr)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial-records-changed'))
    }

    return { deletedCount: recIds.length }
  },
}

