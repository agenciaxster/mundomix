export type ThemeMode = 'light' | 'dark' | 'system'

export interface BreadcrumbItem {
  label: string
  href?: string
  current?: boolean
}

export interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  avatarUrl?: string
  branchName: string
}
