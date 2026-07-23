import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('parent consent migration stores versioned consent through a protected RPC', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260722172339_parent_consent_and_realtime.sql', import.meta.url), 'utf8');

  assert.match(sql, /create table if not exists public\.parent_consents/);
  assert.match(sql, /alter table public\.parent_consents enable row level security/);
  assert.match(sql, /create or replace function public\.record_parent_consent/);
  assert.match(sql, /on conflict \(family_id, parent_profile_id, consent_type\)/);
  assert.match(sql, /grant execute on function public\.record_parent_consent\(uuid, text\) to authenticated/);
});
