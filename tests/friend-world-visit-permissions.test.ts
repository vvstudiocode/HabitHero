import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const root = new URL('..', import.meta.url);

function readFriendWorldMigration(): string {
  const migrationDirectory = new URL('supabase/migrations/', root);
  const migrationNames = readdirSync(migrationDirectory)
    .filter((name) => /_friend_world_snapshot\.sql$/.test(name));
  assert.equal(migrationNames.length, 1, 'expected exactly one friend-world snapshot migration');
  return readFileSync(new URL(migrationNames[0], migrationDirectory), 'utf8');
}

function readFriendWorldLiveMigration(): string {
  const migrationDirectory = new URL('supabase/migrations/', root);
  const migrationNames = readdirSync(migrationDirectory)
    .filter((name) => /_friend_world_live_channel_authorization\.sql$/.test(name));
  assert.equal(migrationNames.length, 1, 'expected exactly one friend-world live channel migration');
  return readFileSync(new URL(migrationNames[0], migrationDirectory), 'utf8');
}

function readFriendWorldLiveRevisionMigration(): string {
  const migrationDirectory = new URL('supabase/migrations/', root);
  const migrationNames = readdirSync(migrationDirectory)
    .filter((name) => /_friend_world_live_revision_broadcast\.sql$/.test(name));
  assert.equal(migrationNames.length, 1, 'expected exactly one friend-world live revision migration');
  return readFileSync(new URL(migrationNames[0], migrationDirectory), 'utf8');
}

describe('friend world visit permission contract', () => {
  it('authorizes only the owner or an accepted, unblocked friendship', () => {
    const sql = readFriendWorldMigration();
    const canVisitFunction = sql.match(
      /create or replace function private\.can_visit_friend_world\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? '';

    assert.match(canVisitFunction, /requester_user_id\s+uuid/i);
    assert.match(canVisitFunction, /world_owner_child_profile_id\s+uuid/i);
    assert.match(canVisitFunction, /auth\.uid\(\)/i);
    assert.match(canVisitFunction, /requester_user_id/i);
    assert.match(canVisitFunction, /child_friendships/i);
    assert.match(canVisitFunction, /status\s*=\s*'accepted'/i);
    assert.match(canVisitFunction, /child_friend_blocks/i);
    assert.match(canVisitFunction, /blocked_child_profile_id/i);
    assert.match(canVisitFunction, /blocker_child_profile_id/i);
    for (const status of ['pending', 'declined', 'removed']) {
      assert.match(canVisitFunction, new RegExp(`status\\s*(?:not in|<>)[\\s\\S]{0,80}'${status}'`, 'i'));
    }
    assert.match(canVisitFunction, /security definer/i);
    assert.match(canVisitFunction, /set search_path = pg_catalog, public, private/i);
    assert.match(sql, /revoke all on function private\.can_visit_friend_world\(uuid, uuid\) from public, anon/i);
    assert.match(sql, /grant execute on function private\.can_visit_friend_world\(uuid, uuid\) to authenticated/i);
  });

  it('restricts every Broadcast and Presence operation to the private friend-world topic', () => {
    const sql = readFriendWorldMigration();
    const policies = [
      'friend_world_broadcast_select',
      'friend_world_broadcast_insert',
      'friend_world_presence_select',
      'friend_world_presence_insert',
    ];

    for (const policy of policies) {
      assert.match(sql, new RegExp(`create policy ${policy}[\\s\\S]*on realtime\\.messages`, 'i'));
      assert.match(sql, new RegExp(`create policy ${policy}[\\s\\S]*to authenticated`, 'i'));
      assert.match(sql, new RegExp(`create policy ${policy}[\\s\\S]*realtime\\.topic\\(\\)`, 'i'));
      assert.match(sql, new RegExp(`create policy ${policy}[\\s\\S]*private\\.can_visit_friend_world`, 'i'));
    }

    const broadcastPolicies = sql.match(/extension\s*=\s*'broadcast'/gi) ?? [];
    const presencePolicies = sql.match(/extension\s*=\s*'presence'/gi) ?? [];
    assert.ok(broadcastPolicies.length >= 2, 'Broadcast SELECT and INSERT must each constrain extension');
    assert.ok(presencePolicies.length >= 2, 'Presence SELECT and INSERT must each constrain extension');
    assert.match(sql, /friend-world:/i);
    assert.match(sql, /split_part\s*\(\s*realtime\.topic\(\)/i);
    assert.doesNotMatch(sql, /create policy[\s\S]*on realtime\.(?:channels|subscriptions)/i);
    assert.doesNotMatch(sql, /(?:^|[.\s])(?:world_rooms|room_members|last_player_positions|world_presence)(?:$|[.\s])/im);
    assert.match(sql, /private\s*:\s*true/i);
  });

  it('does not create realtime schema objects or a public fallback policy', () => {
    const sql = readFriendWorldMigration();
    assert.doesNotMatch(sql, /create\s+(?:table|view|function)\s+realtime\./i);
    assert.doesNotMatch(sql, /to\s+anon/i);
    assert.doesNotMatch(sql, /create policy\s+[^\n]+public/i);
    assert.match(sql, /on realtime\.messages/i);
  });

  it('authorizes the dedicated live channel for avatar Presence and Broadcast', () => {
    const sql = readFriendWorldLiveMigration();
    for (const policy of [
      'friend_world_live_broadcast_select',
      'friend_world_live_broadcast_insert',
      'friend_world_live_presence_select',
      'friend_world_live_presence_insert',
    ]) {
      assert.match(sql, new RegExp(`create policy ${policy}[\\s\\S]*on realtime\\.messages`, 'i'));
      assert.match(sql, new RegExp(`create policy ${policy}[\\s\\S]*to authenticated`, 'i'));
      assert.match(sql, new RegExp(`create policy ${policy}[\\s\\S]*friend-world-live:`, 'i'));
      assert.match(sql, new RegExp(`create policy ${policy}[\\s\\S]*private\\.can_visit_friend_world`, 'i'));
    }
    assert.doesNotMatch(sql, /to\s+anon/i);
    assert.doesNotMatch(sql, /public\s*:\s*true/i);
  });

  it('keeps world revision hints on both the legacy and live topics', () => {
    const sql = readFriendWorldLiveRevisionMigration();
    assert.match(sql, /create or replace function private\.broadcast_friend_world_revision/i);
    assert.equal((sql.match(/'world_revision_v1'/g) ?? []).length, 2);
    assert.match(sql, /'friend-world:'\s*\|\|\s*new\.child_profile_id/i);
    assert.match(sql, /'friend-world-live:'\s*\|\|\s*new\.child_profile_id/i);
    assert.match(sql, /revoke all on function private\.broadcast_friend_world_revision\(\)/i);
  });
});
