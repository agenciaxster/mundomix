import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Suporta tanto VITE_SUPABASE_PUBLISHABLE_KEY (padrão novo) quanto VITE_SUPABASE_ANON_KEY (legado)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  const missing: string[] = []
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL')
  if (!SUPABASE_KEY) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY)')
  console.error(
    `[ERP MundoMix] Configuração incompleta do Supabase.\n` +
    `Variáveis ausentes: ${missing.join(', ')}\n` +
    `Configure o arquivo .env baseando-se no .env.example.`
  )
}

/**
 * Cliente Supabase tipado com o schema do banco.
 * Utiliza exclusivamente a chave pública (anon key / publishable key).
 * NUNCA utilize a service_role key no frontend.
 */
export const supabase = createClient<Database>(
  SUPABASE_URL ?? '',
  SUPABASE_KEY ?? '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
)

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)
