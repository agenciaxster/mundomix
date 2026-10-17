import { useState, useEffect } from 'react'
import { X, Tag, Save, Loader2, Sparkles, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { brandService } from '@/lib/services/brand.service'
import type { Brand } from '@/types/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

interface BrandFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (savedBrand?: Brand) => void
  brandToEdit?: Brand | null
}

export function BrandFormModal({
  isOpen,
  onClose,
  onSuccess,
  brandToEdit,
}: BrandFormModalProps) {
  const { activeCompany } = useAuth()

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isEditing = Boolean(brandToEdit)

  useEffect(() => {
    if (brandToEdit) {
      setName(brandToEdit.name)
      setCode(brandToEdit.code || '')
      setDescription(brandToEdit.description || '')
      setLogoUrl(brandToEdit.logo_url || '')
      setStatus(brandToEdit.status)
    } else {
      setName('')
      setCode('')
      setDescription('')
      setLogoUrl('')
      setStatus('active')
    }
    setErrorMsg(null)
  }, [brandToEdit, isOpen])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeCompany?.id) {
      toast.error('Empresa não selecionada.')
      return
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMsg('Informe o nome da marca ou fabricante.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      let saved: Brand
      if (isEditing && brandToEdit) {
        saved = await brandService.updateBrand(activeCompany.id, brandToEdit.id, {
          name: trimmedName,
          code: code.trim() || null,
          description: description.trim() || null,
          logo_url: logoUrl.trim() || null,
          status,
        })
        toast.success(`Marca "${trimmedName}" atualizada com sucesso!`)
      } else {
        saved = await brandService.createBrand(activeCompany.id, {
          name: trimmedName,
          code: code.trim() || null,
          description: description.trim() || null,
          logo_url: logoUrl.trim() || null,
          status,
        })
        toast.success(`Marca "${trimmedName}" cadastrada com sucesso!`)
      }

      onSuccess(saved)
      onClose()
    } catch (err: any) {
      console.error('Erro ao salvar marca:', err)
      setErrorMsg(err.message || 'Erro ao salvar marca.')
      toast.error(err.message || 'Erro ao salvar marca.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? 'Editar Marca / Fabricante' : 'Nova Marca Comercial'}
              </h2>
              <p className="text-xs text-slate-400">
                Cadastre fabricantes para organizar e filtrar itens no catálogo
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Nome da Marca */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Nome da Marca / Fabricante <span className="text-rose-400">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errorMsg) setErrorMsg(null)
              }}
              placeholder="Ex: Bosch, Tramontina, Tigre, Vonder, Makita..."
              required
              autoFocus
              className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Código / Sigla */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Código / Sigla (Opcional)
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex: BOS, TRA, TIG"
                className="bg-slate-800/80 border-slate-700 text-white font-mono placeholder:text-slate-500 text-xs uppercase"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none h-9"
              >
                <option value="active">Ativo (visível no catálogo)</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>

          {/* URL do Logo */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-purple-400" />
              URL do Logo / Imagem (Opcional)
            </label>
            <Input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://exemplo.com/logo-fabricante.png"
              className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 text-xs"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Descrição / Observações (Opcional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Informações do fabricante, suporte ou linha de produtos..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none resize-none"
            />
          </div>

          {/* Dica de Integração */}
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 text-[11px] text-slate-400">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              Ao salvar, esta marca estará disponível imediatamente no cadastro de produtos e nos filtros de pesquisa.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs gap-1.5 shadow-lg shadow-amber-600/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEditing ? 'Salvar Alterações' : 'Cadastrar Marca'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
