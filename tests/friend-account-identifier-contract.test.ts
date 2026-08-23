import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationsDirectory = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));

test('friend account identifiers prefer child login names and keep legacy codes resolvable', () => {
  const migrationName = readdirSync(migrationsDirectory).find((name) => /_friend_account_identifier\.sql$/.test(name));
  assert.ok(migrationName, 'account identifier migration must exist');
  const migration = readFileSync(`${migrationsDirectory}/${migrationName}`, 'utf8');

  assert.match(migration, /create or replace function public\.get_my_friend_code/i);
  assert.match(migration, /login_name/i);
  assert.match(migration, /create or replace function public\.send_friend_request/i);
  assert.match(migration, /child_profiles[\s\S]*login_name/i);
  assert.match(migration, /child_friend_codes/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /revoke all on function public\.(?:get_my_friend_code|send_friend_request)/i);
  assert.match(migration, /grant execute on function public\.(?:get_my_friend_code|send_friend_request)/i);
});

test('friend sheet offers account identifiers with a copy action', () => {
  const sheet = readFileSync(new URL('../src/features/friends/components/FriendListSheet.tsx', import.meta.url), 'utf8');
  assert.match(sheet, /好友帳號或代碼/);
  assert.match(sheet, /navigator\.clipboard/);
  assert.match(sheet, /複製/);
});
