import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url);

function readSharedDecorationMigrations(): string {
  const names = readdirSync(migrationsDirectory)
    .filter((name) => /_shared_decoration_(schema|rpcs|cleanup)\.sql$/.test(name))
    .sort();
  assert.equal(names.length, 3, 'expected schema, RPC, and cleanup shared-decoration migrations');
  return names.map((name) => readFileSync(new URL(name, migrationsDirectory), 'utf8')).join('\n');
}

function readFunction(sql: string, functionName: string): string {
  const match = sql.match(new RegExp(
    `create or replace function (?:public|private)\\.${functionName}\\([\\s\\S]*?\\n\\$\\$;`,
    'i',
  ));
  assert.ok(match, `missing function ${functionName}`);
  return match[0];
}

describe('shared decoration RLS and privacy contract', () => {
  it('enables RLS and denies direct client table writes', () => {
    const sql = readSharedDecorationMigrations();

    for (const table of ['child_world_decoration_collaborators', 'child_shared_world_decorations']) {
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
      assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'i'));
      assert.doesNotMatch(sql, new RegExp(`grant\\s+(?:insert|update|delete|all)\\s+on table public\\.${table}`, 'i'));
    }
  });

  it('rechecks accepted and unblocked friendship in permission and mutation paths', () => {
    const sql = readSharedDecorationMigrations();
    for (const functionName of [
      'set_friend_world_decoration_collaboration',
      'place_shared_world_decoration',
      'update_shared_world_decoration_transform',
    ]) {
      const functionSource = readFunction(sql, functionName);
      assert.match(functionSource, /are_accepted_unblocked_friends/i, functionName);
      assert.match(functionSource, /can_collaborate/i, functionName);
    }
    assert.match(sql, /status\s*=\s*'accepted'/i);
    assert.match(sql, /child_friend_blocks/i);
  });

  it('keeps snapshot output safe for a third visitor', () => {
    const sql = readSharedDecorationMigrations();
    const snapshot = readFunction(sql, 'get_friend_world_snapshot');
    const entityObject = snapshot.match(/jsonb_build_object\(\s*'id'[\s\S]*?\)\s+order by/i)?.[0] ?? '';

    for (const key of [
      'placement_scope',
      'can_transform',
      'can_remove',
      'shared_by_me',
      'shared_source_display_name',
    ]) {
      assert.match(entityObject, new RegExp(`['"]${key}['"]`, 'i'), key);
    }
    assert.match(snapshot, /can_share_decorations/i);
    assert.match(snapshot, /child_shared_world_decorations/i);
    assert.match(snapshot, /catalog\.item_type\s*=\s*'decoration'/i);
    assert.match(snapshot, /catalog\.is_active/i);
    assert.match(snapshot, /inventory\.quantity\s*>\s*0/i);
    assert.doesNotMatch(entityObject, /source_child_profile_id|source_inventory_item_id|inventory_item_id|quantity|family_id|points_balance|scroll_balance/i);
    assert.match(snapshot, /case\s+when[\s\S]*shared_source_display_name[\s\S]*then[\s\S]*source\.display_name/i);
  });

  it('projects the owner grant in list_my_friends without extra per-friend reads', () => {
    const sql = readSharedDecorationMigrations();
    const friends = readFunction(sql, 'list_my_friends');

    assert.match(friends, /can_collaborate_in_my_world/i);
    assert.match(friends, /child_world_decoration_collaborators/i);
    assert.match(friends, /coalesce\s*\([\s\S]*can_collaborate/i);
    assert.match(friends, /child_friendships[\s\S]*status\s*=\s*'accepted'/i);
    assert.match(friends, /child_friend_blocks/i);
  });
});
