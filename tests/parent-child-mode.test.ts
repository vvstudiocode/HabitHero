import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canOpenFamilyPicker, resolveActiveChildId } from '../src/lib/family-switch';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('family picker only opens after the parent family data is ready', () => {
  assert.equal(canOpenFamilyPicker({ role: 'child', dataReady: true, childCount: 2 }), false);
  assert.equal(canOpenFamilyPicker({ role: 'parent', dataReady: false, childCount: 2 }), false);
  assert.equal(canOpenFamilyPicker({ role: 'parent', dataReady: true, childCount: 0 }), false);
  assert.equal(canOpenFamilyPicker({ role: 'parent', dataReady: true, childCount: 2 }), true);
});

test('active child selection never falls back to a child outside the loaded family', () => {
  const children = [{ id: 'child-a' }, { id: 'child-b' }];
  assert.equal(resolveActiveChildId('child-b', children), 'child-b');
  assert.equal(resolveActiveChildId('missing-child', children), 'child-a');
  assert.equal(resolveActiveChildId(null, children), 'child-a');
  assert.equal(resolveActiveChildId('child-b', []), null);
});

test('parent refresh preserves the selected child when that child remains in the family', () => {
  const children = [{ id: 'child-a' }, { id: 'child-b' }];
  assert.equal(resolveActiveChildId('child-b', children), 'child-b');
});

test('parent child-mode migration keeps direct child ownership checks and adds parent-family checks', () => {
  const sql = read('../supabase/migrations/20260723160643_parent_child_mode_authorization.sql');

  assert.match(sql, /create or replace function public\.propose_child_goal/);
  assert.match(sql, /private\.is_family_parent\(target_family_id\)/);
  assert.match(sql, /private\.is_child_owner\(target_family_id, target_child_profile_id\)/);
  assert.match(sql, /create or replace function public\.submit_task_reflection/);
  assert.match(sql, /private\.is_family_parent\(task_row\.family_id\)/);
  assert.match(sql, /drop policy if exists wishlist_insert/);
  assert.match(sql, /private\.is_family_parent\(family_id\)/);
  assert.match(sql, /revoke all on function public\.propose_child_goal/);
  assert.match(sql, /grant execute on function public\.submit_task_reflection/);
});

test('latest child goal RPC keeps parent child-mode authorization after execution-time changes', () => {
  const sql = read('../supabase/migrations/20260729100000_parent_child_goal_authorization.sql');

  assert.match(sql, /create or replace function public\.propose_child_goal\(/);
  assert.match(sql, /private\.is_child_owner\(target_family_id, target_child_profile_id\)/);
  assert.match(sql, /private\.is_family_parent\(target_family_id\)/);
  assert.match(sql, /goal_end_time time/);
  assert.match(sql, /grant execute on function public\.propose_child_goal\(uuid, uuid, text, integer, text, text, integer, date, time, time\)/);
});

test('child-created general adventures can start immediately while completion still requires review', () => {
  const sql = read('../supabase/migrations/20260731104537_child_general_adventures_start_immediately.sql');

  assert.match(sql, /create or replace function private\.enforce_task_submission/);
  assert.match(sql, /new\.status <> 'todo'[\s\S]*new\.confirmed_at is null/);
  assert.match(sql, /create or replace function public\.propose_child_goal/);
  assert.match(sql, /'todo'[\s\S]*timezone\('utc', now\(\)\)[\s\S]*\(select auth\.uid\(\)\)/);
  assert.match(sql, /update public\.tasks as task[\s\S]*set status = 'todo'[\s\S]*confirmed_at = coalesce\(task\.confirmed_at, timezone\('utc', now\(\)\)\)/);
  assert.match(sql, /task\.origin = 'child_proposed'[\s\S]*task\.adventure_type = 'general'[\s\S]*task\.status = 'proposed'/);
  assert.doesNotMatch(sql, /approved_points\s*=/);
});

test('child goal durations enable the server timer and migrate existing timed goals', () => {
  const sql = read('../supabase/migrations/20260803073152_child_goal_duration_requires_timer.sql');

  assert.match(sql, /update public\.tasks[\s\S]*duration_minutes is not null[\s\S]*requires_timer/);
  assert.match(sql, /create or replace function public\.propose_child_goal\(/);
  assert.match(sql, /'quick',\s*goal_duration_minutes is not null,\s*'Asia\/Taipei'/);
});
