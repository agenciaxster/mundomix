import { useState, useEffect } from 'react'
import {
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  X,
  Loader2,
  AlertCircle,
  Package,
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { productService, type ProductWithBranchStock } from '@/lib/services/product.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

interface ProductDeleteAuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  product: ProductWithBranchStock | null
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export function ProductDeleteAuthModal({
  isOpen,
  onClose,
  onSuccess,
  product,
}: ProductDeleteAuthModalProps) {
  const { activeCompany, user, activeRole } = useAuth()

  const [supervisorEmail, setSupervisorEmail] = useState('')
  const [supervisorPassword, setSupervisorPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Se o usuário logado atualmente já for gerente ou admin/proprietário, preenche seu email
  useEffect(() => {
    if (isOpen) {
      setSupervisorPassword('')
      setErrorMessage(null)
      setShowPassword(false)

      const isCurrentSupervisor =
        activeRole === 'owner' || activeRole === 'admin' || activeRole === 'manager'

      if (isCurrentSupervisor && user?.email) {
        setSupervisorEmail(user.email)
      } else {
        setSupervisorEmail('')
      }
    }
  }, [isOpen, activeRole, user])

  if (!isOpen || !product) return null

  async function handleConfirmDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!activeCompany?.id || !product) return

    const email = supervisorEmail.trim().toLowerCase()
    const password = supervisorPassword

    if (!email) {
      setErrorMessage('Informe o e-mail do Gerente ou Administrador.')
      return
    }

    if (!password) {
      setErrorMessage('Informe a senha de autorização.')
      return
    }

    setIsVerifying(true)
    setErrorMessage(null)

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase client não configurado.')
      }

      // 1. Cria um client isolado e efêmero para validar as credenciais sem destruir a sessão atual
      const ephemeralClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })

      const { data: authData, error: authError } = await ephemeralClient.auth.signInWithPassword({
        email,
        password,
      })

      if (authError || !authData.user) {
        throw new Error('Credenciais inválidas. Verifique o e-mail e a senha informados.')
      }

      const supervisorUserId = authData.user.id

      if (!supabase) throw new Error('Cliente Supabase não configurado.')

      // 2. Valida se o usuário autenticado possui papel de Gerente ou Administrador na empresa ativa
      const { data: accessData, error: accessError } = await supabase
        .from('user_company_access')
        .select('role, status')
        .eq('company_id', activeCompany.id)
        .eq('user_id', supervisorUserId)
        .eq('status', 'active')
        .maybeSingle()

      if (accessError) {
        console.error('Erro ao verificar permissões de gerência:', accessError)
        throw new Error('Falha ao checar autorização de gerência. Tente novamente.')
      }

      const authorizedRoles = ['owner', 'admin', 'manager']
      if (!accessData || !authorizedRoles.includes(accessData.role)) {
        throw new Error(
          'Acesso negado: O usuário informado não possui perfil de Gerente ou Administrador nesta empresa.'
        )
      }

      // 3. Executa a exclusão do produto com autorização confirmada
      await productService.deleteProduct(activeCompany.id, product.id)

      const roleLabel =
        accessData.role === 'owner'
          ? 'Proprietário'
          : accessData.role === 'admin'
          ? 'Administrador'
          : 'Gerente'

      toast.success(
        `Produto "${product.name}" excluído com sucesso! Autorizado por ${email} (${roleLabel}).`
      )

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Falha na autorização de exclusão de produto:', err)
      setErrorMessage(err.message || 'Erro ao validar autorização.')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Header com destaque de segurança */}
        <div className="flex items-center justify-between border-b border-rose-500/20 px-6 py-4 bg-rose-500/5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Autorização de Exclusão</h2>
              <p className="text-xs text-rose-300/80">Requer senha de Gerente ou Administrador</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isVerifying}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Informações do Produto */}
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400">
                <Package className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-400">Produto a ser excluído:</div>
                <div className="text-sm font-bold text-white truncate" title={product.name}>
                  {product.name}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                  {product.sku && <span>SKU: {product.sku}</span>}
                  <span>
                    Preço:{' '}
                    {product.sale_price.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-rose-400/90 bg-rose-500/10 rounded-lg p-2.5 border border-rose-500/20 leading-relaxed">
              ⚠️ <strong>Operação restrita:</strong> A exclusão removerá este produto do catálogo e seu
              vínculo de estoque na filial. Para prevenir perdas acidentais, a ação deve ser autorizada
              por um <strong>Gerente</strong> ou <strong>Administrador</strong>.
            </div>
          </div>

          {/* Form de Autenticação */}
          <form onSubmit={handleConfirmDelete} className="space-y-3.5">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/15 border border-rose-500/30 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                E-mail do Gerente / Admin <span className="text-rose-400">*</span>
              </label>
              <Input
                type="email"
                value={supervisorEmail}
                onChange={(e) => {
                  setSupervisorEmail(e.target.value)
                  if (errorMessage) setErrorMessage(null)
                }}
                placeholder="gerente@mundomix.com.br"
                required
                className="bg-slate-800/80 border-slate-700 text-white text-xs placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Senha do Gerente / Admin <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={supervisorPassword}
                  onChange={(e) => {
                    setSupervisorPassword(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  placeholder="Digite sua senha de autorização..."
                  required
                  autoFocus
                  className="bg-slate-800/80 border-slate-700 text-white text-xs placeholder:text-slate-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isVerifying}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                disabled={isVerifying}
                className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs gap-1.5 shadow-lg shadow-rose-600/20"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validando Autorização...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Autorizar e Excluir Produto
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
