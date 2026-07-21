import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const usernamePattern = /^[a-z0-9][a-z0-9_]{2,31}$/;
const passwordPattern = /^[A-Za-z0-9]{6,}$/;
const childEmailDomain = 'children.habithero.local';

type Action = 'create' | 'reset-password' | 'delete';

interface RequestBody {
  action: Action;
  familyId: string;
  childProfileId?: string;
  childName?: string;
  loginName?: string;
  password?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function childAccountEmail(loginName: string) {
  return `${loginName.trim().toLowerCase()}@${childEmailDomain}`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !serviceRoleKey || !publishableKey || !authorization) {
    return json({ error: 'Authentication is required' }, 401);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await request.json() as RequestBody;
    if (!body || !body.action || !body.familyId) return json({ error: 'Invalid request' }, 400);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Authentication is required' }, 401);

    const { data: parentMember, error: parentError } = await userClient
      .from('family_members')
      .select('id')
      .eq('family_id', body.familyId)
      .eq('profile_id', userData.user.id)
      .eq('role', 'parent')
      .maybeSingle();
    if (parentError || !parentMember) return json({ error: 'Family not found or not authorized' }, 403);

    if (body.action === 'create') {
      const loginName = body.loginName?.trim().toLowerCase() ?? '';
      const childName = body.childName?.trim() ?? '';
      if (!childName || childName.length > 80 || !usernamePattern.test(loginName) || !body.password || !passwordPattern.test(body.password)) {
        return json({ error: 'Invalid child account details' }, 400);
      }

      const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email: childAccountEmail(loginName),
        password: body.password,
        email_confirm: true,
        user_metadata: { account_type: 'child' },
      });
      if (createError || !createdUser.user) return json({ error: createError?.message ?? 'Unable to create child account' }, 400);

      const rpcName = body.childProfileId ? 'provision_existing_child_account' : 'provision_child_account';
      const rpcArgs = body.childProfileId
        ? {
            target_family_id: body.familyId,
            target_child_profile_id: body.childProfileId,
            target_login_name: loginName,
            target_profile_id: createdUser.user.id,
          }
        : {
            target_family_id: body.familyId,
            child_name: childName,
            target_login_name: loginName,
            target_profile_id: createdUser.user.id,
          };
      const { data: child, error: provisionError } = await userClient.rpc(rpcName, rpcArgs);
      if (provisionError) {
        await adminClient.auth.admin.deleteUser(createdUser.user.id);
        return json({ error: provisionError.message }, 400);
      }
      return json({ child });
    }

    if (!body.childProfileId) return json({ error: 'Child profile is required' }, 400);
    const { data: child, error: childError } = await userClient
      .from('child_profiles')
      .select('profile_id')
      .eq('id', body.childProfileId)
      .eq('family_id', body.familyId)
      .maybeSingle();
    if (childError || !child?.profile_id) return json({ error: 'Child account not found' }, 404);

    if (body.action === 'reset-password') {
      if (!body.password || !passwordPattern.test(body.password)) return json({ error: 'Invalid child password' }, 400);
      const { error } = await adminClient.auth.admin.updateUserById(child.profile_id, { password: body.password });
      return error ? json({ error: error.message }, 400) : json({ success: true });
    }

    if (body.action === 'delete') {
      const { error } = await adminClient.auth.admin.deleteUser(child.profile_id);
      return error ? json({ error: error.message }, 400) : json({ success: true });
    }

    return json({ error: 'Unsupported action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
