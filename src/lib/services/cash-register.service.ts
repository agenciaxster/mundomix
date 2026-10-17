import { supabase } from '@/lib/supabase'
import type {
  CashSession,
  CashMovement,
  OpenCashSessionPayload,
  AddCashMovementPayload,
  CloseCashSessionPayload,
  VerifyCashSessionPayload,
  CashSessionLiveSummary,
} from '@/types/cash-register'

const LOCAL_CASH_PREFIX = 'erp_cash_session_'

export const cashRegisterService = {
  /**
   * Obtém a sessão de caixa aberta atual para a filial e operador.
   */
  async getCurrentOpenSession(
    companyId: string,
    branchId: string,
    userId?: string
  ): Promise<CashSession | null> {
    if (!companyId || !branchId) return null

    if (supabase) {
      try {
        let query = supabase
          .from('cash_sessions')
          .select('*')
          .eq('company_id', companyId)
          .eq('branch_id', branchId)
          .eq('status', 'open')

        if (userId) {
          query = query.eq('opened_by', userId)
        }

        const { data, error } = await query
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!error && data) {
          const session = this.mapSessionRow(data)
          this.saveLocalSession(companyId, branchId, session)
          return session
        }

        // Se buscou com userId e não achou, tenta achar qualquer sessão aberta no terminal/filial
        if (userId) {
          const { data: generalData, error: genErr } = await supabase
            .from('cash_sessions')
            .select('*')
            .eq('company_id', companyId)
            .eq('branch_id', branchId)
            .eq('status', 'open')
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (!genErr && generalData) {
            const session = this.mapSessionRow(generalData)
            this.saveLocalSession(companyId, branchId, session)
            return session
          }
        }
      } catch (err) {
        console.warn('[cashRegisterService] Aviso ao consultar sessão aberta no Supabase:', err)
      }
    }

    // Fallback: tenta recuperar do localStorage
    const local = this.getLocalSession(companyId, branchId)
    if (local && local.status === 'open') {
      return local
    }
    return null
  },

  /**
   * Abre uma nova sessão de caixa.
   */
  async openSession(payload: OpenCashSessionPayload): Promise<CashSession> {
    if (!supabase) throw new Error('Cliente Supabase não configurado.')

    const { data: authUser } = await supabase.auth.getUser()
    const userId = authUser?.user?.id
    if (!userId) throw new Error('Usuário não autenticado para abrir caixa.')

    // Tenta via RPC
    try {
      const { data, error } = await supabase.rpc('open_cash_session', {
        p_company_id: payload.company_id,
        p_branch_id: payload.branch_id,
        p_terminal_name: payload.terminal_name,
        p_initial_amount: payload.initial_amount,
        p_opening_notes: payload.opening_notes || null,
      })

      if (!error && data?.success) {
        const full = await this.getSessionById(data.session_id, payload.company_id)
        if (full) {
          this.saveLocalSession(payload.company_id, payload.branch_id, full)
          return full
        }
      } else if (error && error.code !== '42883') {
        throw new Error(error.message || 'Erro ao abrir caixa.')
      }
    } catch (rpcErr: any) {
      if (rpcErr.message && !rpcErr.message.includes('42883') && !rpcErr.message.includes('open_cash_session')) {
        throw rpcErr
      }
    }

    // Fallback via tabela
    // Verifica se já existe caixa aberto
    const { data: existing } = await supabase
      .from('cash_sessions')
      .select('id, terminal_name, opened_by_name')
      .eq('branch_id', payload.branch_id)
      .eq('status', 'open')

    if (existing && existing.length > 0) {
      const match = existing.find((e) => e.terminal_name === payload.terminal_name)
      if (match) {
        throw new Error(`O terminal "${payload.terminal_name}" já está com caixa aberto.`)
      }
    }

    let userName = 'Operador'
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle()
      if (prof?.full_name) userName = prof.full_name
    } catch {
      // Ignora erro de perfil
    }

    const newRow = {
      company_id: payload.company_id,
      branch_id: payload.branch_id,
      terminal_name: payload.terminal_name || 'Caixa 01',
      opened_by: userId,
      opened_by_name: userName,
      opened_at: new Date().toISOString(),
      initial_amount: Math.max(0, Number(payload.initial_amount || 0)),
      opening_notes: payload.opening_notes || null,
      status: 'open' as const,
      total_sales_cash: 0,
      total_sales_pix: 0,
      total_sales_debit: 0,
      total_sales_credit: 0,
      total_sales_store_credit: 0,
      total_sales_other: 0,
      total_sales_count: 0,
      total_supplies: 0,
      total_bleed: 0,
      total_expenses: 0,
    }

    const { data: created, error: insErr } = await supabase
      .from('cash_sessions')
      .insert(newRow)
      .select('*')
      .single()

    if (insErr || !created) {
      throw new Error(insErr?.message || 'Falha ao registrar abertura de caixa.')
    }

    const session = this.mapSessionRow(created)
    this.saveLocalSession(payload.company_id, payload.branch_id, session)
    return session
  },

  /**
   * Adiciona movimentação (Suprimento, Sangria ou Despesa) ao caixa aberto.
   */
  async addMovement(payload: AddCashMovementPayload): Promise<CashMovement> {
    if (!supabase) throw new Error('Cliente Supabase não configurado.')
    if (payload.amount <= 0) throw new Error('O valor da movimentação deve ser maior que zero.')
    if (!payload.reason.trim()) throw new Error('O motivo da movimentação é obrigatório.')

    const { data: authUser } = await supabase.auth.getUser()
    const userId = authUser?.user?.id
    if (!userId) throw new Error('Operador não autenticado.')

    // Tenta via RPC
    try {
      const { data, error } = await supabase.rpc('add_cash_movement', {
        p_company_id: payload.company_id,
        p_branch_id: payload.branch_id,
        p_cash_session_id: payload.cash_session_id,
        p_movement_type: payload.movement_type,
        p_amount: payload.amount,
        p_reason: payload.reason.trim(),
        p_notes: payload.notes || null,
        p_receipt_url: payload.receipt_url || null,
        p_authorized_by: payload.authorized_by || null,
      })

      if (!error && data?.success) {
        const { data: mov } = await supabase
          .from('cash_movements')
          .select('*')
          .eq('id', data.movement_id)
          .single()
        if (mov) return this.mapMovementRow(mov)
      } else if (error && error.code !== '42883') {
        throw new Error(error.message || 'Erro ao registrar movimentação de caixa.')
      }
    } catch (rpcErr: any) {
      if (rpcErr.message && !rpcErr.message.includes('42883') && !rpcErr.message.includes('add_cash_movement')) {
        throw rpcErr
      }
    }

    // Fallback direto via tabela
    let userName = 'Operador'
    try {
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
      if (prof?.full_name) userName = prof.full_name
    } catch {}

    let authName: string | null = null
    if (payload.authorized_by) {
      try {
        const { data: aProf } = await supabase.from('profiles').select('full_name').eq('id', payload.authorized_by).maybeSingle()
        if (aProf?.full_name) authName = aProf.full_name
      } catch {}
    }

    const { data: movData, error: mErr } = await supabase
      .from('cash_movements')
      .insert({
        company_id: payload.company_id,
        branch_id: payload.branch_id,
        cash_session_id: payload.cash_session_id,
        movement_type: payload.movement_type,
        amount: Math.round(payload.amount * 100) / 100,
        reason: payload.reason.trim(),
        notes: payload.notes || null,
        receipt_url: payload.receipt_url || null,
        user_id: userId,
        user_name: userName,
        authorized_by: payload.authorized_by || null,
        authorized_by_name: authName,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (mErr || !movData) {
      throw new Error(mErr?.message || 'Falha ao registrar movimentação no banco.')
    }

    return this.mapMovementRow(movData)
  },

  /**
   * Realiza o fechamento definitivo de um caixa com apuração real e contagem.
   */
  async closeSession(payload: CloseCashSessionPayload): Promise<CashSession> {
    if (!supabase) throw new Error('Cliente Supabase não configurado.')
    if (payload.counted_cash === undefined || payload.counted_cash < 0) {
      throw new Error('Informe o valor físico contado em dinheiro na gaveta.')
    }

    const { data: authUser } = await supabase.auth.getUser()
    const userId = authUser?.user?.id
    if (!userId) throw new Error('Usuário não autenticado.')

    // Tenta via RPC
    try {
      const { data, error } = await supabase.rpc('close_cash_session', {
        p_company_id: payload.company_id,
        p_session_id: payload.session_id,
        p_counted_cash: payload.counted_cash,
        p_closing_notes: payload.closing_notes || null,
        p_difference_reason: payload.difference_reason || null,
      })

      if (!error && data?.success) {
        const closed = await this.getSessionById(payload.session_id, payload.company_id)
        if (closed) {
          this.removeLocalSession(payload.company_id, closed.branch_id)
          return closed
        }
      } else if (error && error.code !== '42883') {
        throw new Error(error.message || 'Erro ao fechar caixa.')
      }
    } catch (rpcErr: any) {
      if (rpcErr.message && !rpcErr.message.includes('42883') && !rpcErr.message.includes('close_cash_session')) {
        throw rpcErr
      }
    }

    // Fallback controlado
    const live = await this.getLiveSessionSummary(payload.session_id, payload.company_id)
    const expected = live.expectedCashNow
    const difference = Math.round((payload.counted_cash - expected) * 100) / 100

    let userName = 'Operador'
    try {
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
      if (prof?.full_name) userName = prof.full_name
    } catch {}

    const { data: updated, error: uErr } = await supabase
      .from('cash_sessions')
      .update({
        status: 'closed',
        closed_by: userId,
        closed_by_name: userName,
        closed_at: new Date().toISOString(),
        closing_notes: payload.closing_notes || null,
        counted_cash: Math.round(payload.counted_cash * 100) / 100,
        expected_cash: expected,
        difference_cash: difference,
        difference_reason: payload.difference_reason || null,
        total_sales_cash: live.salesCash,
        total_sales_pix: live.salesPix,
        total_sales_debit: live.salesDebit,
        total_sales_credit: live.salesCredit,
        total_sales_store_credit: live.salesStoreCredit,
        total_sales_other: live.salesOther,
        total_sales_count: live.salesCount,
        total_supplies: live.suppliesTotal,
        total_bleed: live.bleedTotal,
        total_expenses: live.expensesTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.session_id)
      .select('*')
      .single()

    if (uErr || !updated) {
      throw new Error(uErr?.message || 'Falha ao gravar fechamento de caixa.')
    }

    const closed = this.mapSessionRow(updated)
    this.removeLocalSession(payload.company_id, closed.branch_id)
    return closed
  },

  /**
   * Registra a conferência / auditoria gerencial sobre a divergência do fechamento.
   */
  async verifySession(payload: VerifyCashSessionPayload): Promise<CashSession> {
    if (!supabase) throw new Error('Cliente Supabase não configurado.')

    const { data: authUser } = await supabase.auth.getUser()
    const userId = authUser?.user?.id
    if (!userId) throw new Error('Usuário não autenticado.')

    // Tenta via RPC
    try {
      const { data, error } = await supabase.rpc('verify_cash_session', {
        p_company_id: payload.company_id,
        p_session_id: payload.session_id,
        p_verification_notes: payload.verification_notes.trim(),
      })

      if (!error && data?.success) {
        const full = await this.getSessionById(payload.session_id, payload.company_id)
        if (full) return full
      }
    } catch {}

    // Fallback
    let userName = 'Gerente'
    try {
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
      if (prof?.full_name) userName = prof.full_name
    } catch {}

    const { data: updated, error: uErr } = await supabase
      .from('cash_sessions')
      .update({
        verified_by: userId,
        verified_by_name: userName,
        verified_at: new Date().toISOString(),
        verification_notes: payload.verification_notes.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.session_id)
      .select('*')
      .single()

    if (uErr || !updated) {
      throw new Error(uErr?.message || 'Falha ao registrar conferência gerencial.')
    }

    return this.mapSessionRow(updated)
  },

  /**
   * Obtém os detalhes completos de uma sessão de caixa por ID.
   */
  async getSessionById(sessionId: string, companyId: string): Promise<CashSession | null> {
    if (!supabase || !sessionId) return null

    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error || !data) return null
    return this.mapSessionRow(data)
  },

  /**
   * Obtém o resumo dinâmico e apuração em tempo real de uma sessão (vendas, movimentações, saldo esperado).
   */
  async getLiveSessionSummary(sessionId: string, companyId: string): Promise<CashSessionLiveSummary> {
    const session = await this.getSessionById(sessionId, companyId)
    if (!session) throw new Error('Sessão de caixa não encontrada.')

    if (!supabase) {
      return {
        session,
        movements: [],
        salesCount: 0,
        salesCash: 0,
        salesPix: 0,
        salesDebit: 0,
        salesCredit: 0,
        salesStoreCredit: 0,
        salesOther: 0,
        salesTotal: 0,
        suppliesTotal: 0,
        bleedTotal: 0,
        expensesTotal: 0,
        expectedCashNow: session.initial_amount,
      }
    }

    // 1. Busca movimentações
    const { data: movs } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('cash_session_id', sessionId)
      .order('created_at', { ascending: true })

    const movements = (movs || []).map((m) => this.mapMovementRow(m))

    let suppliesTotal = 0
    let bleedTotal = 0
    let expensesTotal = 0

    for (const m of movements) {
      if (m.movement_type === 'supply') suppliesTotal += m.amount
      else if (m.movement_type === 'bleed') bleedTotal += m.amount
      else if (m.movement_type === 'expense') expensesTotal += m.amount
    }

    // 2. Busca vendas concluídas vinculadas à sessão
    const { data: salesData } = await supabase
      .from('sales')
      .select(`
        id, total, status,
        payments:sale_payments (payment_method, amount)
      `)
      .eq('cash_session_id', sessionId)
      .eq('status', 'completed')

    let salesCount = (salesData || []).length
    let salesCash = 0
    let salesPix = 0
    let salesDebit = 0
    let salesCredit = 0
    let salesStoreCredit = 0
    let salesOther = 0

    if (salesData) {
      for (const sale of salesData) {
        const payments = (sale as any).payments || []
        for (const p of payments) {
          const amt = Number(p.amount || 0)
          switch (p.payment_method) {
            case 'cash':
              salesCash += amt
              break
            case 'pix':
              salesPix += amt
              break
            case 'debit_card':
              salesDebit += amt
              break
            case 'credit_card':
              salesCredit += amt
              break
            case 'store_credit':
              salesStoreCredit += amt
              break
            default:
              salesOther += amt
              break
          }
        }
      }
    }

    // Arredondamentos
    salesCash = Math.round(salesCash * 100) / 100
    salesPix = Math.round(salesPix * 100) / 100
    salesDebit = Math.round(salesDebit * 100) / 100
    salesCredit = Math.round(salesCredit * 100) / 100
    salesStoreCredit = Math.round(salesStoreCredit * 100) / 100
    salesOther = Math.round(salesOther * 100) / 100
    const salesTotal = Math.round((salesCash + salesPix + salesDebit + salesCredit + salesStoreCredit + salesOther) * 100) / 100

    suppliesTotal = Math.round(suppliesTotal * 100) / 100
    bleedTotal = Math.round(bleedTotal * 100) / 100
    expensesTotal = Math.round(expensesTotal * 100) / 100

    // Dinheiro esperado = fundo inicial + recebimentos líquidos em dinheiro + suprimentos − sangrias − despesas pagas em dinheiro
    const expectedCashNow = Math.round((session.initial_amount + salesCash + suppliesTotal - bleedTotal - expensesTotal) * 100) / 100

    return {
      session,
      movements,
      salesCount,
      salesCash,
      salesPix,
      salesDebit,
      salesCredit,
      salesStoreCredit,
      salesOther,
      salesTotal,
      suppliesTotal,
      bleedTotal,
      expensesTotal,
      expectedCashNow,
    }
  },

  /**
   * Lista o histórico de sessões de caixa com filtros para a gerência/auditoria.
   */
  async listSessions(
    companyId: string,
    filters?: {
      branchId?: string
      status?: string
      dateFrom?: string
      dateTo?: string
      operatorId?: string
    }
  ): Promise<CashSession[]> {
    if (!supabase || !companyId) return []

    let query = supabase
      .from('cash_sessions')
      .select('*')
      .eq('company_id', companyId)

    if (filters?.branchId && filters.branchId !== 'all') {
      query = query.eq('branch_id', filters.branchId)
    }

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    if (filters?.operatorId && filters.operatorId !== 'all') {
      query = query.eq('opened_by', filters.operatorId)
    }

    if (filters?.dateFrom) {
      query = query.gte('opened_at', filters.dateFrom)
    }

    if (filters?.dateTo) {
      query = query.lte('opened_at', `${filters.dateTo}T23:59:59.999Z`)
    }

    const { data, error } = await query.order('opened_at', { ascending: false })

    if (error || !data) return []
    return data.map((d) => this.mapSessionRow(d))
  },

  /**
   * Busca as movimentações de uma sessão.
   */
  async getMovements(sessionId: string): Promise<CashMovement[]> {
    if (!supabase || !sessionId) return []
    const { data, error } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('cash_session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error || !data) return []
    return data.map((d) => this.mapMovementRow(d))
  },

  // Helpers de Mapeamento
  mapSessionRow(row: any): CashSession {
    return {
      id: row.id,
      company_id: row.company_id,
      branch_id: row.branch_id,
      terminal_name: row.terminal_name || 'Caixa 01',
      opened_by: row.opened_by,
      opened_by_name: row.opened_by_name,
      opened_at: row.opened_at,
      initial_amount: Number(row.initial_amount || 0),
      opening_notes: row.opening_notes,
      status: row.status,
      closed_by: row.closed_by,
      closed_by_name: row.closed_by_name,
      closed_at: row.closed_at,
      closing_notes: row.closing_notes,
      counted_cash: row.counted_cash !== null && row.counted_cash !== undefined ? Number(row.counted_cash) : null,
      expected_cash: row.expected_cash !== null && row.expected_cash !== undefined ? Number(row.expected_cash) : null,
      difference_cash: row.difference_cash !== null && row.difference_cash !== undefined ? Number(row.difference_cash) : null,
      difference_reason: row.difference_reason,
      total_sales_cash: Number(row.total_sales_cash || 0),
      total_sales_pix: Number(row.total_sales_pix || 0),
      total_sales_debit: Number(row.total_sales_debit || 0),
      total_sales_credit: Number(row.total_sales_credit || 0),
      total_sales_store_credit: Number(row.total_sales_store_credit || 0),
      total_sales_other: Number(row.total_sales_other || 0),
      total_sales_count: Number(row.total_sales_count || 0),
      total_supplies: Number(row.total_supplies || 0),
      total_bleed: Number(row.total_bleed || 0),
      total_expenses: Number(row.total_expenses || 0),
      verified_by: row.verified_by,
      verified_by_name: row.verified_by_name,
      verified_at: row.verified_at,
      verification_notes: row.verification_notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  },

  mapMovementRow(row: any): CashMovement {
    return {
      id: row.id,
      company_id: row.company_id,
      branch_id: row.branch_id,
      cash_session_id: row.cash_session_id,
      movement_type: row.movement_type,
      amount: Number(row.amount || 0),
      reason: row.reason,
      user_id: row.user_id,
      user_name: row.user_name,
      authorized_by: row.authorized_by,
      authorized_by_name: row.authorized_by_name,
      receipt_url: row.receipt_url,
      notes: row.notes,
      created_at: row.created_at,
    }
  },

  // Cache local de segurança
  getLocalSession(companyId: string, branchId: string): CashSession | null {
    try {
      const stored = localStorage.getItem(`${LOCAL_CASH_PREFIX}${companyId}_${branchId}`)
      if (stored) return JSON.parse(stored)
    } catch {}
    return null
  },

  saveLocalSession(companyId: string, branchId: string, session: CashSession): void {
    try {
      localStorage.setItem(`${LOCAL_CASH_PREFIX}${companyId}_${branchId}`, JSON.stringify(session))
    } catch {}
  },

  removeLocalSession(companyId: string, branchId: string): void {
    try {
      localStorage.removeItem(`${LOCAL_CASH_PREFIX}${companyId}_${branchId}`)
    } catch {}
  },
}
