import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fillAdminDailyActivityCalendar,
  formatAdminDuration,
  getAdminCalendarDateKeys,
  getAdminObservedSessionCount,
  getLatestEligibleRetentionRow,
  getTaipeiDateKey,
  isAdminRetentionRowMature,
} from '../src/features/admin-analytics/admin-analytics-helpers';
import type { AdminDailyActivity, AdminRetentionRow } from '../src/features/admin-analytics/admin-analytics-data';

function daily(activity_date: string, overrides: Partial<AdminDailyActivity> = {}): AdminDailyActivity {
  return {
    activity_date,
    total_domain_events: 0,
    total_analytics_events: 0,
    active_users: 0,
    domain_active_children: 0,
    app_opens: 0,
    sessions_started: 0,
    sessions_ended: 0,
    session_seconds: 0,
    avg_session_seconds: 0,
    screen_views: 0,
    button_clicks: 0,
    tutorial_steps: 0,
    world_enters: 0,
    scene_enters: 0,
    scene_exits: 0,
    scene_dwell_seconds: 0,
    tasks_created: 0,
    tasks_submitted: 0,
    tasks_completed: 0,
    ...overrides,
  };
}

function retention(cohort_date: string, days_since_first_open: number, overrides: Partial<AdminRetentionRow> = {}): AdminRetentionRow {
  return {
    cohort_date,
    days_since_first_open,
    cohort_users: 10,
    retained_users: 5,
    retention_rate: 50,
    ...overrides,
  };
}

test('Taipei date keys follow the Taipei calendar boundary', () => {
  assert.equal(getTaipeiDateKey(new Date('2026-09-20T15:59:59.999Z')), '2026-09-20');
  assert.equal(getTaipeiDateKey(new Date('2026-09-20T16:00:00.000Z')), '2026-09-21');
});

test('calendar range fills missing dates instead of counting sparse rows', () => {
  const rows = fillAdminDailyActivityCalendar([
    daily('2026-09-19', { active_users: 2 }),
    daily('2026-09-21', { active_users: 4 }),
  ], 3, '2026-09-21');

  assert.deepEqual(rows.map((row) => row.activity_date), ['2026-09-19', '2026-09-20', '2026-09-21']);
  assert.deepEqual(rows.map((row) => row.active_users), [2, 0, 4]);
  assert.deepEqual(getAdminCalendarDateKeys(3, '2026-09-21'), ['2026-09-19', '2026-09-20', '2026-09-21']);
});

test('the latest Taipei calendar day is zero when it has no events', () => {
  const rows = fillAdminDailyActivityCalendar([daily('2026-09-20', { active_users: 7 })], 2, '2026-09-21');
  assert.equal(rows.at(-1)?.activity_date, '2026-09-21');
  assert.equal(rows.at(-1)?.active_users, 0);
});

test('D7 on the current calendar day is immature', () => {
  assert.equal(isAdminRetentionRowMature(retention('2026-09-14', 7), '2026-09-21'), false);
  assert.equal(isAdminRetentionRowMature(retention('2026-09-13', 7), '2026-09-21'), true);
});

test('latest eligible D7 cohort excludes newer ongoing cohorts', () => {
  const latest = getLatestEligibleRetentionRow([
    retention('2026-09-10', 7),
    retention('2026-09-13', 7, { retained_users: 6, retention_rate: 60 }),
    retention('2026-09-14', 7, { retained_users: 9, retention_rate: 90 }),
  ], 7, '2026-09-21');

  assert.equal(latest?.cohort_date, '2026-09-13');
  assert.equal(latest?.retention_rate, 60);
});

test('observed-session denominator uses the additive field when present and falls back only when absent', () => {
  assert.equal(getAdminObservedSessionCount([
    daily('2026-09-20', { sessions_ended: 4 }),
    daily('2026-09-21', { sessions_ended: 2 }),
  ]), 6);
  assert.equal(getAdminObservedSessionCount([
    daily('2026-09-20', { sessions_ended: 4, sessions_observed: 0 }),
    daily('2026-09-21', { sessions_ended: 2, sessions_observed: 3 }),
  ]), 3);
});

test('duration rounding carries seconds across the minute boundary', () => {
  assert.equal(formatAdminDuration(59.4), '59 秒');
  assert.equal(formatAdminDuration(59.6), '1 分');
  assert.equal(formatAdminDuration(119.6), '2 分');
  assert.equal(formatAdminDuration(3660), '1 小時 1 分');
});
