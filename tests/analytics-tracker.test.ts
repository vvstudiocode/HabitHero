import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAnalyticsEvent,
  createAnalyticsTracker,
  getAnalyticsSessionId,
  getStaticAnalyticsControlId,
  type AnalyticsEventPayload,
  type AnalyticsStorage,
} from '../src/lib/analytics';

function createStorage(): AnalyticsStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

function createIdFactory() {
  let counter = 1;
  return () => `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;
}

function names(events: AnalyticsEventPayload[]) {
  return events.map((event) => event.event_name);
}

test('analytics events have bounded, privacy-safe payloads and actor binding', () => {
  const event = buildAnalyticsEvent('button_click', {
    control: '建立冒險',
    ignored: 'x'.repeat(200),
  }, {
    sessionId: '00000000-0000-0000-0000-000000000001',
    eventId: '00000000-0000-4000-8000-000000000002',
    actorProfileId: '00000000-0000-0000-0000-000000000003',
    childProfileId: '00000000-0000-0000-0000-000000000004',
    platform: 'web',
  });

  assert.equal(event.event_name, 'button_click');
  assert.equal(event.event_id, '00000000-0000-4000-8000-000000000002');
  assert.equal(event.actor_profile_id, '00000000-0000-0000-0000-000000000003');
  assert.equal(event.session_id, '00000000-0000-0000-0000-000000000001');
  assert.equal(event.child_profile_id, '00000000-0000-0000-0000-000000000004');
  assert.equal(event.properties.control, '建立冒險');
  assert.equal(typeof event.properties.ignored, 'undefined');
});

test('analytics session ids persist through storage', () => {
  const storage = createStorage();
  const first = getAnalyticsSessionId(storage);
  const second = getAnalyticsSessionId(storage);
  assert.match(first, /^[0-9a-f-]{36}$/i);
  assert.equal(second, first);
});

test('a screen requested before auth is emitted after session_start', async () => {
  const sent: AnalyticsEventPayload[][] = [];
  const tracker = createAnalyticsTracker({
    storage: createStorage(),
    sessionStorage: createStorage(),
    autoFlush: false,
    checkpointIntervalMs: 0,
    createId: createIdFactory(),
    transport: async (events) => { sent.push(events); },
  });

  tracker.screen('child:goals');
  tracker.configure({ userId: 'profile-a' });
  await tracker.flush();

  assert.deepEqual(names(sent.flat()), ['app_open', 'session_start', 'screen_view']);
  assert.equal(sent[0][2]?.screen_name, 'child:goals');
});

test('event ids remain stable when a batch is retried', async () => {
  const sent: AnalyticsEventPayload[][] = [];
  let attempts = 0;
  const tracker = createAnalyticsTracker({
    storage: createStorage(),
    sessionStorage: createStorage(),
    autoFlush: false,
    checkpointIntervalMs: 0,
    createId: createIdFactory(),
    transport: async (events) => {
      sent.push(events);
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
    },
  });

  tracker.configure({ userId: 'profile-a' });
  tracker.track('button_click', { control: 'child-open-inventory' });
  await tracker.flush();
  await tracker.flush();

  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0].map((event) => event.event_id), sent[1].map((event) => event.event_id));
  assert.ok(sent.every((batch) => batch.every((event) => event.actor_profile_id === 'profile-a')));
});

test('queued events never cross an account boundary', async () => {
  const sent: AnalyticsEventPayload[][] = [];
  const tracker = createAnalyticsTracker({
    storage: createStorage(),
    sessionStorage: createStorage(),
    autoFlush: false,
    checkpointIntervalMs: 0,
    createId: createIdFactory(),
    transport: async (events) => { sent.push(events); },
  });

  tracker.configure({ userId: 'profile-a' });
  tracker.track('button_click', { control: 'a-control' });
  tracker.configure({ userId: 'profile-b' });
  tracker.track('button_click', { control: 'b-control' });
  await tracker.flush();

  assert.ok(sent.length > 0);
  assert.ok(sent.every((batch) => batch.every((event) => event.actor_profile_id === 'profile-b')));
  assert.equal(sent.flat().some((event) => event.properties.control === 'a-control'), false);
});

test('foreground duration is cumulative across background and resume', async () => {
  let now = 0;
  const sent: AnalyticsEventPayload[][] = [];
  const tracker = createAnalyticsTracker({
    storage: createStorage(),
    sessionStorage: createStorage(),
    autoFlush: false,
    checkpointIntervalMs: 0,
    now: () => now,
    createId: createIdFactory(),
    transport: async (events) => { sent.push(events); },
  });

  tracker.configure({ userId: 'profile-a' });
  now = 15_000;
  tracker.checkpoint();
  now = 20_000;
  tracker.setForeground(false);
  now = 50_000;
  tracker.setForeground(true);
  now = 55_000;
  tracker.checkpoint();
  tracker.endSession();
  await tracker.flush();

  const events = sent.flat();
  const checkpoints = events
    .filter((event) => event.event_name === 'session_checkpoint')
    .map((event) => event.properties.duration_seconds);
  assert.deepEqual(checkpoints, [15, 20, 25]);
  assert.equal(events.filter((event) => event.event_name === 'session_end').at(-1)?.properties.duration_seconds, 25);
});

test('world dwell is flushed when the app enters background', async () => {
  let now = 0;
  const sent: AnalyticsEventPayload[][] = [];
  const tracker = createAnalyticsTracker({
    storage: createStorage(),
    sessionStorage: createStorage(),
    autoFlush: false,
    checkpointIntervalMs: 0,
    now: () => now,
    createId: createIdFactory(),
    transport: async (events) => { sent.push(events); },
  });

  tracker.configure({ userId: 'profile-a', childProfileId: 'child-a' });
  tracker.setWorldView({ key: 'own:sunrise-village', scene: 'sunrise-village', location: 'sunrise-village', visible: true });
  now = 12_000;
  tracker.setForeground(false);
  await tracker.flush();

  const dwell = sent.flat().find((event) => event.event_name === 'scene_dwell');
  assert.equal(dwell?.properties.scene, 'sunrise-village');
  assert.equal(dwell?.properties.duration_seconds, 12);
  assert.equal(dwell?.child_profile_id, 'child-a');
});

test('automatic clicks accept only explicit static control ids', () => {
  const node = (dataId: string | null, ariaLabel: string | null, text: string | null) => ({
    getAttribute: (name: string) => name === 'data-analytics-id' ? dataId : name === 'aria-label' ? ariaLabel : null,
    textContent: text,
  });

  assert.equal(getStaticAnalyticsControlId(node('child-open-inventory', '開啟背包', '背包')), 'child-open-inventory');
  assert.equal(getStaticAnalyticsControlId(node('parent-task-add', null, '新增')), 'parent-task-add');
  assert.equal(getStaticAnalyticsControlId(node('parent-daily-adventure-add', null, '每日冒險')), 'parent-daily-adventure-add');
  assert.equal(getStaticAnalyticsControlId(node('parent-general-adventure-add', null, '一般冒險')), 'parent-general-adventure-add');
  assert.equal(getStaticAnalyticsControlId(node('parent-review-open', null, '審核')), 'parent-review-open');
  assert.equal(getStaticAnalyticsControlId(node('parent-review-approve', null, '通過')), 'parent-review-approve');
  assert.equal(getStaticAnalyticsControlId(node('parent-review-request', null, '請補充')), 'parent-review-request');
  assert.equal(getStaticAnalyticsControlId(node('parent-reward-add', null, '新增')), 'parent-reward-add');
  assert.equal(getStaticAnalyticsControlId(node('parent-reward-save', null, '上架獎勵')), 'parent-reward-save');
  assert.equal(getStaticAnalyticsControlId(node('parent-wishlist-approve', null, '上架')), 'parent-wishlist-approve');
  assert.equal(getStaticAnalyticsControlId(node(null, '開啟背包', '背包')), null);
  assert.equal(getStaticAnalyticsControlId(node(null, null, '包含使用者名稱')), null);
  assert.equal(getStaticAnalyticsControlId(node('user-name', null, null)), null);
});
