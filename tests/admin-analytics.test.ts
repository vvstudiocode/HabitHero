import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isCurrentAdminAnalyticsRequest,
  resolveAdminAnalyticsDisplayError,
} from '../src/features/admin-analytics/admin-analytics-helpers';
import { parseAdminAnalyticsPayload } from '../src/features/admin-analytics/admin-analytics-data';

test('admin payload keeps the RPC contract and leaves sessions_observed undefined for old payloads', () => {
  const payload = parseAdminAnalyticsPayload({
    summary: [{ child_profile_id: 'c1' }],
    funnel: [],
    dailyActivity: [{ activity_date: '2026-09-21', sessions_ended: 2 }],
    retention: [],
    tutorial: [],
    sceneDwell: [],
  });

  assert.equal(payload.summary[0]?.child_profile_id, 'c1');
  assert.equal(payload.summary[0]?.child_name, '未命名孩子');
  assert.equal(payload.dailyActivity[0]?.activity_date, '2026-09-21');
  assert.equal(payload.dailyActivity[0]?.sessions_observed, undefined);
  assert.deepEqual(
    Object.keys(payload).sort(),
    ['dailyActivity', 'funnel', 'retention', 'sceneDwell', 'summary', 'tutorial'],
  );
});

test('admin payload preserves the additive sessions_observed field when present', () => {
  const payload = parseAdminAnalyticsPayload({
    summary: [],
    funnel: [],
    dailyActivity: [{ activity_date: '2026-09-21', sessions_ended: 2, sessions_observed: 3 }],
    retention: [],
    tutorial: [],
    sceneDwell: [],
  });

  assert.equal(payload.dailyActivity[0]?.sessions_observed, 3);
});

test('load errors stay visible even when an older payload or session error exists', () => {
  assert.equal(resolveAdminAnalyticsDisplayError('重新整理失敗', null), '重新整理失敗');
  assert.equal(resolveAdminAnalyticsDisplayError('', '登入服務失敗'), '登入服務失敗');
  assert.equal(resolveAdminAnalyticsDisplayError('', null), '');
});

test('stale analytics responses never overwrite the screen after account or request changes', () => {
  assert.equal(isCurrentAdminAnalyticsRequest(3, 3, 'admin-a', 'admin-a'), true);
  assert.equal(isCurrentAdminAnalyticsRequest(2, 3, 'admin-a', 'admin-a'), false);
  assert.equal(isCurrentAdminAnalyticsRequest(3, 3, 'admin-a', 'admin-b'), false);
  assert.equal(isCurrentAdminAnalyticsRequest(3, 3, null, 'admin-a'), false);
});
