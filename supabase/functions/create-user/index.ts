// @ts-nocheck
// Supabase Edge Function (Deno Runtime)
// Execute com `supabase functions deploy create-user`
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: {
    get: (key: string) => string | undefined
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // 1. Validar token do chamador
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Cabeçalho de autorização ausente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: callerUser }, error: userError } = await callerClient.auth.getUser()
    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Usuário chamador não autenticado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const {
      companyId,
      email,
      password,
      fullName,
      phone,
      role = 'operator',
      roleId,
      branchIds = [],
    } = body

    if (!companyId || !email || !fullName) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios ausentes: companyId, email, fullName.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Verificar se o chamador é admin/owner da empresa solicitada
    const { data: callerAccess, error: accessError } = await callerClient
      .from('user_company_access')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single()

    if (accessError || !callerAccess || !['owner', 'admin'].includes(callerAccess.role)) {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores ou proprietários podem criar usuários nesta empresa.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Não permitir que admin comum conceda papel 'owner'
    if (role === 'owner' && callerAccess.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Apenas o proprietário pode conceder papel de proprietário.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Usar Service Role Client para criar usuário no Supabase Auth
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Criar usuário no auth.users
    const { data: newAuthData, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password: password || undefined,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || null,
      },
    })

    if (createAuthError) {
      return new Response(
        JSON.stringify({ error: createAuthError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newUserId = newAuthData.user.id

    // 4. Garantir atualização do perfil em public.profiles
    await adminClient
      .from('profiles')
      .upsert({
        id: newUserId,
        full_name: fullName,
        email,
        phone: phone || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      })

    // 5. Vincular à empresa via user_company_access
    const { error: companyAssignError } = await adminClient
      .from('user_company_access')
      .upsert({
        user_id: newUserId,
        company_id: companyId,
        role,
        role_id: roleId || null,
        status: 'active',
      })

    if (companyAssignError) {
      return new Response(
        JSON.stringify({ error: `Usuário criado, mas erro ao associar empresa: ${companyAssignError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Vincular filiais selecionadas
    if (Array.isArray(branchIds) && branchIds.length > 0) {
      const branchAccessRows = branchIds.map((bId: string) => ({
        user_id: newUserId,
        branch_id: bId,
        status: 'active',
      }))

      await adminClient
        .from('user_branch_access')
        .upsert(branchAccessRows)
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUserId,
          email,
          fullName,
          role,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno do servidor.'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
