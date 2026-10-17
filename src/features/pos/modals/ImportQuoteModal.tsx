import { useState, useEffect } from 'react'
import { X, Search, FileText, Loader2, Calendar, User, ArrowRight, AlertCircle } from 'lucide-react'
import { quoteService } from '@/lib/services/quote.service'
import type { Quote } from '@/types/quote'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ImportQuoteModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  branchId: string
  onSelectQuote: (quote: Quote) => void
}

export function ImportQuoteModal({
  isOpen,
  onClose,
  companyId,
  branchId,
  onSelectQuote,
}: ImportQuoteModalProps) {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (isOpen && companyId) {
      loadQuotes()
    }
  }, [isOpen, companyId, branchId])

  async function loadQuotes() {
    setIsLoading(true)
    try {
      // Busca orçamentos não convertidos da filial
      const res = await quoteService.listQuotes(companyId, {
        branchId,
        pageSize: 50,
      })

      // Filtra apenas orçamentos em aberto / aprovados (não convertidos nem rejeitados)
      const valid = res.data.filter(
        (q) => q.status === 'approved' || q.status === 'sent' || q.status === 'draft'
      )
      setQuotes(valid)
    } catch (err) {
      console.error('Erro ao carregar orçamentos para o PDV:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredQuotes = quotes.filter((q) => {
    if (!searchTerm.trim()) return true
    const s = searchTerm.toLowerCase()
    return (
      q.code.toLowerCase().includes(s) ||
      (q.customer_name && q.customer_name.toLowerCase().includes(s)) ||
      (q.customer_document && q.customer_document.includes(s))
    )
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Importar Orçamento no PDV</h2>
              <p className="text-xs text-slate-400">
                Pressione <span className="font-bold text-slate-200">F8</span> para abrir este atalho
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Busca */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código (ORC-001001) ou nome do cliente..."
              className="pl-10 bg-slate-800 border-slate-700 text-white text-sm"
              autoFocus
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Apenas orçamentos em aberto desta filial são exibidos. Os preços e o saldo em estoque serão revalidados.
          </p>
        </div>

        {/* Lista */}
        <div className="p-6 max-h-[55vh] overflow-y-auto space-y-2.5">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="text-xs">Carregando orçamentos disponíveis...</span>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <AlertCircle className="h-8 w-8 mx-auto text-slate-500 opacity-60" />
              <p className="text-sm font-medium">Nenhum orçamento em aberto localizado.</p>
              <p className="text-xs text-slate-500">
                Crie um orçamento no módulo Comercial ou tente outro termo de busca.
              </p>
            </div>
          ) : (
            filteredQuotes.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between p-4 rounded-2xl border border-slate-800 bg-slate-850/50 hover:bg-slate-800/80 hover:border-slate-700 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-blue-400">{q.code}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        q.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {q.status === 'approved' ? 'Aprovado' : q.status === 'sent' ? 'Enviado' : 'Rascunho'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                    <User className="h-3 w-3 text-slate-400" />
                    <span>{q.customer_name || 'Consumidor Avulso'}</span>
                    {q.customer_document && (
                      <span className="text-[11px] text-slate-500 font-mono">({q.customer_document})</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    <span>Emitido em {new Date(q.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                <div className="text-right space-y-2">
                  <div className="text-base font-black text-emerald-400 font-mono">
                    R$ {Number(q.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      // Carrega os detalhes completos do orçamento (com itens)
                      const fullQuote = await quoteService.getQuote(q.id, companyId)
                      if (fullQuote) {
                        onSelectQuote(fullQuote)
                        onClose()
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                  >
                    <span>Carregar no PDV</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 px-6 py-3 bg-slate-850/80">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white"
          >
            Fechar (ESC)
          </Button>
        </div>
      </div>
    </div>
  )
}
