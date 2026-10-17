import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eye, EyeOff, Layers, AlertCircle, Mail, KeyRound, ArrowRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { cn } from '@/lib/utils'

type LoginMode = 'signin' | 'reset'

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'O e-mail é obrigatório.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Informe um e-mail válido.'
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return 'A senha é obrigatória.'
  if (password.length < 6) return 'A senha deve ter ao menos 6 caracteres.'
  return null
}

function translateSupabaseError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'E-mail ou senha incorretos. Verifique seus dados.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Sua conta ainda não foi confirmada. Verifique seu e-mail.'
  }
  if (lower.includes('too many requests')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  }
  if (lower.includes('user not found')) {
    return 'Não encontramos uma conta com este e-mail.'
  }
  if (lower.includes('password')) {
    return 'Senha inválida. Verifique e tente novamente.'
  }
  return message
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const [mode, setMode] = useState<LoginMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)

    if (emailError || passwordError) {
      setError(emailError ?? passwordError)
      return
    }

    if (!supabase) {
      setError('Supabase não configurado. Verifique as variáveis de ambiente.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        setError(translateSupabaseError(signInError.message))
        return
      }

      // Redirecionamento para a rota original ou dashboard
      navigate(from, { replace: true })
    } catch {
      setError('Ocorreu um erro inesperado. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }

    if (!supabase) {
      setError('Supabase não configurado. Verifique as variáveis de ambiente.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` }
      )

      if (resetError) {
        setError(translateSupabaseError(resetError.message))
        return
      }

      setSuccessMessage(
        `Se existe uma conta cadastrada com ${email}, você receberá um e-mail com as instruções para redefinir a senha.`
      )
    } catch {
      setError('Ocorreu um erro inesperado. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Header mínimo com logo e alternador de tema */}
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Layers className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
              MundoMix ERP
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Multiloja Enterprise
            </span>
          </div>
        </Link>
        <ThemeToggle />
      </header>

      {/* Área central do formulário */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          {/* Título */}
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {mode === 'signin' ? 'Entrar na sua conta' : 'Recuperar senha'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mode === 'signin'
                ? 'Acesse o ERP MundoMix com suas credenciais.'
                : 'Informe seu e-mail e enviaremos as instruções de recuperação.'}
            </p>
          </div>

          {/* Card do formulário */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <form
              onSubmit={mode === 'signin' ? handleSignIn : handleResetPassword}
              noValidate
              className="space-y-4"
            >
              {/* Campo E-mail */}
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="usuario@empresa.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    disabled={isSubmitting}
                    className="pl-9"
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                </div>
              </div>

              {/* Campo Senha (apenas no modo login) */}
              {mode === 'signin' && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="login-password"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Senha
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={0}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-500 dark:hover:text-slate-300"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Erro */}
              {error && (
                <div
                  id="login-error"
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Mensagem de sucesso (ex: e-mail de recuperação enviado) */}
              {successMessage && (
                <div
                  role="status"
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  {successMessage}
                </div>
              )}

              {/* Botão Principal */}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {mode === 'signin'
                  ? isSubmitting
                    ? 'Entrando...'
                    : 'Entrar'
                  : isSubmitting
                    ? 'Enviando...'
                    : 'Enviar instruções'}
              </Button>

              {/* Toggle de modo */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signin' ? 'reset' : 'signin')
                    setError(null)
                    setSuccessMessage(null)
                  }}
                  className={cn(
                    'text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded dark:text-blue-400',
                    mode === 'reset' && 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  )}
                >
                  {mode === 'signin'
                    ? 'Esqueci minha senha'
                    : '← Voltar ao login'}
                </button>
              </div>
            </form>
          </div>

          {/* Rodapé informativo */}
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            Acesso restrito a colaboradores autorizados.
            <br />
            Problemas? Contate o administrador do sistema.
          </p>
        </div>
      </main>
    </div>
  )
}
