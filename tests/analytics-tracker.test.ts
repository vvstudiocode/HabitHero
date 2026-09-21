import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAnalyticsEvent, getAnalyticsSessionId } from '../src/lib/analytics';

test('analytics events have bounded, privacy-safe payloads', () => {
  const event = buildAnalyticsEvent('button_click', {
    control: '建立冒險',
    ignored: 'x'.repeat(200),
  }, {
    sessionId: '00000000-0000-0000-0000-000000000001',
    childProfileId: '00000000-0000-0000-0000-000000000002',
    platform: 'web',
  });

  assert.equal(event.event_name, 'button_click');
  assert.equal(event.session_id, '00000000-0000-0000-0000-000000000001');
  assert.equal(event.child_profile_id, '00000000-0000-0000-0000-000000000002');
  assert.equal(event.properties.control, '建立冒險');
  assert.equal(typeof event.properties.ignored, 'undefined');
});

test('analytics session ids persist through storage', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };

  const first = getAnalyticsSessionId(storage);
  const second = getAnalyticsSessionId(storage);
  assert.match(first, /^[0-9a-f-]{36}$/i);
  assert.equal(second, first);
});
