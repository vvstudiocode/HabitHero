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

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user || userData.user.is_anonymous) return json({ error: 'A verified parent account is required' }, 403);

    const { data: memberships, error: membershipError } = await userClient
      .from('family_members')
      .select('family_id, role')
      .eq('profile_id', userData.user.id)
      .eq('role', 'parent');
    if (membershipError) return json({ error: 'Unable to verify family ownership' }, 500);

    const familyIds = (memberships ?? []).map((membership) => membership.family_id);
    if (familyIds.length > 0) {
      const { data: childProfiles, error: childError } = await adminClient
        .from('child_profiles')
        .select('profile_id')
        .in('family_id', familyIds)
        .not('profile_id', 'is', null);
      if (childError) return json({ error: 'Unable to prepare child account deletion' }, 500);

      const childProfileIds = [...new Set((childProfiles ?? []).map((child) => child.profile_id).filter(Boolean))] as string[];
      const { error: familyDeleteError } = await adminClient.from('families').delete().in('id', familyIds);
      if (familyDeleteError) return json({ error: 'Unable to delete family data' }, 500);

      for (const childProfileId of childProfileIds) {
        await adminClient.auth.admin.deleteUser(childProfileId);
      }
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userData.user.id);
    if (deleteUserError) return json({ error: 'Unable to delete account' }, 500);
    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
