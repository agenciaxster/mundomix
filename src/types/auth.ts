import type { Database, SystemModule, ActionType } from '@/types/database'

// Tipos de linha extraídos do Database para conveniência
export type Company = Database['public']['Tables']['companies']['Row']
export type Branch = Database['public']['Tables']['branches']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type UserCompanyAccess = Database['public']['Tables']['user_company_access']['Row']
export type UserBranchAccess = Database['public']['Tables']['user_branch_access']['Row']
export type Role = Database['public']['Tables']['roles']['Row']
export type RolePermission = Database['public']['Tables']['role_permissions']['Row']

export type UserCompanyRole = Database['public']['Tables']['user_company_access']['Row']['role']
export type AccessStatus = Database['public']['Tables']['user_company_access']['Row']['status']

export type { SystemModule, ActionType }

// Permissões estruturadas por módulo
export type UserPermissionsMap = Record<
  SystemModule,
  {
    can_view: boolean
    can_create: boolean
    can_edit: boolean
    can_delete: boolean
  }
>

// Tipo completo que representa o usuário autenticado e seus acessos
export interface AuthenticatedUser {
  id: string
  email: string
  profile: Profile | null
  companies: CompanyWithRole[]
  activeBranch: Branch | null
  activeCompany: Company | null
  activeRole: UserCompanyRole | null
  activeRoleData?: Role | null
  permissions: UserPermissionsMap | null
}

export interface CompanyWithRole {
  company: Company
  role: UserCompanyRole
  roleId: string | null
  status: AccessStatus
  branches: Branch[]
}

// Representação de usuário para listagem administrativa
export interface ManagedUser {
  id: string
  email: string
  fullName: string
  phone: string | null
  status: 'active' | 'inactive' | 'blocked'
  accessStatus: AccessStatus
  role: UserCompanyRole
  roleId: string | null
  roleName?: string
  branches: Branch[]
  createdAt: string
  updatedAt: string
}

// Resultado padronizado para operações assíncronas de autenticação
export type AuthResult<T = void> =
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never }
