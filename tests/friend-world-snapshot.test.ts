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

describe('friend world snapshot contract', () => {
  it('normalizes a server projection to public appearance and active world entities only', async () => {
    const { normalizeFriendWorldSnapshot } = await import('../src/features/friends/friend-world-snapshot');

    const snapshot = normalizeFriendWorldSnapshot({
      world_owner_child_profile_id: 'owner-child',
      display_name: ' 小明 ',
      character_asset_key: 'character.noah',
      revision: '7',
      entities: [
        {
          id: 'entity-pet',
          entity_kind: 'pet',
          asset_key: 'pet.murphy-bear',
          position_x: '1.25',
          position_y: 0,
          position_z: -1,
          rotation_x: 0,
          rotation_y: '0.5',
          rotation_z: 0,
          scale: '1.1',
          behavior_mode: 'idle',
          display_name: '熊熊',
          is_active: true,
          family_id: 'must-not-leak',
          quantity: 99,
        },
        {
          id: 'entity-inactive',
          entity_kind: 'decoration',
          asset_key: 'decoration.bed',
          position_x: 0,
          position_y: 0,
          position_z: 0,
          rotation_x: 0,
          rotation_y: 0,
          rotation_z: 0,
          scale: 1,
          behavior_mode: 'static',
          is_active: false,
        },
      ],
      points_balance: 9001,
      scroll_balance: 9001,
      private_task_id: 'must-not-leak',
    });

    assert.deepEqual(snapshot, {
      worldOwnerChildProfileId: 'owner-child',
      displayName: '小明',
      characterAssetKey: 'character.noah',
      revision: 7,
      entities: [{
        id: 'entity-pet',
        entityKind: 'pet',
        assetKey: 'pet.murphy-bear',
        x: 1.25,
        y: 0,
        z: -1,
        rotationX: 0,
        rotationY: 0.5,
        rotationZ: 0,
        scale: 1.1,
        behaviorMode: 'idle',
        displayName: '熊熊',
      }],
    });
  });

  it('reads the snapshot through the named RPC and never performs broad table reads', async () => {
    const { getFriendWorldSnapshot } = await import('../src/lib/social-data/friend-world-repository');
    const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc: async (functionName: string, args: Record<string, unknown>) => {
        calls.push({ functionName, args });
        return {
          data: {
            world_owner_child_profile_id: 'owner-child',
            display_name: '小明',
            character_asset_key: 'character.noah',
            revision: 1,
            entities: [],
          },
          error: null,
        };
      },
    };

    const snapshot = await getFriendWorldSnapshot(client as never, 'owner-child');

    assert.equal(snapshot.worldOwnerChildProfileId, 'owner-child');
    assert.deepEqual(calls, [{
      functionName: 'get_friend_world_snapshot',
      args: { target_child_profile_id: 'owner-child' },
    }]);
  });

  it('uses an authenticated, fixed-search-path RPC with an explicit safe projection', () => {
    const sql = readFriendWorldMigration();
    const snapshotFunction = sql.match(
      /create or replace function public\.get_friend_world_snapshot\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? '';

    assert.match(snapshotFunction, /returns jsonb/i);
    assert.match(snapshotFunction, /security definer/i);
    assert.match(snapshotFunction, /set search_path = pg_catalog, public, private/i);
    assert.match(snapshotFunction, /private\.can_visit_friend_world\(\(select auth\.uid\(\)\), target_child_profile_id\)/i);
    for (const key of ['world_owner_child_profile_id', 'display_name', 'character_asset_key', 'revision', 'entities', 'asset_key', 'position_x', 'position_z']) {
      assert.match(snapshotFunction, new RegExp(`['"]${key}['"]`, 'i'));
    }
    assert.doesNotMatch(snapshotFunction, /select\s+\*/i);
    assert.doesNotMatch(snapshotFunction, /to_jsonb\s*\(/i);
    assert.match(sql, /revoke all on function public\.get_friend_world_snapshot\(uuid\) from public, anon/i);
    assert.match(sql, /grant execute on function public\.get_friend_world_snapshot\(uuid\) to authenticated/i);
  });

  it('keeps the visitor authorization dependency explicit and rejects sensitive data projection', () => {
    const sql = readFriendWorldMigration();
    const snapshotFunction = sql.match(
      /create or replace function public\.get_friend_world_snapshot\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? '';
    const returnedProjection = snapshotFunction.match(
      /return jsonb_build_object\([\s\S]*?\n\s*\);/i,
    )?.[0] ?? '';

    assert.match(sql, /child_friendships/i);
    assert.match(sql, /child_friend_blocks/i);
    assert.match(returnedProjection, /world_owner_child_profile_id|display_name|character_asset_key|revision|entities/i);
    assert.doesNotMatch(returnedProjection, /points_balance|scroll_balance|quantity|task_id|family_id|parent_profile|parent_id|private_task|inventory_item_id/i);
  });
});
