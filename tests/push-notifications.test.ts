import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getNotificationPermissionLabel,
  getNotificationRecipientRole,
  hasEnabledPushDevice,
  shouldRegisterPushNotifications,
} from '../src/lib/notification-preferences';
import { notifyTaskEvent, setNotificationPreference } from '../src/lib/push-notifications';

test('push registration only starts when the user enabled notifications and permission is granted', () => {
  assert.equal(shouldRegisterPushNotifications({ enabled: true, permission: 'granted', platform: 'ios' }), true);
  assert.equal(shouldRegisterPushNotifications({ enabled: false, permission: 'granted', platform: 'ios' }), false);
  assert.equal(shouldRegisterPushNotifications({ enabled: true, permission: 'denied', platform: 'ios' }), false);
  assert.equal(shouldRegisterPushNotifications({ enabled: true, permission: 'granted', platform: 'web' }), false);
});

test('notification permission labels explain the actionable iOS states', () => {
  assert.equal(getNotificationPermissionLabel('granted'), '已允許通知');
  assert.equal(getNotificationPermissionLabel('denied'), '通知已被關閉，請到系統設定開啟');
  assert.equal(getNotificationPermissionLabel('prompt'), '尚未決定');
});

test('task origin maps to the intended notification recipient', () => {
  assert.equal(getNotificationRecipientRole('parent_assigned'), 'child');
  assert.equal(getNotificationRecipientRole('system_template'), 'child');
  assert.equal(getNotificationRecipientRole('child_proposed'), 'parent');
});

test('notification preference is enabled when at least one device is active', () => {
  assert.equal(hasEnabledPushDevice([{ enabled: true }]), true);
  assert.equal(hasEnabledPushDevice([{ enabled: false }, { enabled: true }]), true);
  assert.equal(hasEnabledPushDevice([{ enabled: false }]), false);
  assert.equal(hasEnabledPushDevice([]), false);
});

test('notification preference syncs the profile flag used by the sender', async () => {
  const calls: Array<{ table: string; values: unknown; id: string }> = [];
  const client = {
    from(table: string) {
      return {
        update(values: unknown) {
          return {
            eq(_column: string, id: string) {
              calls.push({ table, values, id });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  await setNotificationPreference(client as never, 'profile-1', true);
  await setNotificationPreference(client as never, 'profile-1', false);

  assert.deepEqual(calls, [
    { table: 'profiles', values: { notifications_enabled: true }, id: 'profile-1' },
    { table: 'profiles', values: { notifications_enabled: false }, id: 'profile-1' },
    { table: 'push_devices', values: { enabled: false }, id: 'profile-1' },
  ]);
});

test('task notification sends the current session token to the Edge Function', async () => {
  let invocation: { name: string; options: { body: unknown; headers: Record<string, string> } } | null = null;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'session-token' } }, error: null }),
    },
    functions: {
      invoke: async (name: string, options: { body: unknown; headers: Record<string, string> }) => {
        invocation = { name, options };
        return { error: null };
      },
    },
  };

  await notifyTaskEvent(client as never, 'task-1', 'submitted');

  assert.deepEqual(invocation, {
    name: 'notify-task-created',
    options: {
      body: { taskId: 'task-1', event: 'submitted' },
      headers: { Authorization: 'Bearer session-token' },
    },
  });
});

test('task notification does not invoke an Edge Function without a session', async () => {
  let invoked = false;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    functions: {
      invoke: async () => {
        invoked = true;
        return { error: null };
      },
    },
  };

  await assert.rejects(() => notifyTaskEvent(client as never, 'task-1', 'submitted'), /登入狀態已失效/);
  assert.equal(invoked, false);
});
