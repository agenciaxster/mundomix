import { supabase } from '@/lib/supabase'
import type { Supplier, SupplierFilters, SupplierKpis } from '@/types/supplier'

export const supplierService = {
  /**
   * Lista todos os fornecedores da empresa ativa com filtros opcionais
   */
  async listSuppliers(companyId: string, filters?: SupplierFilters): Promise<Supplier[]> {
    if (!supabase) return []

    try {
      let query = supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', companyId)

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      if (filters?.personType && filters.personType !== 'all') {
        query = query.eq('person_type', filters.personType)
      }

      const { data, error } = await query.order('name', { ascending: true })

      if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          console.warn('Tabela suppliers ainda não criada no Supabase.')
          return []
        }
        console.error('Erro ao listar fornecedores:', error)
        throw new Error(error.message || 'Erro ao listar fornecedores.')
      }

      if (!data) return []

      let results: Supplier[] = data as Supplier[]

      if (filters?.search) {
        const s = filters.search.toLowerCase()
        results = results.filter(
          (sup) =>
            sup.name.toLowerCase().includes(s) ||
            (sup.trade_name && sup.trade_name.toLowerCase().includes(s)) ||
            (sup.document && sup.document.includes(s)) ||
            (sup.email && sup.email.toLowerCase().includes(s)) ||
            (sup.phone && sup.phone.includes(s)) ||
            (sup.city && sup.city.toLowerCase().includes(s)) ||
            (sup.contact_name && sup.contact_name.toLowerCase().includes(s))
        )
      }

      return results
    } catch (err: any) {
      console.error('Falha ao listar fornecedores:', err)
      return []
    }
  },

  /**
   * Obtém os indicadores de fornecedores
   */
  async getSupplierKpis(companyId: string): Promise<SupplierKpis> {
    const suppliers = await this.listSuppliers(companyId)
    const totalSuppliers = suppliers.length
    const activeSuppliers = suppliers.filter((s) => s.status === 'active').length
    const inactiveSuppliers = totalSuppliers - activeSuppliers
    const pjCount = suppliers.filter((s) => s.person_type === 'PJ').length

    return {
      totalSuppliers,
      activeSuppliers,
      inactiveSuppliers,
      pjCount,
    }
  },

  /**
   * Cadastra novo fornecedor
   */
  async createSupplier(companyId: string, data: Omit<Supplier, 'id' | 'company_id' | 'created_at' | 'updated_at'>): Promise<Supplier> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    const payload = {
      company_id: companyId,
      name: data.name.trim(),
      trade_name: data.trade_name?.trim() || null,
      person_type: data.person_type || 'PJ',
      document: data.document?.trim() || null,
      state_registration: data.state_registration?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      contact_name: data.contact_name?.trim() || null,
      zip_code: data.zip_code?.trim() || null,
      street: data.street?.trim() || null,
      number: data.number?.trim() || null,
      complement: data.complement?.trim() || null,
      neighborhood: data.neighborhood?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      notes: data.notes?.trim() || null,
      status: data.status || 'active',
    }

    const { data: inserted, error } = await supabase
      .from('suppliers')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      console.error('Erro ao cadastrar fornecedor:', error)
      throw new Error(error.message || 'Erro ao cadastrar fornecedor.')
    }

    return inserted as Supplier
  },

  /**
   * Atualiza dados de um fornecedor
   */
  async updateSupplier(
    companyId: string,
    id: string,
    data: Partial<Omit<Supplier, 'id' | 'company_id' | 'created_at' | 'updated_at'>>
  ): Promise<Supplier> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    const payload: any = {
      ...data,
      updated_at: new Date().toISOString(),
    }

    if (payload.name) payload.name = payload.name.trim()
    if (payload.trade_name) payload.trade_name = payload.trade_name.trim() || null
    if (payload.document) payload.document = payload.document.trim() || null
    if (payload.email) payload.email = payload.email.trim() || null
    if (payload.phone) payload.phone = payload.phone.trim() || null

    const { data: updated, error } = await supabase
      .from('suppliers')
      .update(payload)
      .eq('id', id)
      .eq('company_id', companyId)
      .select('*')
      .single()

    if (error) {
      console.error('Erro ao atualizar fornecedor:', error)
      throw new Error(error.message || 'Erro ao atualizar fornecedor.')
    }

    return updated as Supplier
  },

  /**
   * Alterna status do fornecedor
   */
  async toggleSupplierStatus(
    companyId: string,
    id: string,
    currentStatus: 'active' | 'inactive'
  ): Promise<'active' | 'inactive'> {
    if (!supabase) throw new Error('Supabase client não configurado.')
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active'

    const { error } = await supabase
      .from('suppliers')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Erro ao alternar status do fornecedor:', error)
      throw new Error(error.message || 'Erro ao alterar status do fornecedor.')
    }

    return nextStatus
  },

  /**
   * Exclui um fornecedor
   */
  async deleteSupplier(companyId: string, id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client não configurado.')

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Erro ao excluir fornecedor:', error)
      throw new Error(error.message || 'Erro ao excluir fornecedor.')
    }
  },
}
