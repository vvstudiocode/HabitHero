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

async function deleteStorageForPrefixes(adminClient: ReturnType<typeof createClient>, prefixes: string[]) {
  const { data: buckets, error: bucketsError } = await adminClient.storage.listBuckets();
  if (bucketsError) throw new Error(`Unable to inspect account storage: ${bucketsError.message}`);

  for (const bucket of buckets ?? []) {
    for (const prefix of prefixes) {
      const pending = [prefix];
      const objectPaths: string[] = [];
      while (pending.length > 0) {
        const path = pending.shift()!;
        const { data: entries, error: listError } = await adminClient.storage.from(bucket.name).list(path, { limit: 1000 });
        if (listError) throw new Error(`Unable to inspect account storage: ${listError.message}`);
        for (const entry of entries ?? []) {
          const entryPath = path ? `${path}/${entry.name}` : entry.name;
          if (entry.id) objectPaths.push(entryPath);
          else pending.push(entryPath);
        }
      }
      if (objectPaths.length === 0) continue;
      const { error: removeError } = await adminClient.storage.from(bucket.name).remove(objectPaths);
      if (removeError) throw new Error(`Unable to delete account storage: ${removeError.message}`);
    }
  }
}

async function deleteAuthUserOrThrow(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Unable to delete authentication user ${userId}: ${error.message}`);
}

async function assertAuthUserDeleted(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await adminClient.auth.admin.getUserById(userId);
  if (data.user) throw new Error(`Authentication user ${userId} still exists after deletion`);
  if (error && !/not found|user not found/i.test(error.message)) {
    throw new Error(`Unable to verify authentication deletion: ${error.message}`);
  }
}

async function assertFamilyDataDeleted(adminClient: ReturnType<typeof createClient>, familyIds: string[]) {
  const familyScopedTables = [
    'family_members',
    'child_profiles',
    'task_templates',
    'tasks',
    'rewards',
    'wishlist_items',
    'reward_redemptions',
    'point_ledger',
    'parent_consents',
  ];
  for (const table of familyScopedTables) {
    const { count, error } = await adminClient.from(table).select('family_id', { count: 'exact', head: true }).in('family_id', familyIds);
    if (error) throw new Error(`Unable to verify ${table} deletion: ${error.message}`);
    if ((count ?? 0) > 0) throw new Error(`${table} data still exists after deletion`);
  }
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

    const { data: memberships, error: membershipError } = await adminClient
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
      await deleteStorageForPrefixes(adminClient, [...familyIds, userData.user.id, ...childProfileIds]);
      const { error: familyDeleteError } = await adminClient.from('families').delete().in('id', familyIds);
      if (familyDeleteError) throw new Error(`Unable to delete family data: ${familyDeleteError.message}`);

      const { data: remainingFamilies, error: familyVerifyError } = await adminClient.from('families').select('id').in('id', familyIds);
      if (familyVerifyError) throw new Error(`Unable to verify family deletion: ${familyVerifyError.message}`);
      if ((remainingFamilies ?? []).length > 0) throw new Error('Family data still exists after deletion');
      await assertFamilyDataDeleted(adminClient, familyIds);

      for (const childProfileId of childProfileIds) {
        await deleteAuthUserOrThrow(adminClient, childProfileId);
        await assertAuthUserDeleted(adminClient, childProfileId);
      }
    }

    await deleteAuthUserOrThrow(adminClient, userData.user.id);
    await assertAuthUserDeleted(adminClient, userData.user.id);
    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
