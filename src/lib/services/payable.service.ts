import { supabase } from '@/lib/supabase'
import type {
  AccountPayable,
  PayableInstallment,
  PayablePayment,
  FinancialCategory,
  CreatePayablePayload,
  PayInstallmentPayload,
  PayableFilter,
  PayableKpis,
} from '@/types/payable'

function getClient() {
  if (!supabase) {
    throw new Error('Supabase client não está inicializado')
  }
  return supabase
}

export const DEFAULT_FINANCIAL_CATEGORIES = [
  { name: 'Aluguel', code: 'ALUGUEL', color: 'amber' },
  { name: 'Água e Energia', code: 'AGUA_LUZ', color: 'cyan' },
  { name: 'Internet e Telefone', code: 'TELECOM', color: 'indigo' },
  { name: 'Fornecedores e Mercadorias', code: 'FORNECEDORES', color: 'blue' },
  { name: 'Serviços Contratados', code: 'SERVICOS', color: 'purple' },
  { name: 'Folha de Pagamento', code: 'SALARIOS', color: 'emerald' },
  { name: 'Impostos e Taxas', code: 'IMPOSTOS', color: 'rose' },
  { name: 'Manutenção', code: 'MANUTENCAO', color: 'orange' },
  { name: 'Outras Despesas', code: 'OUTROS', color: 'slate' },
]

function isValidUUID(val?: string | null): boolean {
  if (!val) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())
}

