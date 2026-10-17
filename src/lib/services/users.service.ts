import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type {
  Role,
  RolePermission,
  ManagedUser,
  Branch,
  UserCompanyRole,
  AccessStatus,
  AuthResult,
  SystemModule,
} from '@/types/auth'

/**
 * Cria um cliente Supabase isolado sem persistência em localStorage para cadastrar
 * novos usuários via auth.signUp() sem afetar ou deslogar a sessão do administrador ativo.
 */
function getIsolatedAuthClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

// ─── ROLES & PERMISSÕES ────────────────────────────────────────────────────────

/**
 * Lista todos os perfis de acesso disponíveis (sistema e específicos da empresa)
 */
export async function listRoles(companyId?: string): Promise<AuthResult<Role[]>> {
  if (!supabase) return { success: false, error: 'Supabase não inicializado.' }

  try {
    let query = supabase.from('roles').select('*').order('created_at', { ascending: true })

    if (companyId) {
      query = query.or(`company_id.is.null,company_id.eq.${companyId}`)
    } else {
      query = query.is('company_id', null)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as Role[] }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Obtém permissões de um perfil específico
 */
export async function getRolePermissions(roleId: string): Promise<AuthResult<RolePermission[]>> {
  if (!supabase) return { success: false, error: 'Supabase não inicializado.' }

  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('role_id', roleId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as RolePermission[] }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Cria ou atualiza um perfil customizado da empresa com suas permissões
 */
export async function saveCustomRole(params: {
  companyId: string
  roleId?: string
  name: string
  description?: string
  permissions: {
    module: SystemModule
    can_view: boolean
    can_create: boolean
    can_edit: boolean
    can_delete: boolean
  }[]
}): Promise<AuthResult<Role>> {
  if (!supabase) return { success: false, error: 'Supabase não inicializado.' }

  try {
    const slug = params.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')

    let savedRole: Role

    if (params.roleId) {
      const { data, error } = await supabase
        .from('roles')
        .update({
          name: params.name,
          description: params.description ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.roleId)
        .eq('company_id', params.companyId)
        .eq('is_system', false)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      savedRole = data as Role
    } else {
      const { data, error } = await supabase
        .from('roles')
        .insert({
          company_id: params.companyId,
          name: params.name,
          slug,
          description: params.description ?? null,
          is_system: false,
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      savedRole = data as Role
    }

    // Salva matriz de permissões
    for (const perm of params.permissions) {
      await supabase.from('role_permissions').upsert({
        role_id: savedRole.id,
        module: perm.module,
        can_view: perm.can_view,
        can_create: perm.can_create,
        can_edit: perm.can_edit,
        can_delete: perm.can_delete,
      })
    }

    return { success: true, data: savedRole }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── GESTÃO DE USUÁRIOS E VÍNCULOS ─────────────────────────────────────────────

/**
 * Lista usuários vinculados à empresa com perfil, papel e filiais autorizadas
 */
export async function listCompanyUsers(companyId: string): Promise<AuthResult<ManagedUser[]>> {
  if (!supabase) return { success: false, error: 'Supabase não inicializado.' }

  try {
    // 1. Busca os vínculos de empresa com os perfis de usuário
    const { data: accesses, error: accessErr } = await supabase
      .from('user_company_access')
      .select(`
        id,
        user_id,
        company_id,
        role,
        role_id,
        status,
        created_at,
        updated_at,
        profile:profiles (
          id,
          full_name,
          email,
          phone,
          status,
          created_at,
          updated_at
        ),
        role_data:roles (
          id,
          name
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (accessErr) return { success: false, error: accessErr.message }
    if (!accesses || accesses.length === 0) return { success: true, data: [] }

    // 2. Busca todas as filiais da empresa para correlacionar
    const { data: companyBranches } = await supabase
      .from('branches')
      .select('*')
      .eq('company_id', companyId)

    const branchMap = new Map<string, Branch>((companyBranches ?? []).map((b) => [b.id, b as Branch]))

    // 3. Busca os vínculos de filial dos usuários
    const userIds = accesses.map((a) => a.user_id)
    const { data: branchAccesses } = await supabase
      .from('user_branch_access')
      .select('user_id, branch_id, status')
      .in('user_id', userIds)

    // Agrupa filiais por usuário
    const userBranchesMap = new Map<string, Branch[]>()
    if (branchAccesses) {
      for (const ba of branchAccesses) {
        if (branchMap.has(ba.branch_id)) {
          const list = userBranchesMap.get(ba.user_id) ?? []
          list.push(branchMap.get(ba.branch_id)!)
          userBranchesMap.set(ba.user_id, list)
        }
      }
    }

    // 4. Monta a lista padronizada de ManagedUser
    const users: ManagedUser[] = accesses.map((acc) => {
      const prof = Array.isArray(acc.profile) ? acc.profile[0] : acc.profile
      const roleObj = Array.isArray(acc.role_data) ? acc.role_data[0] : acc.role_data

      // Admins e owners têm acesso a todas as filiais da empresa
      const isFullAdmin = acc.role === 'owner' || acc.role === 'admin'
      const assignedBranches = isFullAdmin
        ? (companyBranches ?? []) as Branch[]
        : userBranchesMap.get(acc.user_id) ?? []

      return {
        id: acc.user_id,
        email: prof?.email ?? '',
        fullName: prof?.full_name ?? 'Usuário sem nome',
        phone: prof?.phone ?? null,
        status: (prof?.status ?? 'active') as 'active' | 'inactive' | 'blocked',
        accessStatus: (acc.status ?? 'active') as AccessStatus,
        role: acc.role,
        roleId: acc.role_id,
        roleName: roleObj?.name ?? (acc.role === 'owner' ? 'Proprietário' : acc.role),
        branches: assignedBranches,
        createdAt: acc.created_at,
        updatedAt: acc.updated_at,
      }
    })

    return { success: true, data: users }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Criação segura de novo usuário associado à empresa.
 * Tenta invocar a Edge Function 'create-user'. Se não estiver deployada no ambiente,
 * utiliza criação controlada e segura via RPC sem expor chaves privilegiadas.
 */
export async function createCompanyUser(params: {
  companyId: string
  email: string
  password?: string
  fullName: string
  phone?: string
  role: UserCompanyRole
  roleId?: string
  branchIds: string[]
}): Promise<AuthResult<{ id?: string }>> {
  if (!supabase) return { success: false, error: 'Supabase não inicializado.' }

  try {
    const cleanEmail = params.email.trim().toLowerCase()
    const tempPassword = params.password?.trim() || `MundoMix@${Math.random().toString(36).slice(-8)}!`
    let targetUserId: string | null = null

    // 1. Criação direta via cliente isolado (SEM persistência de sessão para não deslogar o admin)
    const isolatedClient = getIsolatedAuthClient()
    const { data: authData, error: authErr } = await isolatedClient.auth.signUp({
      email: cleanEmail,
      password: tempPassword,
      options: {
        data: {
          full_name: params.fullName.trim(),
          phone: params.phone?.trim() || null,
        },
      },
    })

    if (!authErr && authData?.user?.id) {
      targetUserId = authData.user.id
    } else if (authErr) {
      // Se o usuário já existe no auth, tenta login com o cliente isolado para capturar o ID
      if (params.password) {
        try {
          const { data: signInData } = await isolatedClient.auth.signInWithPassword({
            email: cleanEmail,
            password: params.password,
          })
          if (signInData?.user?.id) {
            targetUserId = signInData.user.id
          }
        } catch {}
      }

      // Se ainda não temos o ID, tenta localizar via RPC ou consulta direta em profiles
      if (!targetUserId) {
        try {
          const { data: rpcId } = await supabase.rpc('find_user_id_by_email', {
            p_email: cleanEmail,
          })
          if (rpcId) targetUserId = rpcId
        } catch {}
      }

      if (!targetUserId) {
        try {
          const { data: existingProf } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle()

          if (existingProf?.id) {
            targetUserId = existingProf.id
          }
        } catch {}
      }

      // Tenta vinculação direta via procedure link_user_by_email
      if (!targetUserId) {
        try {
          const { data: linkRes, error: linkErr } = await supabase.rpc('link_user_by_email', {
            p_company_id: params.companyId,
            p_email: cleanEmail,
            p_role: params.role,
            p_role_id: params.roleId || null,
            p_branch_ids: params.branchIds,
          })

          if (!linkErr && linkRes?.success) {
            return { success: true, data: { id: linkRes.user_id } }
          }
        } catch {}

        return {
          success: false,
          error:
            authErr.message.includes('already registered') || authErr.message.includes('already exists')
              ? 'Este e-mail já possui cadastro no sistema. Digite a senha cadastrada para vincular à empresa ou contate o suporte.'
              : authErr.message,
        }
      }
    }

    if (!targetUserId) {
      return { success: false, error: 'Falha ao identificar o usuário no banco de dados.' }
    }

    // 3. Atualiza dados de nome e telefone do perfil em profiles
    try {
      await supabase
        .from('profiles')
        .update({
          full_name: params.fullName.trim(),
          phone: params.phone?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId)
    } catch {}

    // 4. Vincula usuário à empresa e filiais via procedure ou fallback direto
    return await updateCompanyUserAccess({
      companyId: params.companyId,
      userId: targetUserId,
      role: params.role,
      roleId: params.roleId,
      branchIds: params.branchIds,
      status: 'active',
    })
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Atualiza os acessos, papel e filiais autorizadas de um usuário em uma empresa
 */
export async function updateCompanyUserAccess(params: {
  companyId: string
  userId: string
  role: UserCompanyRole
  roleId?: string
  branchIds: string[]
  status?: AccessStatus
}): Promise<AuthResult<{ id: string }>> {
  if (!supabase) return { success: false, error: 'Supabase não inicializado.' }

  try {
    // 1. Tenta vincular via RPC atômica assign_user_to_company (SECURITY DEFINER)
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('assign_user_to_company', {
        p_company_id: params.companyId,
        p_target_user_id: params.userId,
        p_role: params.role,
        p_role_id: params.roleId || null,
        p_branch_ids: params.branchIds || [],
      })

      if (!rpcErr && rpcRes?.success) {
        return { success: true, data: { id: params.userId } }
      }
    } catch (rpcEx) {
      console.warn('Aviso ao executar RPC assign_user_to_company, aplicando fallback direto:', rpcEx)
    }

    // 2. Fallback direto via tabelas
    // 2.1 Atualiza user_company_access
    const { error: accessErr } = await supabase
      .from('user_company_access')
      .upsert({
        user_id: params.userId,
        company_id: params.companyId,
        role: params.role,
        role_id: params.roleId || null,
        status: params.status || 'active',
        updated_at: new Date().toISOString(),
      })

    if (accessErr) return { success: false, error: accessErr.message }

    // 2.2 Atualiza vínculos de filial:
    // Remove vínculos de filiais desta empresa que não foram selecionadas
    const { data: allCompanyBranches } = await supabase
      .from('branches')
      .select('id')
      .eq('company_id', params.companyId)

    const branchIdsOfCompany = (allCompanyBranches ?? []).map((b) => b.id)

    if (branchIdsOfCompany.length > 0) {
      await supabase
        .from('user_branch_access')
        .delete()
        .eq('user_id', params.userId)
        .in('branch_id', branchIdsOfCompany)
    }

    // Insere as filiais selecionadas
    if (params.branchIds && params.branchIds.length > 0) {
      const rows = params.branchIds
        .filter((bId) => branchIdsOfCompany.includes(bId))
        .map((bId) => ({
          user_id: params.userId,
          branch_id: bId,
          status: 'active' as const,
        }))

      if (rows.length > 0) {
        const { error: branchErr } = await supabase
          .from('user_branch_access')
          .insert(rows)

        if (branchErr) return { success: false, error: branchErr.message }
      }
    }

    return { success: true, data: { id: params.userId } }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Atualiza dados cadastrais do perfil do usuário (nome, telefone, status)
 */
export async function updateUserProfile(params: {
  userId: string
  fullName: string
  phone?: string | null
  status?: 'active' | 'inactive' | 'blocked'
}): Promise<AuthResult<void>> {
  if (!supabase) return { success: false, error: 'Supabase não inicializado.' }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: params.fullName,
        phone: params.phone ?? null,
        status: params.status ?? 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.userId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Ativa ou desativa o acesso de um usuário à empresa sem apagar os registros históricos
 */
export async function toggleUserCompanyAccessStatus(
  companyId: string,
  userId: string,
  newStatus: AccessStatus
): Promise<AuthResult<void>> {
  if (!supabase) return { success: false, error: 'Supabase não inicializado.' }

  try {
    const { error } = await supabase
      .from('user_company_access')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('user_id', userId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
