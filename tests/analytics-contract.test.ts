import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migrationPath = new URL('../supabase/migrations/20260921073211_analytics_readonly_views.sql', import.meta.url);
const appPath = new URL('../src/App.tsx', import.meta.url);
const vercelPath = new URL('../vercel.json', import.meta.url);

test('analytics migration stores authenticated events behind RPCs and RLS', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /create table if not exists public\.analytics_events/i);
  assert.match(migration, /alter table public\.analytics_events enable row level security/i);
  assert.match(migration, /create or replace function public\.record_analytics_events\(event_batch jsonb\)/i);
  assert.match(migration, /grant execute on function public\.record_analytics_events\(jsonb\) to authenticated/i);
  assert.match(migration, /revoke all on table public\.analytics_events from public, anon, authenticated/i);
  assert.match(migration, /f1272837411@gmail\.com/i);
  assert.match(migration, /create or replace function public\.get_admin_analytics\(\)/i);
  assert.match(migration, /create or replace view private\.analytics_retention/i);
  assert.match(migration, /app_open/i);
  assert.match(migration, /session_end/i);
  assert.match(migration, /scene_dwell/i);
});

test('parent task funnel migration exposes ordered steps through the admin RPC', async () => {
  const funnelMigration = await readFile(
    new URL('../supabase/migrations/20260922083608_add_parent_task_funnel.sql', import.meta.url),
    'utf8',
  );

  assert.match(funnelMigration, /create or replace view private\.analytics_parent_task_funnel/i);
  assert.match(funnelMigration, /parent-task-add/i);
  assert.match(funnelMigration, /parent-daily-adventure-add/i);
  assert.match(funnelMigration, /parent-general-adventure-add/i);
  assert.match(funnelMigration, /'parentTaskFunnel'/);
  assert.match(funnelMigration, /revoke all on private\.analytics_parent_task_funnel from public, anon, authenticated/i);
});

test('parent review and reward funnel migration exposes ordered steps through the admin RPC', async () => {
  const funnelMigration = await readFile(
    new URL('../supabase/migrations/20260922084502_add_parent_review_reward_funnels.sql', import.meta.url),
    'utf8',
  );

  assert.match(funnelMigration, /create or replace view private\.analytics_parent_review_funnel/i);
  assert.match(funnelMigration, /parent-review-open/i);
  assert.match(funnelMigration, /parent-review-approve/i);
  assert.match(funnelMigration, /parent-review-request/i);
  assert.match(funnelMigration, /parent-reward-add/i);
  assert.match(funnelMigration, /parent-reward-save/i);
  assert.match(funnelMigration, /parent-wishlist-approve/i);
  assert.match(funnelMigration, /'parentReviewFunnel'/);
  assert.match(funnelMigration, /'parentRewardFunnel'/);
  assert.match(funnelMigration, /revoke all on private\.analytics_parent_review_funnel from public, anon, authenticated/i);
  assert.match(funnelMigration, /revoke all on private\.analytics_parent_reward_funnel from public, anon, authenticated/i);
});

test('admin dashboard is available as a Vercel SPA route outside the family data provider', async () => {
  const app = await readFile(appPath, 'utf8');
  const vercel = JSON.parse(await readFile(vercelPath, 'utf8')) as { rewrites?: Array<{ destination?: string; source?: string }> };

  assert.match(app, /AdminAnalyticsDashboard/);
  assert.match(app, /admin\/analytics/);
  assert.ok(vercel.rewrites?.some((rewrite) => rewrite.destination === '/index.html'));
});
