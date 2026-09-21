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

test('admin dashboard is available as a Vercel SPA route outside the family data provider', async () => {
  const app = await readFile(appPath, 'utf8');
  const vercel = JSON.parse(await readFile(vercelPath, 'utf8')) as { rewrites?: Array<{ destination?: string; source?: string }> };

  assert.match(app, /AdminAnalyticsDashboard/);
  assert.match(app, /admin\/analytics/);
  assert.ok(vercel.rewrites?.some((rewrite) => rewrite.destination === '/index.html'));
});
