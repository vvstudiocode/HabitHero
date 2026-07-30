import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TaskOrigin = 'child_proposed' | 'parent_suggested' | 'parent_assigned' | 'system_template';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

function decodeBase64(value: string) {
  const normalized = value.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function apnsPrivateKeyBytes() {
  const value = Deno.env.get('APNS_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  if (!value) return null;
  return decodeBase64(value.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', ''));
}

async function createApnsToken() {
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const keyBytes = apnsPrivateKeyBytes();
  if (!keyId || !teamId || !keyBytes) return null;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const header = base64Url(utf8(JSON.stringify({ alg: 'ES256', kid: keyId })));
  const payload = base64Url(utf8(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function sendApns(token: string, title: string, body: string, taskId: string) {
  const jwt = await createApnsToken();
  const bundleId = Deno.env.get('APNS_BUNDLE_ID') ?? 'com.vvstudiocode.habithero';
  const environment = Deno.env.get('APNS_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';
  if (!jwt) return { configured: false, status: 0 };

  const host = environment === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
  const response = await fetch(`https://${host}/3/device/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: { alert: { title, body }, sound: 'default' },
      taskId,
    }),
  });
  return { configured: true, status: response.status };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !serviceRoleKey || !publishableKey || !authorization) return json({ error: 'Authentication is required' }, 401);

  try {
    const body = await request.json() as { taskId?: string };
    if (!body.taskId || !/^[0-9a-f-]{36}$/i.test(body.taskId)) return json({ error: 'Task id is invalid' }, 400);

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Authentication is required' }, 401);

    const { data: task, error: taskError } = await adminClient
      .from('tasks')
      .select('id, family_id, child_profile_id, name, origin')
      .eq('id', body.taskId)
      .single();
    if (taskError || !task) return json({ error: 'Task not found' }, 404);

    const origin = task.origin as TaskOrigin;
    let targetProfileIds: string[] = [];
    let title = 'HabitHero';
    let message = `有新的任務：「${task.name}」`;

    if (origin === 'child_proposed') {
      const { data: child } = await adminClient
        .from('child_profiles')
        .select('id, profile_id, display_name')
        .eq('id', task.child_profile_id)
        .eq('family_id', task.family_id)
        .single();
      if (!child || child.profile_id !== userData.user.id) return json({ error: 'Task is not owned by the current child' }, 403);
      const { data: parents } = await adminClient
        .from('family_members')
        .select('profile_id')
        .eq('family_id', task.family_id)
        .eq('role', 'parent');
      targetProfileIds = (parents ?? []).map(parent => parent.profile_id);
      title = '有新的目標提案';
      message = `${child.display_name} 提出了一個新目標：「${task.name}」`;
    } else if (origin === 'parent_assigned' || origin === 'parent_suggested' || origin === 'system_template') {
      const { data: parentMember } = await adminClient
        .from('family_members')
        .select('profile_id')
        .eq('family_id', task.family_id)
        .eq('profile_id', userData.user.id)
        .eq('role', 'parent')
        .maybeSingle();
      if (!parentMember) return json({ error: 'Only a parent can send this task notification' }, 403);
      const { data: child } = await adminClient
        .from('child_profiles')
        .select('profile_id, display_name')
        .eq('id', task.child_profile_id)
        .eq('family_id', task.family_id)
        .single();
      if (child?.profile_id) {
        targetProfileIds = [child.profile_id];
        title = '有新的任務';
        message = `家長新增了任務：「${task.name}」`;
      }
    }

    if (targetProfileIds.length === 0) return json({ sent: 0, configured: Boolean(apnsPrivateKeyBytes()) });
    const { data: profiles } = await adminClient.from('profiles').select('id').in('id', targetProfileIds).eq('notifications_enabled', true);
    const enabledProfileIds = (profiles ?? []).map(profile => profile.id);
    if (enabledProfileIds.length === 0) return json({ sent: 0, configured: Boolean(apnsPrivateKeyBytes()) });
    const { data: devices } = await adminClient
      .from('push_devices')
      .select('id, token')
      .eq('family_id', task.family_id)
      .in('profile_id', enabledProfileIds)
      .eq('platform', 'ios')
      .eq('enabled', true);

    let sent = 0;
    let configured = false;
    for (const device of devices ?? []) {
      const result = await sendApns(device.token, title, message, task.id);
      configured = result.configured;
      if (result.status >= 200 && result.status < 300) sent += 1;
      if (result.status === 400 || result.status === 410) {
        await adminClient.from('push_devices').update({ enabled: false }).eq('id', device.id);
      }
    }
    return json({ sent, configured });
  } catch (error) {
    console.error('notify-task-created failed', error);
    return json({ error: 'Notification delivery failed' }, 500);
  }
});
