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
