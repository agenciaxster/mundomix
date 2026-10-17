import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type {
  Profile,
  Branch,
  Company,
  CompanyWithRole,
  UserCompanyRole,
  Role,
  UserPermissionsMap,
  SystemModule,
  ActionType,
} from '@/types/auth'

// ─── Context Shape ────────────────────────────────────────────────────────────

export interface AuthContextType {
  /** Sessão raw do Supabase */
  session: Session | null
  /** Objeto User do Supabase Auth */
  user: User | null
  /** Perfil estendido da tabela profiles */
  profile: Profile | null
  /** Lista de empresas e filiais autorizadas */
  companies: CompanyWithRole[]
  /** Empresa ativa selecionada pelo usuário */
  activeCompany: Company | null
  /** Filial ativa selecionada pelo usuário */
  activeBranch: Branch | null
  /** Papel do usuário na empresa ativa */
  activeRole: UserCompanyRole | null
  /** Perfil de acesso/Role associado na empresa ativa */
  activeRoleData: Role | null
  /** Mapa de permissões por módulo da empresa ativa */
  permissions: UserPermissionsMap | null
  /** Função de checagem rápida de permissão */
  hasPermission: (module: SystemModule, action: ActionType) => boolean
  /** Indica que a sessão está sendo carregada/verificada */
  isLoading: boolean
  /** Usuário está autenticado e sessão validada */
  isAuthenticated: boolean
  /** Erro de inicialização, se houver */
  authError: string | null
  /** Ações */
  signOut: () => Promise<void>
  setActiveBranch: (branch: Branch) => void
  setActiveCompany: (company: Company) => void
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ─── Helper: Carrega permissões do usuário ─────────────────────────────────────

async function loadUserPermissions(
  role: UserCompanyRole,
  roleId: string | null
): Promise<{ roleData: Role | null; permissions: UserPermissionsMap }> {
  const defaultPermissions: UserPermissionsMap = {
    users: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    companies: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    products: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    sales: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    stock: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    financial: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    reports: { can_view: false, can_create: false, can_edit: false, can_delete: false },
    settings: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  }

  // Owner e admin têm permissão total em tudo
  if (role === 'owner' || role === 'admin') {
    const fullPermissions: UserPermissionsMap = {
      users: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      companies: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      products: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      sales: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      stock: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      financial: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      reports: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      settings: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    }
    return { roleData: null, permissions: fullPermissions }
  }

  if (!supabase) return { roleData: null, permissions: defaultPermissions }

  try {
    let resolvedRoleId = roleId

    if (!resolvedRoleId) {
      const { data: roleRow, error: roleRowErr } = await supabase
        .from('roles')
        .select('*')
        .eq('slug', role)
        .is('company_id', null)
        .maybeSingle()

      if (!roleRowErr && roleRow) {
        resolvedRoleId = roleRow.id
      }
    }

    if (!resolvedRoleId) {
      return { roleData: null, permissions: defaultPermissions }
    }

    const { data: roleData } = await supabase
      .from('roles')
      .select('*')
      .eq('id', resolvedRoleId)
      .maybeSingle()

    const { data: perms } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('role_id', resolvedRoleId)

    const map = { ...defaultPermissions }
    if (perms) {
      for (const p of perms) {
        const mod = p.module as SystemModule
        if (map[mod]) {
          map[mod] = {
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
          }
        }
      }
    }

    return { roleData: roleData ?? null, permissions: map }
  } catch (err) {
    console.warn('[AuthProvider] Erro não bloqueante ao sincronizar permissões:', err)
    return { roleData: null, permissions: defaultPermissions }
  }
}

// ─── Helper: Carrega perfil e acessos do usuário ─────────────────────────────

async function loadUserData(userId: string): Promise<{
  profile: Profile | null
  companies: CompanyWithRole[]
}> {
  if (!supabase) return { profile: null, companies: [] }
  const db = supabase

  // Busca perfil
  const { data: profileData } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  // Busca acessos a empresas com dados da empresa (tolerando se a migration 6 de status ainda não foi rodada)
  let companyAccess: any[] | null = null
  try {
    const { data, error } = await db
      .from('user_company_access')
      .select(`
        role,
        role_id,
        status,
        company:companies (
          id, legal_name, trade_name, cnpj, email, phone, status, created_at, updated_at
        )
      `)
      .eq('user_id', userId)

    if (!error && data) {
      // Filtra ativos caso o campo status exista
      companyAccess = data.filter((item: any) => !item.status || item.status === 'active')
    } else {
      // Fallback sem role_id/status se a migration ainda não foi aplicada no banco Supabase
      const { data: fallbackData } = await db
        .from('user_company_access')
        .select(`
          role,
          company:companies (
            id, legal_name, trade_name, cnpj, email, phone, status, created_at, updated_at
          )
        `)
        .eq('user_id', userId)
      companyAccess = fallbackData ?? []
    }
  } catch (e) {
    console.warn('[AuthProvider] Erro ao buscar acessos:', e)
  }

  if (!companyAccess || companyAccess.length === 0) {
    return { profile: profileData, companies: [] }
  }

  // Para cada empresa, busca as filiais autorizadas ativas
  const companiesWithBranches: CompanyWithRole[] = await Promise.all(
    companyAccess.map(async (access) => {
      const company = Array.isArray(access.company) ? access.company[0] : access.company
      if (!company) {
        return {
          company: company as Company,
          role: access.role,
          roleId: access.role_id,
          status: access.status,
          branches: [],
        }
      }

      // Admins e owners têm acesso a todas as filiais ativas da empresa
      if (access.role === 'owner' || access.role === 'admin') {
        const { data: allBranches } = await db
          .from('branches')
          .select('*')
          .eq('company_id', company.id)
          .eq('status', 'active')

        let branchesList = (allBranches ?? []) as Branch[]

        // Auto-heal: Normaliza registros legados com "São Paulo" ou vazio para "Palmas" e "TO"
        for (const b of branchesList) {
          if (
            !b.city ||
            b.city.toLowerCase().includes('sao paulo') ||
            b.city.toLowerCase().includes('são paulo')
          ) {
            b.city = 'Palmas'
            b.state = 'TO'
            void db.from('branches').update({ city: 'Palmas', state: 'TO' }).eq('id', b.id)
          }
        }

        if (
          !company.city ||
          company.city.toLowerCase().includes('sao paulo') ||
          company.city.toLowerCase().includes('são paulo')
        ) {
          company.city = 'Palmas'
          company.state = 'TO'
          void db.from('companies').update({ city: 'Palmas', state: 'TO' }).eq('id', company.id)
        }

        // Se a empresa ainda não tiver filial Matriz cadastrada em branches, cria automaticamente
        if (!branchesList.some((b) => b.branch_type === 'matriz')) {
          try {
            const { data: newHeadquarter } = await db
              .from('branches')
              .insert({
                company_id: company.id,
                name: `${company.trade_name || company.legal_name} (Matriz)`,
                code: 'MATRIZ',
                cnpj: company.cnpj,
                branch_type: 'matriz',
                status: 'active',
                zip_code: company.zip_code,
                street: company.street,
                number: company.number,
                complement: company.complement,
                neighborhood: company.neighborhood,
                city: company.city || 'Palmas',
                state: company.state || 'TO',
                phone: company.phone,
              })
              .select()
              .maybeSingle()

            if (newHeadquarter) {
              branchesList = [newHeadquarter, ...branchesList]
            }
          } catch (createErr) {
            console.warn('[AuthProvider] Erro não-bloqueante ao auto-criar Matriz:', createErr)
          }
        }

        // Ordena garantindo a Matriz sempre no topo da lista
        branchesList.sort((a, b) => {
          if (a.branch_type === 'matriz' && b.branch_type !== 'matriz') return -1
          if (a.branch_type !== 'matriz' && b.branch_type === 'matriz') return 1
          return a.name.localeCompare(b.name)
        })

        return {
          company: company as Company,
          role: access.role,
          roleId: access.role_id,
          status: access.status,
          branches: branchesList,
        }
      }

      let branchAccess: any[] | null = null
      try {
        const { data: bData, error: bErr } = await db
          .from('user_branch_access')
          .select(`
            status,
            branch:branches (
              id, company_id, name, code, cnpj, branch_type, status,
              zip_code, street, number, complement, neighborhood, city, state, phone,
              created_at, updated_at
            )
          `)
          .eq('user_id', userId)

        if (!bErr && bData) {
          branchAccess = bData.filter((ba: any) => !ba.status || ba.status === 'active')
        } else {
          const { data: fallbackBData } = await db
            .from('user_branch_access')
            .select(`
              branch:branches (
                id, company_id, name, code, cnpj, branch_type, status,
                zip_code, street, number, complement, neighborhood, city, state, phone,
                created_at, updated_at
              )
            `)
            .eq('user_id', userId)
          branchAccess = fallbackBData ?? []
        }
      } catch {
        branchAccess = []
      }

      const branches = (branchAccess ?? [])
        .map((ba: any) => (Array.isArray(ba.branch) ? ba.branch[0] : ba.branch))
        .filter((b: any): b is Branch => b !== null && b.company_id === company.id && b.status === 'active')
        .sort((a: Branch, b: Branch) => {
          if (a.branch_type === 'matriz' && b.branch_type !== 'matriz') return -1
          if (a.branch_type !== 'matriz' && b.branch_type === 'matriz') return 1
          return a.name.localeCompare(b.name)
        })

      return {
        company: company as Company,
        role: access.role,
        roleId: access.role_id,
        status: access.status,
        branches,
      }
    })
  )

  return { profile: profileData, companies: companiesWithBranches }
}

// ─── AuthProvider ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [companies, setCompanies] = useState<CompanyWithRole[]>([])
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(null)
  const [activeBranch, setActiveBranchState] = useState<Branch | null>(null)
  const [activeRoleData, setActiveRoleData] = useState<Role | null>(null)
  const [permissions, setPermissions] = useState<UserPermissionsMap | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  const activeRole: UserCompanyRole | null = useMemo(() => {
    if (!activeCompany) return null
    return companies.find((c) => c.company.id === activeCompany.id)?.role ?? null
  }, [activeCompany, companies])

