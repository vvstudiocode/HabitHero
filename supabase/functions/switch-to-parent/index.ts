import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !serviceRoleKey || !publishableKey || !authorization) return json({ error: 'Authentication is required' }, 401);

  try {
    const body = await request.json() as { password?: string };
    if (!body.password || body.password.length < 1 || body.password.length > 256) return json({ error: '家長密碼錯誤。' }, 401);

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user || userData.user.is_anonymous) return json({ error: '目前不是孩子登入狀態。' }, 403);

    const { data: childMember, error: memberError } = await adminClient
      .from('family_members')
      .select('family_id')
      .eq('profile_id', userData.user.id)
      .eq('role', 'child')
      .maybeSingle();
    if (memberError || !childMember) return json({ error: '目前帳號不是孩子成員。' }, 403);

    const { data: parentMember, error: parentError } = await adminClient
      .from('family_members')
      .select('profile_id')
      .eq('family_id', childMember.family_id)
      .eq('role', 'parent')
      .limit(1)
      .maybeSingle();
    if (parentError || !parentMember) return json({ error: '找不到此家庭的家長帳號。' }, 403);

    const { data: parentUser, error: parentUserError } = await adminClient.auth.admin.getUserById(parentMember.profile_id);
    const parentEmail = parentUser.user?.email;
    if (parentUserError || !parentEmail) return json({ error: '家長帳號資料不完整。' }, 500);

    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: parentSession, error: signInError } = await authClient.auth.signInWithPassword({ email: parentEmail, password: body.password });
    if (signInError || !parentSession.session) return json({ error: '家長密碼錯誤。' }, 401);
    return json({ session: parentSession.session });
  } catch {
    return json({ error: '家長模式授權失敗，請稍後再試。' }, 500);
  }
});
