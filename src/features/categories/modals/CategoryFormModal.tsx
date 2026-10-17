import { useState, useEffect } from 'react'
import { X, Layers, Save, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { categoryService } from '@/lib/services/category.service'
import type { Category } from '@/types/category'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

interface CategoryFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (savedCategory?: Category) => void
  categoryToEdit?: Category | null
}

export function CategoryFormModal({
  isOpen,
  onClose,
  onSuccess,
  categoryToEdit,
}: CategoryFormModalProps) {
  const { activeCompany } = useAuth()

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isEditing = Boolean(categoryToEdit)

  useEffect(() => {
    if (categoryToEdit) {
      setName(categoryToEdit.name)
      setCode(categoryToEdit.code || '')
      setDescription(categoryToEdit.description || '')
      setStatus(categoryToEdit.status)
    } else {
      setName('')
      setCode('')
      setDescription('')
      setStatus('active')
    }
    setErrorMsg(null)
  }, [categoryToEdit, isOpen])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeCompany?.id) {
      toast.error('Empresa não selecionada.')
      return
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMsg('Informe o nome da categoria.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      let saved: Category
      if (isEditing && categoryToEdit) {
        saved = await categoryService.updateCategory(activeCompany.id, categoryToEdit.id, {
          name: trimmedName,
          code: code.trim() || null,
          description: description.trim() || null,
          status,
        })
        toast.success(`Categoria "${trimmedName}" atualizada com sucesso!`)
      } else {
        saved = await categoryService.createCategory(activeCompany.id, {
          name: trimmedName,
          code: code.trim() || null,
          description: description.trim() || null,
          status,
        })
        toast.success(`Categoria "${trimmedName}" cadastrada com sucesso!`)
      }

      onSuccess(saved)
      onClose()
    } catch (err: any) {
      console.error('Erro ao salvar categoria:', err)
      setErrorMsg(err.message || 'Erro ao salvar categoria.')
      toast.error(err.message || 'Erro ao salvar categoria.')
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? 'Editar Categoria' : 'Nova Categoria de Produto'}
              </h2>
              <p className="text-xs text-slate-400">
                Organize seu catálogo comercial e relatórios por departamento
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

          {/* Nome da Categoria */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Nome da Categoria <span className="text-rose-400">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errorMsg) setErrorMsg(null)
              }}
              placeholder="Ex: Ferramentas Elétricas, Hidráulica, Eletrônicos..."
              required
              autoFocus
              className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
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
                placeholder="Ex: FER-ELE, HID-01"
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
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none h-9"
              >
                <option value="active">Ativo (visível no catálogo)</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Descrição (Opcional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva quais tipos de itens pertencem a esta categoria ou regras comerciais..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Dica de Integração */}
          <div className="flex items-center gap-2 rounded-xl bg-blue-500/5 border border-blue-500/20 p-3 text-[11px] text-slate-400">
            <Sparkles className="h-4 w-4 text-blue-400 shrink-0" />
            <span>
              Ao salvar, esta categoria estará disponível imediatamente no cadastro e no filtro de produtos.
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
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs gap-1.5 shadow-lg shadow-blue-600/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEditing ? 'Salvar Alterações' : 'Cadastrar Categoria'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
