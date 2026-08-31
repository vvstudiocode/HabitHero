import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const migrationsDirectory = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const migrationName = readdirSync(migrationsDirectory).find(name => /_friendship_domain\.sql$/.test(name));
const migration = migrationName
  ? readFileSync(`${migrationsDirectory}/${migrationName}`, 'utf8')
  : '';

describe('friendship database contract', () => {
  it('exposes a deliberate child-side removal action in the friend sheet', () => {
    const sheet = readFileSync(new URL('../src/features/friends/components/FriendListSheet.tsx', import.meta.url), 'utf8');

    assert.match(sheet, /onRemove/);
    assert.match(sheet, /確認刪除/);
  });

  it('keeps each friend, collaboration permission, and actions in one responsive row', () => {
    const sheet = readFileSync(new URL('../src/features/friends/components/FriendListSheet.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../src/styles/overlays.css', import.meta.url), 'utf8');

    assert.match(sheet, /hh-friend-list-row/);
    assert.match(sheet, /hh-friend-list-identity[\s\S]*?hh-friend-collaboration[\s\S]*?hh-friend-list-actions/);
    assert.match(styles, /\.hh-friend-list-row\s*\{[\s\S]*?flex-wrap:\s*nowrap/);
    assert.match(styles, /\.hh-friend-collaboration\s*\{[\s\S]*?white-space:\s*nowrap/);
    assert.match(styles, /@media \(max-width:\s*390px\)[\s\S]*?\.hh-friend-collaboration\s*\{[\s\S]*?font-size:\s*10px/);
  });

  it('defines the four friendship tables with server-owned identity fields', () => {
    for (const table of [
      'child_friend_codes',
      'child_friend_requests',
      'child_friendships',
      'child_friend_blocks',
    ]) {
      assert.match(migration, new RegExp(`create table public\\.${table}\\b`, 'i'));
      assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    }

    assert.match(migration, /code_normalized\s+text\s+not null/i);
    assert.match(migration, /gen_random_bytes\(16\)/i);
    assert.match(migration, /unique\s*\(\s*code_normalized\s*\)/i);
  });

  it('normalizes friendship endpoints and prevents self-relationships', () => {
    assert.match(migration, /child_low_profile_id\s+uuid\s+not null/i);
    assert.match(migration, /child_high_profile_id\s+uuid\s+not null/i);
    assert.match(migration, /check\s*\(\s*child_low_profile_id\s*<\s*child_high_profile_id\s*\)/i);
    assert.match(migration, /unique\s*\(\s*child_low_profile_id\s*,\s*child_high_profile_id\s*\)/i);
    assert.match(migration, /requester_child_profile_id\s+uuid\s+not null/i);
    assert.match(migration, /addressee_child_profile_id\s+uuid\s+not null/i);
    assert.match(migration, /check\s*\(\s*requester_child_profile_id\s*<>\s*addressee_child_profile_id\s*\)/i);
  });

  it('exposes only the friendship RPC surface and keeps security-definer paths fixed', () => {
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
      assert.match(migration, new RegExp(`create (?:or replace )?function public\\.${functionName}\\b`, 'i'));
      const functionSource = migration.slice(migration.toLowerCase().indexOf(`function public.${functionName}`));
      assert.match(functionSource, /security definer/i);
      assert.match(functionSource, /set search_path\s*=\s*extensions,\s*pg_catalog,\s*public/i);
      assert.match(functionSource, new RegExp(`revoke all on function public\\.${functionName}`, 'i'));
      assert.match(functionSource, new RegExp(`grant execute on function public\\.${functionName}`, 'i'));
    }
  });

  it('does not introduce durable rooms or player positions', () => {
    assert.doesNotMatch(migration, /world_rooms|room_members|last_player_positions|world_presence/i);
    assert.doesNotMatch(migration, /last_position_x|last_position_z|last_rotation/i);
  });
});
