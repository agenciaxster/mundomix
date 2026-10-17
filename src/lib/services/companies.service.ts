import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type Company = Database['public']['Tables']['companies']['Row']
export type CompanyInsert = Database['public']['Tables']['companies']['Insert']
export type CompanyUpdate = Database['public']['Tables']['companies']['Update']
export type Branch = Database['public']['Tables']['branches']['Row']
export type BranchInsert = Database['public']['Tables']['branches']['Insert']
export type BranchUpdate = Database['public']['Tables']['branches']['Update']

export interface CompanyWithStats extends Company {
  branch_count: number
  has_headquarters: boolean
  branches?: Branch[]
}

export type ServiceResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never }

// ─── COMPANIES ────────────────────────────────────────────────────────────────

/** Lista todas as empresas às quais o usuário tem acesso (filtrado por RLS) */
export async function listCompanies(): Promise<ServiceResult<Company[]>> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('trade_name', { ascending: true })
  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

/** Busca uma empresa pelo ID */
export async function getCompany(id: string): Promise<ServiceResult<Company>> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Empresa não encontrada.' }
  return { success: true, data }
}

/** Cria uma nova empresa — apenas administradores via política de INSERT */
export async function createCompany(payload: CompanyInsert): Promise<ServiceResult<Company>> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }
  const { data: { user } } = await supabase.auth.getUser()

  const payloadWithUser: CompanyInsert = {
    ...payload,
    created_by: payload.created_by ?? user?.id ?? null,
  }

  const { data, error } = await supabase
    .from('companies')
    .insert(payloadWithUser)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return { success: false, error: 'Já existe uma empresa cadastrada com este CNPJ.' }
    return { success: false, error: error.message }
  }
  if (!data) return { success: false, error: 'Erro ao criar empresa.' }

  // Garante que o usuário criador tenha vínculo imediato em user_company_access
  if (user) {
    await supabase
      .from('user_company_access')
      .upsert({
        user_id: user.id,
        company_id: data.id,
        role: 'owner',
        status: 'active',
      }, { onConflict: 'user_id,company_id', ignoreDuplicates: true })

    // Garante que a unidade Matriz seja criada imediatamente na tabela branches
    await supabase
      .from('branches')
      .upsert({
        company_id: data.id,
        name: `${data.trade_name} (Matriz)`,
        code: 'MATRIZ',
        cnpj: data.cnpj,
        branch_type: 'matriz',
        status: 'active',
        zip_code: data.zip_code,
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city || 'Palmas',
        state: data.state || 'TO',
        phone: data.phone,
      }, { onConflict: 'company_id,code', ignoreDuplicates: true })
  }

  return { success: true, data }
}

/** Atualiza dados de uma empresa — apenas administradores via RLS */
export async function updateCompany(id: string, payload: CompanyUpdate): Promise<ServiceResult<Company>> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }
  const { data, error } = await supabase
    .from('companies')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return { success: false, error: 'Já existe uma empresa cadastrada com este CNPJ.' }
    return { success: false, error: error.message }
  }
  if (!data) return { success: false, error: 'Empresa não encontrada ou sem permissão de edição.' }
  return { success: true, data }
}

/** Desativa uma empresa (soft delete via status) */
export async function deactivateCompany(id: string): Promise<ServiceResult<Company>> {
  return updateCompany(id, { status: 'inactive' })
}

/** Reativa uma empresa */
export async function activateCompany(id: string): Promise<ServiceResult<Company>> {
  return updateCompany(id, { status: 'active' })
}

/** Exclui definitivamente uma empresa (e dados em cascata via chave estrangeira) */
export async function deleteCompany(id: string): Promise<ServiceResult<void>> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

/** Desvincula o usuário autenticado de uma empresa (remove seu registro de acesso) */
export async function leaveCompany(companyId: string): Promise<ServiceResult<void>> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Usuário não autenticado.' }

  const { error } = await supabase
    .from('user_company_access')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', user.id)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

// ─── BRANCHES ─────────────────────────────────────────────────────────────────

/** Lista as filiais de uma empresa às quais o usuário tem acesso */
export async function listBranches(companyId: string): Promise<ServiceResult<Branch[]>> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('company_id', companyId)
    .order('branch_type', { ascending: true }) // matriz primeiro
    .order('name', { ascending: true })
  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

/** Busca uma filial pelo ID */
export async function getBranch(id: string): Promise<ServiceResult<Branch>> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Filial não encontrada.' }
  return { success: true, data }
}

/** Cria uma nova filial — apenas administradores da empresa */
export async function createBranch(payload: BranchInsert): Promise<ServiceResult<Branch>> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }

  // Verifica se já existe matriz (regra de negócio: apenas uma por empresa)
  if (payload.branch_type === 'matriz') {
    const { data: existing } = await supabase
      .from('branches')
      .select('id')
      .eq('company_id', payload.company_id)
      .eq('branch_type', 'matriz')
      .maybeSingle()
    if (existing) {
      return { success: false, error: 'Esta empresa já possui uma unidade matriz cadastrada.' }
    }
  }

  // Garante que o usuário logado esteja vinculado como owner/admin da empresa antes de criar filial
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase
      .from('user_company_access')
      .upsert({
        user_id: user.id,
        company_id: payload.company_id,
        role: 'owner',
        status: 'active',
      }, { onConflict: 'user_id,company_id', ignoreDuplicates: true })
  }

  const { data, error } = await supabase
    .from('branches')
    .insert(payload)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return { success: false, error: 'Já existe uma filial com este código nesta empresa.' }
    return { success: false, error: error.message }
  }
  if (!data) return { success: false, error: 'Erro ao criar filial.' }
  return { success: true, data }
}

/** Atualiza uma filial — apenas administradores via RLS */
export async function updateBranch(id: string, payload: BranchUpdate): Promise<ServiceResult<Branch>> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }

  // Impede mudança de tipo para 'matriz' se já existir outra
  if (payload.branch_type === 'matriz' && payload.company_id) {
    const { data: existing } = await supabase
      .from('branches')
      .select('id')
      .eq('company_id', payload.company_id)
      .eq('branch_type', 'matriz')
      .neq('id', id)
      .maybeSingle()
    if (existing) {
      return { success: false, error: 'Esta empresa já possui uma unidade matriz. Altere a matriz existente primeiro.' }
    }
  }

  const { data, error } = await supabase
    .from('branches')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return { success: false, error: 'Já existe uma filial com este código nesta empresa.' }
    return { success: false, error: error.message }
  }
  if (!data) return { success: false, error: 'Filial não encontrada ou sem permissão de edição.' }
  return { success: true, data }
}

/** Desativa uma filial */
export async function deactivateBranch(id: string): Promise<ServiceResult<Branch>> {
  return updateBranch(id, { status: 'inactive' })
}

/** Reativa uma filial */
export async function activateBranch(id: string): Promise<ServiceResult<Branch>> {
  return updateBranch(id, { status: 'active' })
}

/** Exclui definitivamente uma filial */
export async function deleteBranch(id: string): Promise<ServiceResult<void>> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }
  const { error } = await supabase
    .from('branches')
    .delete()
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}
