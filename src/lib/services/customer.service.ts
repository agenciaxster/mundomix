import { supabase } from '@/lib/supabase'
import type {
  Customer,
  CustomerCreditHistory,
  CustomerFormData,
  CustomerFilters,
  CustomerKpis,
} from '@/types/customer'
import { onlyDigits, validateCpf, validateCnpj } from '@/lib/utils/masks'

export const customerService = {
  /**
   * Lista os clientes da empresa com suporte a paginação e filtros.
   */
  async listCustomers(
    companyId: string,
    filters?: CustomerFilters
  ): Promise<{ data: Customer[]; totalCount: number }> {
    if (!supabase) return { data: [], totalCount: 0 }

    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('customers')
      .select(
        `
        id,
        company_id,
        origin_branch_id,
        person_type,
        name,
        trade_name,
        document,
        state_registration,
        email,
        phone,
        whatsapp,
        zip_code,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        credit_limit,
        credit_status,
        status,
        notes,
        created_by,
        created_at,
        updated_at,
        origin_branch:branches (id, name, code)
      `,
        { count: 'exact' }
      )
      .eq('company_id', companyId)

    // Filtro por tipo (individual/company)
    if (filters?.personType && filters.personType !== 'all') {
      query = query.eq('person_type', filters.personType)
    }

    // Filtro por status
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    // Filtro por status de crédito
    if (filters?.creditStatus && filters.creditStatus !== 'all') {
      query = query.eq('credit_status', filters.creditStatus)
    }

    // Busca textual inteligente (nome, trade_name, documento sem formatação ou telefone)
    if (filters?.search && filters.search.trim()) {
      const s = filters.search.trim()
      const digits = onlyDigits(s)
      if (digits.length >= 3) {
        query = query.or(
          `name.ilike.%${s}%,trade_name.ilike.%${s}%,document.ilike.%${digits}%,phone.ilike.%${digits}%,whatsapp.ilike.%${digits}%`
        )
      } else {
        query = query.or(`name.ilike.%${s}%,trade_name.ilike.%${s}%,email.ilike.%${s}%`)
      }
    }

    const { data, count, error } = await query
      .order('name', { ascending: true })
      .range(from, to)

    if (error) {
      console.warn('Tentando fallback simples para listar clientes sem join de filial:', error)
      const { data: simpleData, count: simpleCount, error: simpleErr } = await supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .order('name', { ascending: true })
        .range(from, to)

      if (simpleErr) {
        console.error('Erro ao listar clientes no fallback:', simpleErr)
        throw new Error(simpleErr.message || 'Erro ao carregar clientes.')
      }

      const fallbackCustomers: Customer[] = (simpleData || []).map((row: any) => ({
        ...row,
        credit_limit: Number(row.credit_limit || 0),
      }))

      return {
        data: fallbackCustomers,
        totalCount: simpleCount || 0,
      }
    }

    const customers: Customer[] = (data || []).map((row: any) => ({
      ...row,
      credit_limit: Number(row.credit_limit || 0),
      origin_branch: Array.isArray(row.origin_branch)
        ? row.origin_branch[0]
        : row.origin_branch,
    }))

    return {
      data: customers,
      totalCount: count || 0,
    }
  },

  /**
   * Busca um cliente pelo ID com validação de escopo empresarial.
   */
  async getCustomer(id: string, companyId: string): Promise<Customer | null> {
    if (!supabase) return null

    const { data, error } = await supabase
      .from('customers')
      .select(`
        id,
        company_id,
        origin_branch_id,
        person_type,
        name,
        trade_name,
        document,
        state_registration,
        email,
        phone,
        whatsapp,
        zip_code,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        credit_limit,
        credit_status,
        status,
        notes,
        created_by,
        created_at,
        updated_at,
        origin_branch:branches (id, name, code)
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar cliente:', error)
      throw new Error(error.message || 'Cliente não encontrado.')
    }

    if (!data) return null

    return {
      ...(data as any),
      credit_limit: Number(data.credit_limit || 0),
      origin_branch: Array.isArray(data.origin_branch)
        ? data.origin_branch[0]
        : data.origin_branch,
    } as Customer
  },

  /**
   * Cria um novo cliente na empresa.
   */
  async createCustomer(companyId: string, form: CustomerFormData): Promise<Customer> {
    if (!supabase) throw new Error('Supabase não configurado')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const cleanDoc = onlyDigits(form.document) || null

    if (!cleanDoc) {
      throw new Error(
        `O ${form.person_type === 'individual' ? 'CPF' : 'CNPJ'} é obrigatório e deve ser válido.`
      )
    }

    // Validação matemática estrita de CPF / CNPJ
    if (form.person_type === 'individual') {
      if (!validateCpf(cleanDoc)) {
        throw new Error('CPF inválido. O sistema não permite cadastrar cliente com CPF inválido.')
      }
    } else {
      if (!validateCnpj(cleanDoc)) {
        throw new Error('CNPJ inválido. O sistema não permite cadastrar cliente com CNPJ inválido.')
      }
    }

    // Validação de unicidade prévia
    if (cleanDoc) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('document', cleanDoc)
        .maybeSingle()

      if (existing) {
        throw new Error(
          `Já existe um cliente cadastrado com este documento (${existing.name}).`
        )
      }
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        company_id: companyId,
        origin_branch_id: form.origin_branch_id || null,
        person_type: form.person_type,
        name: form.name.trim(),
        trade_name: form.trade_name?.trim() || null,
        document: cleanDoc,
        state_registration: form.state_registration?.trim() || null,
        email: form.email?.trim() || null,
        phone: onlyDigits(form.phone) || null,
        whatsapp: onlyDigits(form.whatsapp) || null,
        zip_code: onlyDigits(form.zip_code) || null,
        street: form.street?.trim() || null,
        number: form.number?.trim() || null,
        complement: form.complement?.trim() || null,
        neighborhood: form.neighborhood?.trim() || null,
        city: form.city?.trim() || null,
        state: form.state?.trim() || null,
        credit_limit: Number(form.credit_limit || 0),
        credit_status: form.credit_status || 'available',
        status: form.status || 'active',
        notes: form.notes?.trim() || null,
        created_by: user?.id || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('Já existe um cliente cadastrado com este CPF/CNPJ nesta empresa.')
      }
      console.error('Erro ao cadastrar cliente:', error)
      throw new Error(error.message || 'Falha ao salvar cliente.')
    }

    // Se foi definido limite de crédito inicial maior que zero, registra histórico
    if (Number(form.credit_limit) > 0 && data) {
      await supabase.from('customer_credit_history').insert({
        company_id: companyId,
        customer_id: data.id,
        previous_limit: 0,
        new_limit: Number(form.credit_limit),
        reason: 'Concessão de limite inicial no cadastro do cliente',
        user_id: user?.id || null,
      })
    }

    return data as Customer
  },

  /**
   * Atualiza dados cadastrais de um cliente existente.
   */
  async updateCustomer(
    id: string,
    companyId: string,
    form: Partial<CustomerFormData>
  ): Promise<Customer> {
    if (!supabase) throw new Error('Supabase não configurado')

    const cleanDoc = form.document !== undefined ? onlyDigits(form.document) || null : undefined

    if (cleanDoc !== undefined) {
      if (!cleanDoc) {
        throw new Error('O CPF ou CNPJ é obrigatório e deve ser válido.')
      }

      // Identifica o tipo de pessoa do cadastro para validar o documento correto
      let pType = form.person_type
      if (!pType) {
        const { data: currentCust } = await supabase
          .from('customers')
          .select('person_type')
          .eq('id', id)
          .maybeSingle()
        pType = currentCust?.person_type || 'individual'
      }

      if (pType === 'individual') {
        if (!validateCpf(cleanDoc)) {
          throw new Error('CPF inválido. O sistema não permite salvar cliente com CPF inválido.')
        }
      } else {
        if (!validateCnpj(cleanDoc)) {
          throw new Error('CNPJ inválido. O sistema não permite salvar cliente com CNPJ inválido.')
        }
      }
    }

    // Validação de duplicidade excluindo o próprio registro
    if (cleanDoc) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('document', cleanDoc)
        .neq('id', id)
        .maybeSingle()

      if (existing) {
        throw new Error(
          `Outro cliente já utiliza este CPF/CNPJ nesta empresa (${existing.name}).`
        )
      }
    }

    const payload: any = {
      updated_at: new Date().toISOString(),
    }

    if (form.person_type !== undefined) payload.person_type = form.person_type
    if (form.name !== undefined) payload.name = form.name.trim()
    if (form.trade_name !== undefined) payload.trade_name = form.trade_name.trim() || null
    if (cleanDoc !== undefined) payload.document = cleanDoc
    if (form.state_registration !== undefined)
      payload.state_registration = form.state_registration.trim() || null
    if (form.email !== undefined) payload.email = form.email.trim() || null
    if (form.phone !== undefined) payload.phone = onlyDigits(form.phone) || null
    if (form.whatsapp !== undefined) payload.whatsapp = onlyDigits(form.whatsapp) || null
    if (form.zip_code !== undefined) payload.zip_code = onlyDigits(form.zip_code) || null
    if (form.street !== undefined) payload.street = form.street.trim() || null
    if (form.number !== undefined) payload.number = form.number.trim() || null
    if (form.complement !== undefined) payload.complement = form.complement.trim() || null
    if (form.neighborhood !== undefined) payload.neighborhood = form.neighborhood.trim() || null
    if (form.city !== undefined) payload.city = form.city.trim() || null
    if (form.state !== undefined) payload.state = form.state.trim() || null
    if (form.status !== undefined) payload.status = form.status
    if (form.notes !== undefined) payload.notes = form.notes.trim() || null
    if (form.origin_branch_id !== undefined) payload.origin_branch_id = form.origin_branch_id || null

    const { data, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('Já existe outro cliente cadastrado com este documento.')
      }
      console.error('Erro ao atualizar cliente:', error)
      throw new Error(error.message || 'Falha ao atualizar dados do cliente.')
    }

    return data as Customer
  },

  /**
   * Ativa ou inativa o cliente (Soft-delete / status toggle).
   */
  async setCustomerStatus(
    id: string,
    companyId: string,
    status: 'active' | 'inactive'
  ): Promise<void> {
    if (!supabase) throw new Error('Supabase não configurado')

    const { error } = await supabase
      .from('customers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Erro ao alternar status do cliente:', error)
      throw new Error(error.message || 'Erro ao alterar status do cliente.')
    }
  },

  /**
   * Atualização auditada de limite de crédito via RPC atômica.
   */
  async updateCreditLimit(
    companyId: string,
    customerId: string,
    newLimit: number,
    reason: string,
    creditStatus?: 'available' | 'blocked' | 'under_review'
  ): Promise<{ success: boolean; new_limit: number }> {
    if (!supabase) throw new Error('Supabase não configurado')

    const { data, error } = await supabase.rpc('update_customer_credit_limit', {
      p_company_id: companyId,
      p_customer_id: customerId,
      p_new_limit: newLimit,
      p_reason: reason.trim(),
      p_credit_status: creditStatus || null,
    })

    if (error) {
      console.error('Erro ao atualizar limite de crédito:', error)
      throw new Error(error.message || 'Falha ao atualizar limite de crédito.')
    }

    return data as any
  },

  /**
   * Consulta histórico auditável de concessões e alterações de limite de crédito do cliente.
   */
  async getCreditHistory(
    companyId: string,
    customerId: string
  ): Promise<CustomerCreditHistory[]> {
    if (!supabase) return []

    const { data, error } = await supabase
      .from('customer_credit_history')
      .select(`
        id,
        company_id,
        customer_id,
        previous_limit,
        new_limit,
        reason,
        user_id,
        created_at
      `)
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar histórico de crédito:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      ...row,
      previous_limit: Number(row.previous_limit || 0),
      new_limit: Number(row.new_limit || 0),
    }))
  },

  /**
   * Indicadores gerenciais de clientes para a empresa (KPIs reais).
   */
  async getCustomerKpis(companyId: string): Promise<CustomerKpis> {
    if (!supabase) {
      return {
        totalCustomers: 0,
        activeCustomers: 0,
        withCreditLimitCount: 0,
        totalCreditGranted: 0,
      }
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('status, credit_limit')
        .eq('company_id', companyId)

      if (error || !data) {
        return {
          totalCustomers: 0,
          activeCustomers: 0,
          withCreditLimitCount: 0,
          totalCreditGranted: 0,
        }
      }

      let totalCustomers = data.length
      let activeCustomers = 0
      let withCreditLimitCount = 0
      let totalCreditGranted = 0

      for (const c of data) {
        if (c.status === 'active') activeCustomers++
        const lim = Number(c.credit_limit || 0)
        if (lim > 0) {
          withCreditLimitCount++
          totalCreditGranted += lim
        }
      }

      return {
        totalCustomers,
        activeCustomers,
        withCreditLimitCount,
        totalCreditGranted,
      }
    } catch (err) {
      console.error('Erro ao calcular KPIs de clientes:', err)
      return {
        totalCustomers: 0,
        activeCustomers: 0,
        withCreditLimitCount: 0,
        totalCreditGranted: 0,
      }
    }
  },
}
