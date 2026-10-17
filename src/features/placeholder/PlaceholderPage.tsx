import { useLocation, Link } from 'react-router-dom'
import {
  Hammer,
  ArrowLeft,
  Calendar,
  Database,
  ShieldCheck,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { NAVIGATION_CONFIG } from '@/app/navigation'

export function PlaceholderPage() {
  const location = useLocation()

  // Find metadata for current route from NAVIGATION_CONFIG
  let activeItem = {
    title: 'Módulo em Planejamento',
    description: 'Este módulo será desenvolvido em uma etapa específica do projeto.',
    group: 'ERP MundoMix',
  }

  for (const group of NAVIGATION_CONFIG) {
    const found = group.items.find((item) => item.href === location.pathname)
    if (found) {
      activeItem = {
        title: found.title,
        description: found.description || 'Módulo funcional planejado para as próximas etapas.',
        group: group.groupTitle,
      }
      break
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={activeItem.title}
        description={activeItem.description}
        badge={activeItem.group}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Dashboard
            </Link>
          </Button>
        }
      />

      <EmptyState
        icon={Hammer}
        badge="Etapa de Fundação"
        title={`Módulo ${activeItem.title} em Desenvolvimento`}
        description={`O layout e as rotas já estão estruturados. As regras de negócio, tabelas relacionais no PostgreSQL, autenticação e controle de permissões (RLS) serão desenvolvidos nas etapas dedicadas.`}
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="sm">
              <Link to="/">Retornar ao Início</Link>
            </Button>
          </div>
        }
      />

      {/* Technical Architecture Overview Card */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-slate-200/60 dark:border-slate-800/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Modelagem Relacional
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  PostgreSQL com suporte a múltiplas filiais
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/60 dark:border-slate-800/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Segurança RLS
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Isolamento rigoroso por empresa e unidade
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/60 dark:border-slate-800/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Entrega Modular
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Construção incremental sem mock de dados falsos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
