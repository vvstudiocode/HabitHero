import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TaskOrigin = 'child_proposed' | 'parent_suggested' | 'parent_assigned' | 'system_template';
type TaskNotificationEvent = 'created' | 'submitted' | 'reviewed';
type TaskNotificationPayload = {
  taskId?: string;
  scheduleId?: string;
  event: TaskNotificationEvent;
};

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

function fcmPrivateKeyBytes() {
  const value = Deno.env.get('FCM_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  if (!value) return null;
  return decodeBase64(value.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', ''));
}

function hasFcmConfiguration() {
  return Boolean(
    Deno.env.get('FCM_PROJECT_ID')
      && Deno.env.get('FCM_CLIENT_EMAIL')
      && fcmPrivateKeyBytes(),
  );
}

let fcmAccessToken: { value: string; expiresAt: number } | null = null;

async function createFcmAccessToken() {
  const projectId = Deno.env.get('FCM_PROJECT_ID');
  const clientEmail = Deno.env.get('FCM_CLIENT_EMAIL');
  const keyBytes = fcmPrivateKeyBytes();
  if (!projectId || !clientEmail || !keyBytes) return null;

  const now = Math.floor(Date.now() / 1000);
  if (fcmAccessToken && fcmAccessToken.expiresAt > now + 60) {
    return fcmAccessToken.value;
  }

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const header = base64Url(utf8(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64Url(utf8(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    utf8(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    console.error('FCM access token request failed', response.status, await response.text());
    return null;
  }

  const result = await response.json() as { access_token?: string; expires_in?: number };
  if (!result.access_token) return null;
  fcmAccessToken = {
    value: result.access_token,
    expiresAt: now + (result.expires_in ?? 3600),
  };
  return result.access_token;
}

async function createApnsToken(environment: 'sandbox' | 'production') {
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = environment === 'production'
    ? Deno.env.get('APNS_PRODUCTION_TEAM_ID') ?? Deno.env.get('APNS_TEAM_ID')
    : Deno.env.get('APNS_SANDBOX_TEAM_ID') ?? Deno.env.get('APNS_TEAM_ID');
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

async function sendApns(
  token: string,
  title: string,
  body: string,
  payload: TaskNotificationPayload,
) {
  const bundleId = Deno.env.get('APNS_BUNDLE_ID') ?? 'com.vvstudiocode.habithero';
  const environment = Deno.env.get('APNS_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';
  const jwt = await createApnsToken(environment);
  if (!jwt) return { configured: false, status: 0, invalidToken: false };

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
      // Unity Mobile Notifications reads the string stored under the APNs
      // `data` key. Keep the individual keys too for Capacitor and older
      // clients that already consume the flat payload.
      data: JSON.stringify(payload),
      ...payload,
    }),
  });
  return {
    configured: true,
    status: response.status,
    invalidToken: response.status === 400 || response.status === 410,
  };
}

async function sendFcm(
  token: string,
  title: string,
  body: string,
  payload: TaskNotificationPayload,
) {
  const projectId = Deno.env.get('FCM_PROJECT_ID');
  const accessToken = await createFcmAccessToken();
  if (!projectId || !accessToken) {
    return { configured: false, status: 0, invalidToken: false };
  }

  const data: Record<string, string> = { event: payload.event };
  if (payload.taskId) data.taskId = payload.taskId;
  if (payload.scheduleId) data.scheduleId = payload.scheduleId;
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json; UTF-8',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
        },
      }),
    },
  );
  const responseText = await response.text();
  const invalidToken = response.status === 404
    || response.status === 400 && /UNREGISTERED|registration-token-not-registered/i.test(responseText);
  if (!response.ok && response.status !== 400 && response.status !== 404) {
    console.error('FCM notification delivery failed', response.status, responseText);
  }
  return { configured: true, status: response.status, invalidToken };
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
    const body = await request.json() as { taskId?: string; scheduleId?: string; event?: TaskNotificationEvent };
    const hasTaskId = Boolean(body.taskId);
    const hasScheduleId = Boolean(body.scheduleId);
    if (hasTaskId === hasScheduleId) return json({ error: 'Provide exactly one task id or schedule id' }, 400);
    const referenceId = body.taskId ?? body.scheduleId ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(referenceId)) return json({ error: 'Notification reference id is invalid' }, 400);
    const event = body.event ?? 'created';
    if (!['created', 'submitted', 'reviewed'].includes(event)) return json({ error: 'Notification event is invalid' }, 400);
    if (hasScheduleId && event !== 'created') return json({ error: 'Schedules only support created notifications' }, 400);

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Authentication is required' }, 401);

    const { data: task, error: taskError } = hasTaskId
      ? await adminClient
        .from('tasks')
        .select('id, family_id, child_profile_id, name, origin, status, points, approved_points')
        .eq('id', referenceId)
        .single()
      : await adminClient
        .from('task_schedules')
        .select('id, family_id, child_profile_id, name, points')
        .eq('id', referenceId)
        .single();
    if (taskError || !task) return json({ error: 'Task not found' }, 404);

    const origin = (hasTaskId ? task.origin : 'parent_assigned') as TaskOrigin;
    let targetProfileIds: string[] = [];
    let title = '習慣冒險島';
    let message = `有新的任務：「${task.name}」`;
    const { data: child } = await adminClient
      .from('child_profiles')
      .select('id, profile_id, display_name')
      .eq('id', task.child_profile_id)
      .eq('family_id', task.family_id)
      .single();
    if (!child) return json({ error: 'Child profile not found' }, 404);

    const getParents = async () => {
      const { data: parents } = await adminClient
        .from('family_members')
        .select('profile_id')
        .eq('family_id', task.family_id)
        .eq('role', 'parent');
      return (parents ?? []).map(parent => parent.profile_id);
    };

    const isParent = async () => {
      const { data: parentMember } = await adminClient
        .from('family_members')
        .select('profile_id')
        .eq('family_id', task.family_id)
        .eq('profile_id', userData.user.id)
        .eq('role', 'parent')
        .maybeSingle();
      return Boolean(parentMember);
    };

    if (hasScheduleId) {
      if (!await isParent()) return json({ error: 'Only a parent can send a daily adventure notification' }, 403);
      targetProfileIds = [child.profile_id];
      title = '習慣冒險島';
      message = `家長新增了每日冒險：「${task.name}」`;
    } else if (event === 'created' && origin === 'child_proposed') {
      // The proposal RPC permits a family parent to create a proposal while
      // viewing a child account. Keep this authorization aligned with it.
      if (child.profile_id !== userData.user.id && !await isParent()) {
        return json({ error: 'Only the child or a family parent can create this task' }, 403);
      }
      targetProfileIds = await getParents();
      title = '習慣冒險島';
      message = `${child.display_name} 建立了「${task.name}」，完成後會請你確認點數。`;
    } else if (event === 'created' && (origin === 'parent_assigned' || origin === 'parent_suggested' || origin === 'system_template')) {
      if (!await isParent()) return json({ error: 'Only a parent can send this task notification' }, 403);
      targetProfileIds = [child.profile_id];
      title = '習慣冒險島';
      message = `家長新增了任務：「${task.name}」`;
    } else if (event === 'submitted') {
      // The completion RPC permits either the child or a family parent to
      // submit on the child's behalf. Keep notification authorization aligned
      // with that rule so parent-side child previews do not fail with 403.
      if (child.profile_id !== userData.user.id && !await isParent()) {
        return json({ error: 'Only the child or a family parent can send a completion notification' }, 403);
      }
      targetProfileIds = await getParents();
      title = '習慣冒險島';
      message = `${child.display_name} 完成了「${task.name}」，請確認完成內容。`;
    } else if (event === 'reviewed') {
      if (!await isParent()) return json({ error: 'Only a parent can send a review notification' }, 403);
      targetProfileIds = [child.profile_id];
      if (task.status === 'completed') {
        title = '任務已完成';
        message = `家長已確認「${task.name}」，獲得 ${task.approved_points ?? task.points} 點。`;
      } else {
        title = '任務需要補充';
        message = `家長對「${task.name}」提出了補充要求，請查看回饋。`;
      }
    }

    const configured = Boolean(apnsPrivateKeyBytes()) || hasFcmConfiguration();
    if (targetProfileIds.length === 0) return json({ sent: 0, configured });
    const { data: profiles } = await adminClient.from('profiles').select('id').in('id', targetProfileIds).eq('notifications_enabled', true);
    const enabledProfileIds = (profiles ?? []).map(profile => profile.id);
    if (enabledProfileIds.length === 0) return json({ sent: 0, configured });
    const { data: devices } = await adminClient
      .from('push_devices')
      .select('id, token, platform')
      .eq('family_id', task.family_id)
      .in('profile_id', enabledProfileIds)
      .in('platform', ['ios', 'android'])
      .eq('enabled', true);

    let sent = 0;
    let deliveryConfigured = false;
    const notificationPayload: TaskNotificationPayload = hasTaskId
      ? { taskId: referenceId, event }
      : { scheduleId: referenceId, event };
    for (const device of devices ?? []) {
      const result = device.platform === 'android'
        ? await sendFcm(
          device.token,
          title,
          message,
          notificationPayload,
        )
        : await sendApns(
        device.token,
        title,
        message,
        notificationPayload,
      );
      deliveryConfigured = deliveryConfigured || result.configured;
      if (result.status >= 200 && result.status < 300) sent += 1;
      if (result.invalidToken || result.status === 410) {
        await adminClient.from('push_devices').update({ enabled: false }).eq('id', device.id);
      }
    }
    return json({ sent, configured: configured || deliveryConfigured });
  } catch (error) {
    console.error('notify-task-created failed', error);
    return json({ error: 'Notification delivery failed' }, 500);
  }
});
