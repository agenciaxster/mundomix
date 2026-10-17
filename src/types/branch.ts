export interface Branch {
  id: string
  code: string
  name: string
  tradeName: string
  document: string // CNPJ
  city: string
  state: string
  isHeadquarter: boolean // Matriz vs Filial
  status: 'active' | 'inactive'
}

export interface Company {
  id: string
  legalName: string
  tradeName: string
  document: string
  branches: Branch[]
}
