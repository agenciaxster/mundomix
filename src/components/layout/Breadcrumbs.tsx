import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mapping route segments to human friendly labels
const ROUTE_LABELS: Record<string, string> = {
  comercial: 'Comercial',
  orcamentos: 'Atendimento e Orçamentos',
  pdv: 'PDV',
  vendas: 'Vendas',
  caixa: 'Controle de Caixa',
  cadastros: 'Cadastros',
  produtos: 'Produtos',
  categorias: 'Categorias',
  marcas: 'Marcas',
  clientes: 'Clientes',
  fornecedores: 'Fornecedores',
  estoque: 'Estoque',
  movimentacoes: 'Movimentações',
  transferencias: 'Transferências',
  inventario: 'Inventário',
  financeiro: 'Financeiro',
  'contas-pagar': 'Contas a Pagar',
  'contas-receber': 'Contas a Receber',
  crediario: 'Fiado e Crediário',
  'fluxo-caixa': 'Fluxo de Caixa',
  relatorios: 'Relatórios',
  'desempenho-vendedores': 'Desempenho dos Vendedores',
  admin: 'Administração',
  'empresas-filiais': 'Empresas e Filiais',
  'usuarios-permissoes': 'Usuários e Permissões',
  'configuracoes-empresa': 'Configurações da Empresa',
  'configuracoes-sistema': 'Configurações do Sistema',
  dashboard: 'Dashboard',
}

interface BreadcrumbsProps {
  className?: string
  customItems?: Array<{ label: string; href?: string }>
}

export function Breadcrumbs({ className, customItems }: BreadcrumbsProps) {
  const location = useLocation()

  if (customItems && customItems.length > 0) {
    return (
      <nav aria-label="Navegação estrutural" className={cn('flex items-center text-xs text-slate-500 dark:text-slate-400', className)}>
        <ol className="flex items-center space-x-1.5">
          <li>
            <Link
              to="/"
              className="flex items-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <Home className="h-3.5 w-3.5" />
              <span className="sr-only">Início</span>
            </Link>
          </li>
          {customItems.map((item, index) => {
            const isLast = index === customItems.length - 1
            return (
              <li key={index} className="flex items-center space-x-1.5">
                <ChevronRight className="h-3 w-3 text-slate-400" />
                {item.href && !isLast ? (
                  <Link
                    to={item.href}
                    className="hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-800 dark:text-slate-200" aria-current={isLast ? 'page' : undefined}>
                    {item.label}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    )
  }

  const pathnames = location.pathname.split('/').filter((x) => x)

  if (pathnames.length === 0) {
    return (
      <nav aria-label="Navegação estrutural" className={cn('flex items-center text-xs text-slate-500 dark:text-slate-400', className)}>
        <ol className="flex items-center space-x-1.5">
          <li className="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
            <Home className="h-3.5 w-3.5" />
            <span>Dashboard Principal</span>
          </li>
        </ol>
      </nav>
    )
  }

  return (
    <nav aria-label="Navegação estrutural" className={cn('flex items-center text-xs text-slate-500 dark:text-slate-400', className)}>
      <ol className="flex items-center space-x-1.5">
        <li>
          <Link
            to="/"
            className="flex items-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="sr-only">Dashboard</span>
          </Link>
        </li>

        {pathnames.map((segment, index) => {
          const href = `/${pathnames.slice(0, index + 1).join('/')}`
          const isLast = index === pathnames.length - 1
          const label = ROUTE_LABELS[segment] || segment.replace(/-/g, ' ')

          return (
            <li key={href} className="flex items-center space-x-1.5">
              <ChevronRight className="h-3 w-3 text-slate-400" />
              {isLast ? (
                <span className="font-semibold text-slate-900 dark:text-slate-100" aria-current="page">
                  {label}
                </span>
              ) : (
                <Link
                  to={href}
                  className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