  const activeRoleId: string | null = useMemo(() => {
    if (!activeCompany) return null
    return companies.find((c) => c.company.id === activeCompany.id)?.roleId ?? null
  }, [activeCompany, companies])

  // Recalcula permissões quando activeRole ou activeCompany mudar
  useEffect(() => {
    let active = true
    async function syncPermissions() {
      if (activeRole) {
        const { roleData, permissions: perms } = await loadUserPermissions(activeRole, activeRoleId)
        if (active) {
          setActiveRoleData(roleData)
          setPermissions(perms)
        }
      } else {
        if (active) {
          setActiveRoleData(null)
          setPermissions(null)
        }
      }
    }
    void syncPermissions()
    return () => { active = false }
  }, [activeRole, activeRoleId])

  const loadAndSetUserData = useCallback(async (userId: string) => {
    try {
      const { profile: prof, companies: comps } = await loadUserData(userId)
      setProfile(prof)
      setCompanies(comps)

      // Atualiza empresa e filial ativa com segurança funcional e preferência pela Matriz:
      setActiveCompanyState((current) => {
        const stillValid = current && comps.some((c) => c.company?.id === current.id)
        const target = stillValid ? current : (comps[0]?.company ?? null)

        if (target) {
          const compData = comps.find((c) => c.company?.id === target.id)
          const branches = compData?.branches || []

          setActiveBranchState((prevBranch) => {
            const branchValid = prevBranch && branches.some((b) => b.id === prevBranch.id)
            if (branchValid) return prevBranch

            const savedId = localStorage.getItem(`erp_active_branch_${target.id}`)
            if (savedId) {
              const saved = branches.find((b) => b.id === savedId)
              if (saved) return saved
            }

            const headquarter = branches.find((b) => b.branch_type === 'matriz')
            return headquarter ?? branches[0] ?? null
          })

          return target
        }

        setActiveBranchState(null)
        return null
      })
    } catch (err) {
      console.error('[AuthProvider] Erro ao carregar dados do usuário:', err)
    }
  }, [])

