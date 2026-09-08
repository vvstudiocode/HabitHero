import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('task notification sender supports creation, submission, and review events', () => {
  const source = read('../supabase/functions/notify-task-created/index.ts');

  assert.match(source, /type TaskNotificationEvent = 'created' \| 'submitted' \| 'reviewed'/);
  assert.match(source, /event === 'created' && origin === 'child_proposed'/);
  assert.match(source, /event === 'created' && origin === 'child_proposed'[\s\S]{0,300}child\.profile_id !== userData\.user\.id && !await isParent\(\)/);
  assert.match(source, /event === 'submitted'/);
  assert.equal(source.match(/title = '習慣冒險島'/g)?.length, 5);
  assert.match(source, /event === 'reviewed'/);
  assert.match(source, /body\.event/);
  assert.match(source, /body\.scheduleId/);
  assert.match(source, /data: JSON\.stringify\(payload\)/);
  assert.match(source, /const notificationPayload: TaskNotificationPayload/);
  assert.match(source, /daily adventure/);
});

test('APNs sender selects the Team ID for the active environment', () => {
  const source = read('../supabase/functions/notify-task-created/index.ts');

  assert.match(source, /APNS_SANDBOX_TEAM_ID/);
  assert.match(source, /APNS_PRODUCTION_TEAM_ID/);
  assert.match(source, /APNS_ENVIRONMENT/);
});

test('task completion paths invoke push notification events after successful mutations', () => {
  const store = read('../src/store.tsx');
  const adventureActions = read('../src/lib/adventure-store-actions.ts');

  assert.match(store, /notifyTaskEvent\(getSupabaseClient\(\), taskId, 'submitted'\)/);
  assert.match(store, /notifyTaskEvent\(getSupabaseClient\(\), taskId, 'reviewed'\)/);
  assert.match(adventureActions, /fireTaskNotification\(taskId, 'submitted'\)/);
  assert.match(adventureActions, /fireTaskNotification\(taskId, 'reviewed'\)/);
});

test('task notification requests carry an authenticated session header', () => {
  const source = read('../src/lib/push-notifications.ts');

  assert.match(source, /supabase\.auth\.getSession\(\)/);
  assert.match(source, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(source, /notifyAdventureCreated/);
});

test('notification defaults are enabled without overwriting an explicit opt-out', () => {
  const migration = read('../supabase/migrations/20260815080000_restore_default_push_notifications.sql');

  assert.match(migration, /alter table public\.profiles[\s\S]*alter column notifications_enabled set default true/i);
  assert.match(migration, /update public\.profiles[\s\S]*set notifications_enabled = true/i);
  assert.match(migration, /not exists \([\s\S]*from public\.push_devices/i);
  assert.match(migration, /where notifications_enabled = false/i);
});
