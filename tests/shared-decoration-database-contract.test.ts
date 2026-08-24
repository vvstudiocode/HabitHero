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

describe('shared decoration database contract', () => {
  it('defines ownership-safe schema without duplicating inventory metadata', () => {
    const sql = readSharedDecorationMigrations();

    assert.match(sql, /create table public\.child_world_decoration_collaborators\b/i);
    assert.match(sql, /create table public\.child_shared_world_decorations\b/i);
    assert.match(sql, /world_owner_child_profile_id\s+uuid\s+not null\s+references public\.child_profiles\(id\)\s+on delete cascade/i);
    assert.match(sql, /collaborator_child_profile_id\s+uuid\s+not null\s+references public\.child_profiles\(id\)\s+on delete cascade/i);
    assert.match(sql, /source_child_profile_id\s+uuid\s+not null\s+references public\.child_profiles\(id\)\s+on delete cascade/i);
    assert.match(sql, /source_inventory_item_id\s+uuid\s+not null\s+references public\.child_inventory_items\(id\)\s+on delete cascade/i);
    assert.match(sql, /check\s*\(\s*world_owner_child_profile_id\s*<>\s*collaborator_child_profile_id\s*\)/i);
    assert.match(sql, /check\s*\(\s*world_owner_child_profile_id\s*<>\s*source_child_profile_id\s*\)/i);
    assert.match(sql, /create unique index [^\n]+ on public\.child_shared_world_decorations\s*\(\s*world_owner_child_profile_id\s*,\s*source_inventory_item_id\s*\)[\s\S]*?where is_active/i);
    assert.match(sql, /removed_reason\s+text[\s\S]*?check\s*\(\s*removed_reason is null or removed_reason in\s*\(/i);
    assert.match(sql, /check\s*\(\s*\(is_active and removed_reason is null\)\s+or\s+\(not is_active and removed_reason is not null\)\s*\)/i);
    assert.doesNotMatch(sql, /asset_key\s+text[\s\s]*?child_shared_world_decorations/i);
    assert.doesNotMatch(sql, /insert\s+into\s+public\.child_inventory_items/i);
    assert.doesNotMatch(sql, /update\s+public\.child_inventory_items[\s\S]*?quantity/i);
  });

  it('exposes only typed security-definer RPCs with fixed actor derivation', () => {
    const sql = readSharedDecorationMigrations();
    const functionNames = [
      'set_friend_world_decoration_collaboration',
      'place_shared_world_decoration',
      'update_shared_world_decoration_transform',
      'remove_shared_world_decoration',
      'collect_shared_world_decorations',
      'get_friend_world_snapshot',
      'list_my_friends',
    ];

    for (const functionName of functionNames) {
      const functionSource = readFunction(sql, functionName);
      assert.match(functionSource, /security definer/i, functionName);
      assert.match(functionSource, /set search_path\s*=\s*pg_catalog, public, private/i, functionName);
      assert.match(functionSource, /auth\.uid\(\)/i, functionName);
      assert.doesNotMatch(functionSource, /jsonb\s*[,)]/i, `${functionName} must not accept an untyped JSON input`);
      assert.match(sql, new RegExp(`revoke all on function (?:public|private)\\.${functionName}`, 'i'));
      if (/^(set_friend|place_shared|update_shared|remove_shared|collect_shared)/.test(functionName)) {
        assert.match(sql, new RegExp(`grant execute on function public\\.${functionName}`, 'i'));
      }
    }
  });

  it('uses canonical transform validation and one owner revision per mutation', () => {
    const sql = readSharedDecorationMigrations();
    for (const functionName of [
      'place_shared_world_decoration',
      'update_shared_world_decoration_transform',
    ]) {
      const functionSource = readFunction(sql, functionName);
      assert.match(functionSource, /private\.validate_world_transform\(/i, functionName);
      assert.match(functionSource, /select \*?[^\n]*from public\.child_world_states[\s\S]*?for update/i, functionName);
      assert.match(functionSource, /expected_revision/i, functionName);
      assert.equal((functionSource.match(/set revision\s*=\s*revision\s*\+\s*1/gi) ?? []).length, 1, functionName);
    }

    for (const functionName of ['remove_shared_world_decoration', 'collect_shared_world_decorations']) {
      const functionSource = readFunction(sql, functionName);
      assert.match(functionSource, /expected_revision/i, functionName);
      assert.equal((functionSource.match(/set revision\s*=\s*revision\s*\+\s*1/gi) ?? []).length, 1, functionName);
    }

    assert.doesNotMatch(sql, /realtime\.send|realtime\.messages/i);
  });
});
