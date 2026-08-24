import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url);

function readCleanupMigration(): string {
  const names = readdirSync(migrationsDirectory)
    .filter((name) => /_shared_decoration_cleanup\.sql$/.test(name));
  assert.equal(names.length, 1, 'expected exactly one shared-decoration cleanup migration');
  return readFileSync(new URL(names[0], migrationsDirectory), 'utf8');
}

function readFunction(sql: string, functionName: string): string {
  const match = sql.match(new RegExp(
    `create or replace function public\\.${functionName}\\([\\s\\S]*?\\n\\$\\$;`,
    'i',
  ));
  assert.ok(match, `missing function ${functionName}`);
  return match[0];
}

describe('shared decoration lifecycle cleanup contract', () => {
  it('stops both directions of sharing when a friendship is removed or blocked', () => {
    const sql = readCleanupMigration();
    const removeFriend = readFunction(sql, 'remove_friend');
    const blockChild = readFunction(sql, 'block_child');

    assert.match(removeFriend, /deactivate_shared_world_decorations_between[\s\S]*friendship_removed/i);
    assert.match(removeFriend, /delete from public\.child_world_decoration_collaborators/i);
    assert.match(blockChild, /deactivate_shared_world_decorations_between[\s\S]*blocked/i);
    assert.match(blockChild, /delete from public\.child_world_decoration_collaborators/i);
    assert.match(sql, /update public\.child_shared_world_decorations[\s\S]*set[\s\S]*is_active\s*=\s*false/i);
    assert.match(sql, /removed_reason\s*=\s*target_reason/i);
    assert.doesNotMatch(sql, /delete from public\.child_inventory_items/i);
  });

  it('increments each affected target world once per cleanup helper call', () => {
    const sql = readCleanupMigration();
    const helper = sql.match(/create or replace function private\.deactivate_shared_world_decorations_between[\s\S]*?\n\$\$;/i)?.[0] ?? '';
    assert.match(helper, /select distinct[\s\S]*world_owner_child_profile_id/i);
    assert.match(helper, /for update/i);
    assert.equal((helper.match(/set revision\s*=\s*revision\s*\+\s*1/gi) ?? []).length, 1);
    assert.match(helper, /friendship_removed|blocked/i);
  });

  it('cleans source-owned shares before inventory or child-profile cascade deletes', () => {
    const sql = readCleanupMigration();
    assert.match(sql, /create or replace function private\.cleanup_shared_decorations_for_source/i);
    assert.match(sql, /create trigger [^\n]+ before delete on public\.child_inventory_items/i);
    assert.match(sql, /create trigger [^\n]+ before delete on public\.child_profiles/i);
    assert.match(sql, /source_unavailable/i);
    assert.match(sql, /references public\.child_inventory_items\(id\) on delete cascade/i);
    assert.match(sql, /world_owner_child_profile_id[\s\S]*child_world_states[\s\S]*revision/i);
  });

  it('keeps cleanup lock order compatible with mutation RPCs', () => {
    const sql = readCleanupMigration();
    const inventoryCleanup = sql.match(/create or replace function private\.deactivate_shared_world_decorations_for_inventory[\s\S]*?\n\$\$;/i)?.[0] ?? '';
    const catalogCleanup = sql.match(/create or replace function private\.cleanup_shared_decorations_for_catalog_item[\s\S]*?\n\$\$;/i)?.[0] ?? '';
    assert.ok(inventoryCleanup.indexOf('lock_shared_decoration_pair') < inventoryCleanup.indexOf('for update'));
    assert.ok(catalogCleanup.indexOf('lock_shared_decoration_pair') < catalogCleanup.indexOf('for update'));
  });
});