  // ── Inicialização: Recupera sessão existente ──────────────────────────────
  useEffect(() => {
    let mounted = true

    async function initializeAuth() {
      if (!supabase) {
        setIsLoading(false)
        setAuthError('Supabase não está configurado. Verifique as variáveis de ambiente.')
        return
      }

      try {
        const { data: { session: existingSession }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('[AuthProvider] Erro ao recuperar sessão:', error)
          if (mounted) {
            setAuthError(error.message)
          }
          return
        }

        if (mounted) {
          setSession(existingSession)
          setUser(existingSession?.user ?? null)

          if (existingSession?.user) {
            try {
              await loadAndSetUserData(existingSession.user.id)
            } catch (userErr) {
              console.warn('[AuthProvider] Erro ao carregar dados do usuário:', userErr)
            }
          }
        }
      } catch (err) {
        console.error('[AuthProvider] Erro inesperado na inicialização:', err)
        if (mounted) {
          setAuthError('Erro inesperado ao inicializar a autenticação.')
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void initializeAuth()

    // ── Listener de mudanças de estado de autenticação ───────────────────────
    if (!supabase) {
      return () => { mounted = false }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return

        setSession(newSession)
        setUser(newSession?.user ?? null)

        if (event === 'SIGNED_IN' && newSession?.user) {
          await loadAndSetUserData(newSession.user.id)
        } else if (event === 'SIGNED_OUT') {
          setProfile(null)
          setCompanies([])
          setActiveCompanyState(null)
          setActiveBranchState(null)
          setActiveRoleData(null)
          setPermissions(null)
        } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
          // Sessão renovada
        } else if (event === 'USER_UPDATED' && newSession?.user) {
          await loadAndSetUserData(newSession.user.id)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadAndSetUserData])

  // ── signOut ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    if (!supabase) return
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── setActiveCompany ──────────────────────────────────────────────────────
  const setActiveCompany = useCallback((company: Company) => {
    setActiveCompanyState(company)
    const companyData = companies.find((c) => c.company.id === company.id)
    const branches = companyData?.branches || []

    const savedId = localStorage.getItem(`erp_active_branch_${company.id}`)
    const saved = savedId ? branches.find((b) => b.id === savedId) : null
    const headquarter = branches.find((b) => b.branch_type === 'matriz')

    const chosen = saved ?? headquarter ?? branches[0] ?? null
    setActiveBranchState(chosen)
    if (chosen) {
      localStorage.setItem(`erp_active_branch_${company.id}`, chosen.id)
    }
  }, [companies])

  // ── setActiveBranch ───────────────────────────────────────────────────────
  const setActiveBranch = useCallback((branch: Branch) => {
    setActiveBranchState(branch)
    localStorage.setItem(`erp_active_branch_${branch.company_id}`, branch.id)
  }, [])

  // ── refreshProfile ────────────────────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadAndSetUserData(user.id)
    }
  }, [user, loadAndSetUserData])

  // ── hasPermission ─────────────────────────────────────────────────────────
  const hasPermission = useCallback((module: SystemModule, action: ActionType): boolean => {
    if (activeRole === 'owner' || activeRole === 'admin') return true
    if (!permissions || !permissions[module]) return false
    const actKey = `can_${action}` as const
    return Boolean(permissions[module][actKey])
  }, [activeRole, permissions])

  const contextValue = useMemo(
    () => ({
      session,
      user,
      profile,
      companies,
      activeCompany,
      activeBranch,
      activeRole,
      activeRoleData,
      permissions,
      hasPermission,
      isLoading,
      isAuthenticated: !!session && !!user,
      authError,
      signOut,
      setActiveBranch,
      setActiveCompany,
      refreshProfile,
    }),
    [
      session,
      user,
      profile,
      companies,
      activeCompany,
      activeBranch,
      activeRole,
      activeRoleData,
      permissions,
      hasPermission,
      isLoading,
      authError,
      signOut,
      setActiveBranch,
      setActiveCompany,
      refreshProfile,
    ]
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── useAuth hook ─────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