export const payableService = {
  /**
   * Lista categorias financeiras da empresa
   */
  async listCategories(companyId: string): Promise<FinancialCategory[]> {
    const client = getClient()
    const { data, error } = await client
      .from('financial_categories')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('name', { ascending: true })

    if (!error && data && data.length > 0) {
      return data as FinancialCategory[]
    }

    // Se a empresa ainda não tem categorias no banco, insere as padrão no banco
    if (!error && (!data || data.length === 0)) {
      try {
        const rowsToInsert = DEFAULT_FINANCIAL_CATEGORIES.map((c) => ({
          company_id: companyId,
          name: c.name,
          code: c.code,
          type: 'expense',
          color: c.color,
          status: 'active',
        }))

        const { data: inserted, error: insErr } = await client
          .from('financial_categories')
          .insert(rowsToInsert)
          .select('*')

        if (!insErr && inserted && inserted.length > 0) {
          return inserted as FinancialCategory[]
        }
      } catch (catErr) {
        console.warn('Aviso ao criar categorias padrão no banco:', catErr)
      }
    }

    if (error) {
      console.warn('Aviso ao buscar categorias financeiras no Supabase:', error)
    }

    return DEFAULT_FINANCIAL_CATEGORIES.map((c, idx) => ({
      id: `mock-cat-${idx}`,
      company_id: companyId,
      name: c.name,
      code: c.code,
      type: 'expense',
      color: c.color,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
  },

  /**
   * Cadastra nova categoria financeira
   */
  async createCategory(
    companyId: string,
    name: string,
    code?: string,
    color: string = 'blue'
  ): Promise<FinancialCategory> {
    const client = getClient()
    const { data, error } = await client
      .from('financial_categories')
      .insert({
        company_id: companyId,
        name: name.trim(),
        code: code?.trim() || name.trim().toUpperCase().replace(/\s+/g, '_'),
        type: 'expense',
        color,
        status: 'active',
      })
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Erro ao cadastrar categoria.')
    }
    return data as FinancialCategory
  },

  /**
   * Lista parcelas de contas a pagar com filtros avançados
   */
  async listInstallments(filter: PayableFilter): Promise<PayableInstallment[]> {
    const client = getClient()
    let query = client
      .from('accounts_payable_installments')
      .select(`
        *,
        payable:accounts_payable (
          id, document_number, description, issue_date, competence_date, due_date,
          original_amount, discount_amount, interest_amount, fine_amount, total_amount,
          paid_amount, balance_amount, installments_count, status, notes, category_id,
          category:financial_categories ( id, name, color )
        ),
        supplier:suppliers (
          id, name, trade_name, document, phone
        )
      `)
      .eq('company_id', filter.companyId)
      .order('due_date', { ascending: true })

    if (filter.branchId) {
      query = query.eq('branch_id', filter.branchId)
    }

    if (filter.supplierId) {
      query = query.eq('supplier_id', filter.supplierId)
    }

    if (filter.status && filter.status !== 'all') {
      if (filter.status === 'overdue') {
        const todayStr = new Date().toISOString().split('T')[0]
        query = query.in('status', ['pending', 'partially_paid']).lt('due_date', todayStr)
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
      console.warn('Aviso ao listar parcelas de contas a pagar:', error)
      return []
    }

    let results = (data || []) as PayableInstallment[]

    // Desconsidera parcelas canceladas ou cujo registro pai foi cancelado/excluído
    results = results.filter((i) => i.status !== 'cancelled' && i.payable?.status !== 'cancelled')

    // Filtro por categoria (via join payable)
    if (filter.categoryId) {
      results = results.filter((i) => i.payable?.category_id === filter.categoryId)
    }

    // Busca textual (descrição, fornecedor, documento)
    if (filter.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase().trim()
      results = results.filter((item) => {
        const desc = item.payable?.description?.toLowerCase() || ''
        const doc = item.payable?.document_number?.toLowerCase() || ''
        const supName = item.supplier?.name?.toLowerCase() || ''
        const supDoc = item.supplier?.document?.toLowerCase() || ''
        return desc.includes(q) || doc.includes(q) || supName.includes(q) || supDoc.includes(q)
      })
    }

    return results
  },

  /**
   * Criação de Conta a Pagar com parcelamento e divisão em centavos
   */
  async createPayable(payload: CreatePayablePayload): Promise<AccountPayable> {
    const client = getClient()
    const { data: userAuth } = await client.auth.getUser()

    const discount = payload.discount_amount || 0
    const interest = payload.interest_amount || 0
    const fine = payload.fine_amount || 0
    const netTotal = Math.max(0, payload.original_amount - discount + interest + fine)
    const count = Math.max(1, payload.installments_count)
    const interval = payload.interval_days || 30
    const docNumber = payload.document_number?.trim() || `PAG-${Date.now().toString().slice(-6)}`

    // Resolução segura de filial (branch_id)
    let targetBranchId = payload.branch_id
    if (!isValidUUID(targetBranchId) || targetBranchId === 'all') {
      const { data: branches } = await client
        .from('branches')
        .select('id, branch_type')
        .eq('company_id', payload.company_id)
        .order('created_at', { ascending: true })

      const hq = branches?.find((b: any) => b.branch_type === 'matriz') || branches?.[0]
      if (hq) {
        targetBranchId = hq.id
      }
    }

    if (!isValidUUID(targetBranchId)) {
      throw new Error('Nenhuma filial válida encontrada para vincular à despesa. Verifique o cadastro de filiais.')
    }

    // Resolução segura de categoria (category_id)
    let targetCategoryId: string | null = payload.category_id || null
    if (targetCategoryId && !isValidUUID(targetCategoryId)) {
      const { data: foundCat } = await client
        .from('financial_categories')
        .select('id')
        .eq('company_id', payload.company_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      targetCategoryId = foundCat?.id || null
    }

    // Resolução segura de fornecedor (supplier_id)
    let targetSupplierId: string | null = payload.supplier_id || null
    if (targetSupplierId && !isValidUUID(targetSupplierId)) {
      targetSupplierId = null
    }

    // 1. Inserir Conta a Pagar Principal
    const { data: payable, error: pErr } = await client
      .from('accounts_payable')
      .insert({
        company_id: payload.company_id,
        branch_id: targetBranchId,
        supplier_id: targetSupplierId,
        category_id: targetCategoryId,
        document_number: docNumber,
        description: payload.description.trim(),
        issue_date: payload.issue_date || new Date().toISOString().split('T')[0],
        competence_date: payload.competence_date || null,
        due_date: payload.due_date,
        original_amount: payload.original_amount,
        discount_amount: discount,
        interest_amount: interest,
        fine_amount: fine,
        total_amount: netTotal,
        paid_amount: 0,
        balance_amount: netTotal,
        installments_count: count,
        status: netTotal <= 0.009 ? 'paid' : 'pending',
        notes: payload.notes?.trim() || null,
        attachment_url: payload.attachment_url || null,
        created_by: userAuth.user?.id,
      })
      .select('*')
      .single()

    if (pErr || !payable) {
      throw new Error(pErr?.message || 'Falha ao registrar conta a pagar no banco de dados.')
    }

    // 2. Gerar parcelas com divisão exata de centavos (soma total idêntica)
    if (netTotal > 0) {
      const totalCents = Math.round(netTotal * 100)
      const baseCents = Math.floor(totalCents / count)
      const remainderCents = totalCents - baseCents * count

      const baseDate = new Date(payload.due_date)
      const installmentsToInsert = []

      for (let i = 1; i <= count; i++) {
        const instCents = i === 1 ? baseCents + remainderCents : baseCents
        const instAmount = instCents / 100

        const dueDate = new Date(baseDate)
        if (i > 1) {
          dueDate.setDate(dueDate.getDate() + (i - 1) * interval)
        }
        const dueStr = dueDate.toISOString().split('T')[0]

        installmentsToInsert.push({
          payable_id: payable.id,
          company_id: payload.company_id,
          branch_id: targetBranchId,
          supplier_id: targetSupplierId,
          installment_number: i,
          due_date: dueStr,
          amount: instAmount,
          paid_amount: 0,
          balance_amount: instAmount,
          status: 'pending',
        })
      }

      const { error: instErr } = await client
        .from('accounts_payable_installments')
        .insert(installmentsToInsert)

      if (instErr) {
        console.warn('Erro ao inserir parcelas:', instErr)
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial-records-changed'))
    }

    return payable as AccountPayable
  },

  /**
   * Baixa / Pagamento de parcela de conta a pagar
   */
  async payInstallment(payload: PayInstallmentPayload): Promise<{
    success: boolean
    payment_id: string
    installment_balance: number
    installment_status: string
  }> {
    const client = getClient()
    try {
      const { data, error } = await client.rpc('pay_payable_installment', {
        p_company_id: payload.company_id,
        p_branch_id: payload.branch_id,
        p_installment_id: payload.installment_id,
        p_amount: payload.amount,
        p_payment_method: payload.payment_method,
        p_cash_session_id: payload.payment_method === 'cash' ? payload.cash_session_id || null : null,
        p_discount: payload.discount || 0,
        p_interest: payload.interest || 0,
        p_fine: payload.fine || 0,
        p_notes: payload.notes || null,
        p_idempotency_key: payload.idempotency_key || crypto.randomUUID(),
      })

      if (error) {
        if (error.code === '42883') {
          return this.fallbackPayInstallment(payload)
        }
        throw error
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('financial-records-changed'))
      }

      return data
    } catch (err: any) {
      if (err.message && err.message.includes('pay_payable_installment')) {
        return this.fallbackPayInstallment(payload)
      }
      throw err
    }
  },

  /**
   * Fallback de pagamento direto via tabelas
   */
  async fallbackPayInstallment(payload: PayInstallmentPayload) {
    const client = getClient()
    const { data: inst, error: fetchErr } = await client
      .from('accounts_payable_installments')
      .select('*, payable:accounts_payable(*)')
      .eq('id', payload.installment_id)
      .single()

    if (fetchErr || !inst) throw new Error('Parcela de conta a pagar não encontrada.')

    if (payload.amount > Number(inst.balance_amount || 0) + 0.009) {
      throw new Error(`Valor informado (R$ ${payload.amount.toFixed(2)}) é maior que o saldo devedor (R$ ${Number(inst.balance_amount).toFixed(2)}).`)
    }

    const newPaid = Math.round((Number(inst.paid_amount || 0) + payload.amount) * 100) / 100
    const newBal = Math.max(0, Math.round((Number(inst.balance_amount || 0) - payload.amount) * 100) / 100)
    const newStatus = newBal <= 0.009 ? 'paid' : 'partially_paid'

    // Se em dinheiro com caixa aberto, registra movimento de despesa no caixa
    let cashMovId: string | null = null
    const { data: userAuth } = await client.auth.getUser()

    if (payload.payment_method === 'cash' && payload.cash_session_id) {
      try {
        const { data: mov } = await client
          .from('cash_movements')
          .insert({
            company_id: payload.company_id,
            branch_id: payload.branch_id,
            cash_session_id: payload.cash_session_id,
            movement_type: 'expense',
            amount: payload.amount,
            reason: `Pagamento despesa: ${inst.payable?.description || 'Conta a pagar'}`,
            user_id: userAuth.user?.id || '00000000-0000-0000-0000-000000000000',
            notes: payload.notes || null,
          })
          .select('id')
          .single()
        if (mov) cashMovId = mov.id
      } catch (cErr) {
        console.warn('Aviso ao registrar movimento no caixa:', cErr)
      }
    }

    // Atualiza parcela
    await client
      .from('accounts_payable_installments')
      .update({
        paid_amount: newPaid,
        balance_amount: newBal,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inst.id)

    // Atualiza conta pai
    const payable = inst.payable
    if (payable) {
      const pPaid = Math.round((Number(payable.paid_amount || 0) + payload.amount) * 100) / 100
      const pBal = Math.max(0, Math.round((Number(payable.balance_amount || 0) - payload.amount) * 100) / 100)
      const pStatus = pBal <= 0.009 ? 'paid' : 'partially_paid'

      await client
        .from('accounts_payable')
        .update({
          paid_amount: pPaid,
          balance_amount: pBal,
          status: pStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payable.id)
    }

    // Registra no histórico de pagamentos
    const { data: pay } = await client
      .from('payable_payments')
      .insert({
        company_id: payload.company_id,
        branch_id: payload.branch_id,
        payable_id: inst.payable_id,
        installment_id: inst.id,
        supplier_id: inst.supplier_id,
        cash_session_id: payload.cash_session_id || null,
        cash_movement_id: cashMovId,
        amount_paid: payload.amount,
        discount_applied: payload.discount || 0,
        interest_applied: payload.interest || 0,
        fine_applied: payload.fine || 0,
        payment_method: payload.payment_method,
        paid_by: userAuth.user?.id,
        notes: payload.notes,
        idempotency_key: payload.idempotency_key,
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
   * Cancelamento auditado de conta a pagar
   */
  async cancelPayable(companyId: string, payableId: string, reason: string): Promise<boolean> {
    const client = getClient()
    try {
      const { data, error } = await client.rpc('cancel_accounts_payable', {
        p_company_id: companyId,
        p_payable_id: payableId,
        p_reason: reason.trim(),
      })

      if (!error && data?.success) return true
      if (error && error.code !== '42883') {
        throw new Error(error.message || 'Erro ao cancelar conta.')
      }
    } catch (rpcErr: any) {
      if (rpcErr.message && !rpcErr.message.includes('42883') && !rpcErr.message.includes('cancel_accounts_payable')) {
        throw rpcErr
      }
    }

    // Fallback direto
    const { data: payable } = await client
      .from('accounts_payable')
      .select('*')
      .eq('id', payableId)
      .eq('company_id', companyId)
      .single()

    if (!payable) throw new Error('Conta a pagar não encontrada.')
    if (Number(payable.paid_amount || 0) > 0.009) {
      throw new Error(`Não é possível cancelar uma conta com pagamentos realizados (R$ ${Number(payable.paid_amount).toFixed(2)}).`)
    }

    const { data: userAuth } = await client.auth.getUser()
    await client
      .from('accounts_payable')
      .update({
        status: 'cancelled',
        cancellation_reason: reason.trim(),
        cancelled_by: userAuth.user?.id,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payableId)

    await client
      .from('accounts_payable_installments')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('payable_id', payableId)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial-records-changed'))
    }

    return true
  },

  /**
   * Sincroniza e limpa contas a pagar órfãs (registros cujo lançamento foi excluído
   * mas o pai permaneceu sem parcelas ativas no banco de dados)
   */
  async cleanupOrphanedPayables(companyId: string): Promise<void> {
    try {
      const client = getClient()
      const { data: payables } = await client
        .from('accounts_payable')
        .select('id')
        .eq('company_id', companyId)
        .neq('status', 'cancelled')

      if (!payables || payables.length === 0) return

      const payableIds = payables.map((p) => p.id)

      const { data: activeInsts } = await client
        .from('accounts_payable_installments')
        .select('payable_id')
        .eq('company_id', companyId)
        .in('payable_id', payableIds)

      const activeSet = new Set((activeInsts || []).map((i) => i.payable_id))
      const orphanIds = payableIds.filter((id) => !activeSet.has(id))

      if (orphanIds.length > 0) {
        // Marca as órfãs como canceladas com saldo zero e tenta exclusão física
        await client
          .from('accounts_payable')
          .update({
            status: 'cancelled',
            balance_amount: 0,
            cancellation_reason: 'Órfão sincronizado e removido',
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId)
          .in('id', orphanIds)

        await client
          .from('accounts_payable')
          .delete()
          .eq('company_id', companyId)
          .in('id', orphanIds)
      }
    } catch (e) {
      console.warn('Aviso ao sincronizar contas a pagar órfãs:', e)
    }
  },

  /**
   * Exclusão de Conta a Pagar e suas parcelas
   * Bloqueia exclusão se houver pagamentos parciais ou totais realizados
   */
  async deletePayable(companyId: string, payableId: string): Promise<boolean> {
    const client = getClient()

    // 1. Verifica se há pagamentos registrados para a despesa
    const { data: payments, error: payErr } = await client
      .from('payable_payments')
      .select('id, amount_paid')
      .eq('company_id', companyId)
      .eq('payable_id', payableId)

    if (payErr) {
      console.warn('Aviso ao consultar pagamentos de contas a pagar:', payErr)
    }

    if (payments && payments.length > 0) {
      const sum = payments.reduce((acc, p) => acc + Number(p.amount_paid || 0), 0)
      throw new Error(`Não é possível excluir esta conta a pagar pois existem pagamentos realizados (R$ ${sum.toFixed(2)}). Estorne os pagamentos antes de excluir.`)
    }

    // 2. Tenta exclusão atômica via RPC delete_accounts_payable se existir
    try {
      const { data: rpcRes, error: rpcErr } = await client.rpc('delete_accounts_payable', {
        p_company_id: companyId,
        p_payable_id: payableId,
      })

      if (!rpcErr && rpcRes?.success) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('financial-records-changed'))
        }
        return true
      }
      if (rpcErr && rpcErr.code !== '42883' && rpcErr.code !== 'PGRST202') {
        console.warn('Aviso ao executar RPC delete_accounts_payable:', rpcErr)
      }
    } catch (rpcEx: any) {
      // Continua para fallback seguro
    }

    // 3. Fallback Seguro: Atualiza o registro pai para CANCELADO com saldo ZERO
    // (A tabela accounts_payable tem política de UPDATE ativa, garantindo sucesso imediato)
    try {
      const { data: userAuth } = await client.auth.getUser()
      await client
        .from('accounts_payable')
        .update({
          status: 'cancelled',
          balance_amount: 0,
          paid_amount: 0,
          cancellation_reason: 'Excluído pelo usuário',
          cancelled_by: userAuth?.user?.id || null,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)
        .eq('id', payableId)
    } catch (updErr) {
      console.warn('Aviso ao cancelar conta pai antes de excluir parcelas:', updErr)
    }

    // 4. Remove as parcelas vinculadas (accounts_payable_installments tem política ALL ativa)
    const { error: instErr } = await client
      .from('accounts_payable_installments')
      .delete()
      .eq('company_id', companyId)
      .eq('payable_id', payableId)

    if (instErr) {
      throw new Error(instErr.message || 'Erro ao excluir parcelas da conta a pagar.')
    }

    // 5. Tenta a exclusão física do registro principal
    try {
      await client
        .from('accounts_payable')
        .delete()
        .eq('company_id', companyId)
        .eq('id', payableId)
    } catch (delErr) {
      console.warn('Aviso na exclusão física da conta a pagar:', delErr)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial-records-changed'))
    }

    return true
  },

  /**
   * Histórico de pagamentos de uma parcela
   */
  async getInstallmentPayments(installmentId: string): Promise<PayablePayment[]> {
    const client = getClient()
    const { data, error } = await client
      .from('payable_payments')
      .select('*')
      .eq('installment_id', installmentId)
      .order('payment_date', { ascending: false })

    if (error) {
      console.warn('Erro ao carregar pagamentos da despesa:', error)
      return []
    }
    return (data || []) as PayablePayment[]
  },

  /**
   * Resumo de KPIs da página Contas a Pagar
   */
  async getPayableKpis(companyId: string, branchId?: string): Promise<PayableKpis> {
    const client = getClient()
    let query = client
      .from('accounts_payable_installments')
      .select(`
        balance_amount,
        paid_amount,
        due_date,
        status,
        payable:accounts_payable ( status )
      `)
      .eq('company_id', companyId)
      .neq('status', 'cancelled')

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query
    if (error) {
      console.warn('Aviso ao carregar KPIs de contas a pagar:', error)
      return {
        totalOpen: 0,
        totalOverdue: 0,
        totalDueToday: 0,
        totalDueUpcoming: 0,
        totalPaidPeriod: 0,
        countDueSoon: 0,
        totalCount: 0,
      }
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const in7Days = new Date()
    in7Days.setDate(in7Days.getDate() + 7)
    const in7DaysStr = in7Days.toISOString().split('T')[0]

    let totalOpen = 0
    let totalOverdue = 0
    let totalDueToday = 0
    let totalDueUpcoming = 0
    let totalPaid = 0
    let countDueSoon = 0

    const items = data || []
    for (const item of items) {
      const parent = Array.isArray(item.payable) ? item.payable[0] : item.payable
      if (parent && parent.status === 'cancelled') continue

      const bal = Number(item.balance_amount || 0)
      const paid = Number(item.paid_amount || 0)
      totalPaid += paid

      if (['pending', 'partially_paid', 'overdue'].includes(item.status) && bal > 0.009) {
        totalOpen += bal
        if (item.due_date < todayStr) {
          totalOverdue += bal
        } else if (item.due_date === todayStr) {
          totalDueToday += bal
        } else {
          totalDueUpcoming += bal
        }

        if (item.due_date >= todayStr && item.due_date <= in7DaysStr) {
          countDueSoon++
        }
      }
    }

    return {
      totalOpen: Math.round(totalOpen * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      totalDueToday: Math.round(totalDueToday * 100) / 100,
      totalDueUpcoming: Math.round(totalDueUpcoming * 100) / 100,
      totalPaidPeriod: Math.round(totalPaid * 100) / 100,
      countDueSoon,
      totalCount: items.length,
    }
  },
}
