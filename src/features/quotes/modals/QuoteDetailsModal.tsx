import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  FileText,
  Building2,
  User,
  Calendar,
  Clock,
  Printer,
  Copy,
  Pencil,
  CheckCircle2,
  XCircle,
  AlertCircle,
  History,
  Loader2,
  Send,
  Calculator,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { quoteService } from '@/lib/services/quote.service'
import type { Quote, QuoteStatusHistory, QuoteStatus } from '@/types/quote'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/shared/LoadingState'
import { toast } from '@/hooks/useToast'

interface QuoteDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  quoteId: string | null
  onStatusChanged?: () => void
}

export function QuoteDetailsModal({
  isOpen,
  onClose,
  quoteId,
  onStatusChanged,
}: QuoteDetailsModalProps) {
  const navigate = useNavigate()
  const { activeCompany, hasPermission } = useAuth()

  const [quote, setQuote] = useState<Quote | null>(null)
  const [history, setHistory] = useState<QuoteStatusHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)

  const canEditSales = hasPermission('sales', 'edit')
  const canCreateSales = hasPermission('sales', 'create')

  useEffect(() => {
    async function loadQuoteDetails() {
      if (!isOpen || !quoteId || !activeCompany?.id) return
      setIsLoading(true)
      try {
        const [q, hist] = await Promise.all([
          quoteService.getQuote(quoteId, activeCompany.id),
          quoteService.getQuoteHistory(quoteId),
        ])
        setQuote(q)
        setHistory(hist)
      } catch (err: any) {
        console.error('Erro ao carregar detalhes do orçamento:', err)
        toast.error(err.message || 'Falha ao buscar orçamento.')
      } finally {
        setIsLoading(false)
      }
    }

    loadQuoteDetails()
  }, [isOpen, quoteId, activeCompany])

  if (!isOpen) return null

  async function handleStatusChange(newStatus: QuoteStatus, reasonText: string) {
    if (!quote || isUpdatingStatus) return
    setIsUpdatingStatus(true)
    try {
      await quoteService.updateQuoteStatus(quote.id, newStatus, reasonText)
      toast.success(`Status atualizado para "${newStatus.toUpperCase()}"!`)

      // Recarrega
      if (activeCompany) {
        const [updated, hist] = await Promise.all([
          quoteService.getQuote(quote.id, activeCompany.id),
          quoteService.getQuoteHistory(quote.id),
        ])
        setQuote(updated)
        setHistory(hist)
      }
      onStatusChanged?.()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao alterar status do orçamento.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  async function handleDuplicate() {
    if (!quote || !activeCompany || isDuplicating) return
    setIsDuplicating(true)
    try {
      const newId = await quoteService.duplicateQuote(quote.id, activeCompany.id)
      toast.success('Orçamento duplicado com sucesso!')
      onClose()
      navigate(`/comercial/orcamentos/${newId}/editar`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao duplicar orçamento.')
    } finally {
      setIsDuplicating(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  const isEditable = quote && quote.status !== 'converted'

  function getStatusBadge(status: QuoteStatus) {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-700">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Rascunho
          </span>
        )
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/30">
            <Send className="h-3.5 w-3.5 text-amber-400" />
            Enviado ao Cliente
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Aprovado
          </span>
        )
      case 'converted':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400 border border-blue-500/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
            Convertido em Venda (Imutável)
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400 border border-rose-500/30">
            <XCircle className="h-3.5 w-3.5 text-rose-400" />
            Recusado / Cancelado
          </span>
        )
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-400 border border-orange-500/30">
            <AlertCircle className="h-3.5 w-3.5 text-orange-400" />
            Expirado
          </span>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  Orçamento {quote?.code || '---'}
                </h2>
                {quote && getStatusBadge(quote.status)}
              </div>
              <p className="text-xs text-slate-400">
                Emitido em{' '}
                {quote?.created_at
                  ? new Date(quote.created_at).toLocaleDateString('pt-BR')
                  : '---'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-slate-800 text-slate-300 hover:bg-slate-800 h-8 text-xs"
              title="Imprimir proposta"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Imprimir
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {isLoading ? (
          <div className="p-12">
            <LoadingState message="Carregando dados completos do orçamento..." />
          </div>
        ) : !quote ? (
          <div className="p-12 text-center text-slate-400">
            Orçamento não encontrado.
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto scrollbar-thin">
            {/* Aviso se convertido em venda */}
            {quote.status === 'converted' && (
              <div className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-400" />
                <span>
                  <strong>Orçamento Finalizado:</strong> Este orçamento foi convertido em venda
                  e tornou-se estritamente imutável para preservação da integridade fiscal e
                  comercial.
                </span>
              </div>
            )}

            {/* Cabeçalho de Dados: Filial, Cliente e Validade */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filial */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  <Building2 className="h-3.5 w-3.5 text-blue-400" />
                  Filial Emissora
                </div>
                <div className="text-sm font-bold text-white">
                  {quote.branch?.name || 'Matriz'}
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Código: {quote.branch?.code || '---'}
                </div>
              </div>

              {/* Cliente */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  <User className="h-3.5 w-3.5 text-emerald-400" />
                  Cliente
                </div>
                <div className="text-sm font-bold text-white">
                  {quote.customer_name || 'Cliente Avulso (Não identificado)'}
                </div>
                {quote.customer_document && (
                  <div className="text-xs text-slate-400 font-mono">
                    Doc: {quote.customer_document}
                  </div>
                )}
                {quote.customer_phone && (
                  <div className="text-xs text-slate-400">
                    Tel: {quote.customer_phone}
                  </div>
                )}
              </div>

              {/* Prazos */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  <Calendar className="h-3.5 w-3.5 text-amber-400" />
                  Validade Comercial
                </div>
                <div className="text-sm font-bold text-white">
                  Até {new Date(quote.valid_until + 'T23:59:59').toLocaleDateString('pt-BR')}
                </div>
                <div className="text-xs text-slate-400">
                  Emitido por: {quote.user_name || quote.user_email || 'Vendedor'}
                </div>
              </div>
            </div>

            {/* Tabela de Produtos / Itens do Orçamento */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Itens e Produtos Cotados ({quote.items?.length || 0})
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Item / Descrição</th>
                      <th className="p-3">SKU / Barras</th>
                      <th className="p-3 text-right">Qtd</th>
                      <th className="p-3 text-right">Preço Unit.</th>
                      <th className="p-3 text-center">Tipo</th>
                      <th className="p-3 text-right">Desconto</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {quote.items?.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-850/40">
                        <td className="p-3 font-medium text-white">
                          {item.product_name}
                          {item.notes && (
                            <p className="text-[11px] text-slate-400 italic mt-0.5">
                              Obs: {item.notes}
                            </p>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-400">
                          {item.product_sku || item.product_barcode || '---'}
                        </td>
                        <td className="p-3 text-right font-bold text-white">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-3 text-right text-slate-200">
                          {item.unit_price.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="p-3 text-center">
                          {item.price_type === 'wholesale' ? (
                            <span className="inline-flex rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                              Atacado
                            </span>
                          ) : (
                            <span className="inline-flex rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                              Varejo
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right text-slate-400">
                          {item.discount > 0
                            ? item.discount.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })
                            : '-'}
                        </td>
                        <td className="p-3 text-right font-bold text-white">
                          {item.total.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totais do Orçamento */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Observações e Condições Comerciais
                </span>
                <p className="text-xs text-slate-300 whitespace-pre-wrap">
                  {quote.notes || 'Nenhuma observação comercial informada.'}
                </p>
              </div>

              <div className="w-full sm:w-72 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-200">
                    {quote.subtotal.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>

                {quote.discount_amount > 0 && (
                  <div className="flex justify-between text-xs text-rose-400">
                    <span>
                      Desconto Geral (
                      {quote.discount_type === 'percentage'
                        ? `${quote.discount_value}%`
                        : 'Valor'}
                      ):
                    </span>
                    <span className="font-semibold">
                      -
                      {quote.discount_amount.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                  </div>
                )}

                <div className="border-t border-slate-800 pt-2 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-300 uppercase">Total Líquido:</span>
                  <span className="text-xl font-black text-emerald-400">
                    {quote.total.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Histórico Auditável de Status */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                <History className="h-4 w-4 text-blue-400" />
                Histórico Auditável de Transições de Status
              </div>

              {history.length === 0 ? (
                <div className="text-xs text-slate-500 py-2">
                  Nenhum registro de alteração de status registrado.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-start justify-between border-l-2 border-blue-500/50 pl-3 py-1 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white">
                          Para {h.new_status.toUpperCase()}
                        </span>
                        {h.previous_status && (
                          <span className="text-slate-400 ml-1.5">
                            (anterior: {h.previous_status})
                          </span>
                        )}
                        {h.reason && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{h.reason}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(h.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-6 py-4 bg-slate-850/80">
          <div className="flex items-center gap-2">
            {canCreateSales && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDuplicate}
                disabled={isDuplicating}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs gap-1.5"
              >
                {isDuplicating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Duplicar como Novo
              </Button>
            )}

            {isEditable && canEditSales && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose()
                  navigate(`/comercial/orcamentos/${quote.id}/editar`)
                }}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar Orçamento
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditable && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onClose()
                  navigate(`/comercial/pdv?quote_id=${quote.id}`)
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5 shadow-md shadow-emerald-950/40"
              >
                <Calculator className="h-3.5 w-3.5" />
                Faturar no PDV
              </Button>
            )}

            {isEditable && canEditSales && (
              <>
                {quote.status !== 'approved' && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      handleStatusChange('approved', 'Aprovação formal do orçamento pelo cliente')
                    }
                    disabled={isUpdatingStatus}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Aprovar Orçamento
                  </Button>
                )}

                {quote.status !== 'rejected' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleStatusChange('rejected', 'Orçamento recusado ou cancelado')
                    }
                    disabled={isUpdatingStatus}
                    className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Recusar
                  </Button>
                )}
              </>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-slate-800 text-slate-400 hover:text-white text-xs"
            >
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
