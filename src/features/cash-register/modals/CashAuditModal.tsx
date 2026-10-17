import { useState } from 'react'
import { CheckCircle2, ShieldCheck, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/useToast'
import { cashRegisterService } from '@/lib/services/cash-register.service'
import type { CashSession } from '@/types/cash-register'

interface CashAuditModalProps {
  isOpen: boolean
  onClose: () => void
  session: CashSession | null
  companyId: string
  onVerified: (updated: CashSession) => void
}

export function CashAuditModal({
  isOpen,
  onClose,
  session,
  companyId,
  onVerified,
}: CashAuditModalProps) {
  const [verificationNotes, setVerificationNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !session) return null

  const diff = session.difference_cash || 0

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return

    if (!verificationNotes.trim()) {
      toast.error('Informe o parecer da conferência gerencial.')
      return
    }

    setIsSubmitting(true)
    try {
      const updated = await cashRegisterService.verifySession({
        company_id: companyId,
        session_id: session.id,
        verification_notes: verificationNotes.trim(),
      })

      toast.success('Conferência gerencial registrada com sucesso!')
      onVerified(updated)
      onClose()
    } catch (err: any) {
      console.error('Erro na auditoria do caixa:', err)
      toast.error(err.message || 'Falha ao registrar conferência.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-4 flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/90">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Conferência Gerencial</h2>
              <p className="text-xs text-slate-400">Auditoria e aprovação de fechamento de caixa</p>
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

        <form onSubmit={handleVerify} className="p-6 space-y-4 text-xs">
          {/* Resumo da Divergência */}
          <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Terminal / Operador:</span>
              <span className="font-bold text-white">{session.terminal_name} &bull; {session.opened_by_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Dinheiro Esperado:</span>
              <span className="font-mono text-white">R$ {(session.expected_cash || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Dinheiro Contado:</span>
              <span className="font-mono text-white">R$ {(session.counted_cash || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-800 font-bold">
              <span className="flex items-center gap-1 text-slate-300">
                {diff !== 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />} Diferença:
              </span>
              <span className={`font-mono text-sm ${diff === 0 ? 'text-emerald-400' : diff > 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                {diff === 0 ? 'R$ 0,00 (Sem diferença)' : diff > 0 ? `+ R$ ${diff.toFixed(2)} (Sobra)` : `- R$ ${Math.abs(diff).toFixed(2)} (Falta)`}
              </span>
            </div>
            {session.difference_reason && (
              <div className="pt-1.5 text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="font-bold text-slate-400 block mb-0.5">Justificativa do Operador:</span>
                "{session.difference_reason}"
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Parecer / Despacho da Conferência <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              placeholder="Ex: Diferença conferida e justificada. Autorizado o encerramento sem pendência."
              rows={3}
              required
              className="w-full rounded-2xl border border-slate-700 bg-slate-850 p-3 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs border-slate-700 text-slate-300 hover:text-white"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 px-5 shadow-lg shadow-blue-900/30"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting ? 'Registrando...' : 'Aprovar / Registrar Conferência'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
