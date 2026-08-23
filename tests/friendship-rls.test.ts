import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const migrationsDirectory = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const migrationName = readdirSync(migrationsDirectory).find(name => /_friendship_domain\.sql$/.test(name));
const migration = migrationName
  ? readFileSync(`${migrationsDirectory}/${migrationName}`, 'utf8')
  : '';

describe('friendship RLS and RPC contract', () => {
  it('limits direct reads to the child owner or an owning family parent', () => {
    for (const table of [
      'child_friend_codes',
      'child_friend_requests',
      'child_friendships',
      'child_friend_blocks',
    ]) {
      const tableSource = migration.slice(migration.toLowerCase().indexOf(`on public.${table}`));
      assert.match(tableSource, /private\.is_child_owner/i);
      assert.match(tableSource, /private\.is_family_parent/i);
      assert.match(tableSource, /for select to authenticated/i);
      assert.doesNotMatch(tableSource, new RegExp(`grant\\s+(?:insert|update|delete|all)\\s+on\\s+table\\s+public\\.${table}`, 'i'));
    }
  });

  it('uses generic mutation failures that do not reveal a non-friend target', () => {
    assert.match(migration, /friend request could not be created/i);
    assert.match(migration, /friend request could not be accepted/i);
    assert.match(migration, /friend request not found or not authorized/i);
    assert.match(migration, /friend not found or not authorized/i);
    assert.match(migration, /friend block could not be created/i);
    assert.doesNotMatch(migration, /friend code not found|target child exists|target child is online/i);
  });

  it('derives the actor from auth.uid instead of accepting a client actor id', () => {
    for (const functionName of [
      'get_my_friend_code',
      'list_my_friends',
      'list_my_friend_requests',
      'send_friend_request',
      'accept_friend_request',
      'decline_friend_request',
      'remove_friend',
      'block_child',
    ]) {
      const functionSource = migration.slice(migration.toLowerCase().indexOf(`function public.${functionName}`));
      assert.match(functionSource, /auth\.uid\(\)/i, `${functionName} must derive its actor from auth.uid()`);
    }
  });
});
