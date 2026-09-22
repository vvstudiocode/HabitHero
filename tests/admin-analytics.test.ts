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
    ['dailyActivity', 'funnel', 'parentReviewFunnel', 'parentRewardFunnel', 'parentTaskFunnel', 'retention', 'sceneDwell', 'summary', 'tutorial'],
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

test('admin payload parses the parent task funnel in step order', () => {
  const payload = parseAdminAnalyticsPayload({
    summary: [],
    funnel: [],
    dailyActivity: [],
    retention: [],
    tutorial: [],
    sceneDwell: [],
    parentTaskFunnel: [
      { step_order: 3, step_key: 'parent_task_form_open', step_label: '按新增開表單', unique_users: 20, unique_families: 18, total_events: 25 },
      { step_order: 1, step_key: 'parent_panel_view', step_label: '進家長面板', unique_users: 100, unique_families: 90, total_events: 150 },
    ],
  });

  assert.deepEqual(payload.parentTaskFunnel.map((row) => row.step_key), ['parent_panel_view', 'parent_task_form_open']);
  assert.equal(payload.parentTaskFunnel[0]?.unique_users, 100);
  assert.equal(payload.parentTaskFunnel[1]?.total_events, 25);
});

test('admin payload parses the parent review and reward funnels in step order', () => {
  const payload = parseAdminAnalyticsPayload({
    summary: [],
    funnel: [],
    dailyActivity: [],
    retention: [],
    tutorial: [],
    sceneDwell: [],
    parentReviewFunnel: [
      { step_order: 2, step_key: 'parent_review_open', step_label: '開啟審核表單', unique_users: 30, unique_families: 28, total_events: 35 },
      { step_order: 1, step_key: 'parent_review_panel', step_label: '進審核頁', unique_users: 80, unique_families: 75, total_events: 120 },
    ],
    parentRewardFunnel: [
      { step_order: 2, step_key: 'parent_reward_add', step_label: '開啟新增獎勵', unique_users: 25, unique_families: 22, total_events: 30 },
      { step_order: 1, step_key: 'parent_rewards_panel', step_label: '進獎勵頁', unique_users: 70, unique_families: 65, total_events: 100 },
    ],
  });

  assert.deepEqual(payload.parentReviewFunnel.map((row) => row.step_key), ['parent_review_panel', 'parent_review_open']);
  assert.equal(payload.parentReviewFunnel[0]?.unique_users, 80);

  assert.deepEqual(payload.parentRewardFunnel.map((row) => row.step_key), ['parent_rewards_panel', 'parent_reward_add']);
  assert.equal(payload.parentRewardFunnel[0]?.unique_families, 65);
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
