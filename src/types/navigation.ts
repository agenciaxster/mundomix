import type { ComponentType } from 'react'

export interface NavItem {
  title: string
  href: string
  icon: ComponentType<{ className?: string }>
  badge?: string
  description?: string
  implemented?: boolean
}

export interface NavGroup {
  groupTitle: string
  items: NavItem[]
}
