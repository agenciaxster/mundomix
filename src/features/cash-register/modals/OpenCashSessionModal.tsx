import { useState, useEffect } from 'react'
import {
  DollarSign,
  Building2,
  User,
  Clock,
  X,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'
import { cashRegisterService } from '@/lib/services/cash-register.service'
import type { CashSession } from '@/types/cash-register'

interface OpenCashSessionModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  branchId: string
  companyName: string
  branchName: string
  operatorName: string
  onSessionOpened: (session: CashSession) => void
}

export function OpenCashSessionModal({
  isOpen,
  onClose,
  companyId,
  branchId,
  companyName,
  branchName,
  operatorName,
  onSessionOpened,
}: OpenCashSessionModalProps) {
  const [terminalName, setTerminalName] = useState('Caixa 01')
  const [initialAmount, setInitialAmount] = useState<string>('0,00')
  const [openingNotes, setOpeningNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    if (isOpen) {
      setNow(new Date())
      setInitialAmount('0,00')
      setOpeningNotes('')
    }
  }, [isOpen])

  if (!isOpen) return null

  function parseCurrencyInput(value: string): number {
    const clean = value.replace(/[^\d.,]/g, '').replace(',', '.')
    const parsed = parseFloat(clean)
    return isNaN(parsed) ? 0 : Math.max(0, parsed)
  }

  function handleAmountChange(raw: string) {
    // Permite digitação com vírgula ou ponto
    setInitialAmount(raw)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId || !branchId) {
      toast.error('Empresa e filial ativas são obrigatórias.')
      return
    }

    const amount = parseCurrencyInput(initialAmount)
    setIsSubmitting(true)
    try {
      const session = await cashRegisterService.openSession({
        company_id: companyId,
        branch_id: branchId,
        terminal_name: terminalName.trim() || 'Caixa 01',
        initial_amount: amount,
        opening_notes: openingNotes.trim() || undefined,
      })

      toast.success(`Caixa "${session.terminal_name}" aberto com sucesso! Fundo inicial: R$ ${amount.toFixed(2)}`)
      onSessionOpened(session)
      onClose()
    } catch (err: any) {
      console.error('Erro ao abrir caixa:', err)
      toast.error(err.message || 'Falha ao registrar abertura de caixa.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden my-4 flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/90">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Abertura de Caixa
              </h2>
              <p className="text-xs text-slate-400">
                Inicie o expediente registrando o fundo inicial de troco.
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

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Informações Automáticas de Auditoria */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-850/60 border border-slate-800 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Building2 className="h-3 w-3 text-blue-400" />
                Unidade / Filial
              </span>
              <p className="font-semibold text-slate-200 truncate">{branchName || 'Filial Principal'}</p>
              <p className="text-[10px] text-slate-400 truncate">{companyName}</p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <User className="h-3 w-3 text-emerald-400" />
                Operador Responsável
              </span>
              <p className="font-semibold text-slate-200 truncate">{operatorName || 'Operador de Caixa'}</p>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-500" />
                {now.toLocaleTimeString('pt-BR')} &bull; {now.toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>

          {/* Identificação do Terminal */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Identificação do Terminal / Caixa <span className="text-rose-400">*</span>
            </label>
            <Input
              type="text"
              value={terminalName}
              onChange={(e) => setTerminalName(e.target.value)}
              placeholder="Ex: Caixa 01, Caixa Balcão, Terminal 02"
              required
              className="bg-slate-850 border-slate-700 text-white text-xs h-10"
            />
          </div>

          {/* Fundo de Caixa Inicial (Dinheiro Físico) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Valor Inicial em Dinheiro (Fundo de Troco)</span>
              <span className="text-[10px] text-emerald-400 font-normal">moeda física</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
              <Input
                type="text"
                value={initialAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0,00"
                required
                className="bg-slate-850 border-slate-700 text-emerald-400 font-mono font-bold text-base pl-10 h-11"
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              O fundo de caixa representa o dinheiro deixado na gaveta para facilitar troco. <strong>Não é contabilizado como faturamento/venda.</strong>
            </p>
          </div>

          {/* Atalhos Rápidos de Fundo de Caixa */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {[0, 50, 100, 150, 200, 300].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setInitialAmount(v.toFixed(2).replace('.', ','))}
                className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-850 text-[11px] font-mono text-slate-300 hover:text-white hover:border-slate-700 transition"
              >
                + R$ {v.toFixed(2)}
              </button>
            ))}
          </div>

          {/* Observações Opcionais */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Observações de Abertura (Opcional)
            </label>
            <textarea
              value={openingNotes}
              onChange={(e) => setOpeningNotes(e.target.value)}
              placeholder="Ex: Turno da manhã, gaveta conferida por Maria."
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-850 p-3 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Botões de Ação */}
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
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 px-5 shadow-lg shadow-emerald-900/30"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting ? 'Abrindo Caixa...' : 'Confirmar e Abrir Caixa'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
