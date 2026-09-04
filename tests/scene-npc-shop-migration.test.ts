import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const migrationFile = '20260902191718_scene_npc_shop.sql';
const migrationDirectory = new URL('../supabase/migrations/', import.meta.url);
const migration = readFileSync(new URL(migrationFile, migrationDirectory), 'utf8');

function countMatches(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

function requiredSection(pattern: RegExp): string {
  const section = migration.match(pattern)?.[1];
  assert.ok(section, `expected migration section: ${pattern}`);
  return section;
}

test('scene NPC work has exactly one bounded migration owner', () => {
  assert.deepEqual(
    readdirSync(migrationDirectory).filter((name) => /_scene_npc_shop\.sql$/.test(name)),
    [migrationFile],
  );
  assert.ok(migration.trim().length > 0);
  assert.match(migration, /begin;[\s\S]*commit;/i);
});

test('migration creates the child-scoped scene, NPC, offering, and progress schema', () => {
  for (const table of [
    'game_world_scenes',
    'game_world_npcs',
    'game_world_npc_offerings',
    'child_world_scene_unlocks',
    'child_world_npc_dialogue_progress',
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}\\b`, 'i'));
  }
  assert.match(migration, /npc_type text not null[\s\S]*npc_type = 'roaming_pet'[\s\S]*behavior_mode = 'roaming'/i);
  assert.match(migration, /npc_type = 'character_vendor'[\s\S]*behavior_mode = 'dance_anchor'/i);
  assert.match(migration, /foreign key \(family_id, child_profile_id\)[\s\S]*references public\.child_profiles\(family_id, id\)/i);
  assert.match(migration, /primary key \(child_profile_id, scene_id\)/i);
  assert.match(migration, /primary key \(child_profile_id, npc_id\)/i);
  assert.match(migration, /add column if not exists is_child_creation_selectable boolean not null default false/i);
  assert.match(migration, /add column if not exists is_newly_obtainable boolean not null default true/i);
  assert.match(migration, /alter table public\.child_profiles[\s\S]*alter column character_id set default 'character\.arthur'/i);
  for (const table of ['game_item_purchases', 'child_inventory_items']) {
    const tableSection = requiredSection(new RegExp(`alter table public\\.${table}([\\s\\S]*?)(?=\\n\\n(?:create|alter|update|insert|drop|do|--|commit))`, 'i'));
    assert.match(tableSection, /source_scene_id text[\s\S]*source_npc_id text[\s\S]*source_dialogue_version integer/i);
  }
  assert.match(migration, /source_scene_id is null.*source_npc_id is null/i);
  assert.match(migration, /npc\.scene_id = (?:new\.)?source_scene_id/i);
});

test('migration seeds the canonical scene and NPC cardinalities', () => {
  const scenes = requiredSection(/insert into public\.game_world_scenes[\s\S]*?values([\s\S]*?)\)\s*on conflict/i);
  for (const sceneId of [
    'sunrise-village',
    'forest-valley',
    'cloud-workshop',
    'tideglow-archipelago',
    'star-sand-wasteland',
  ]) assert.match(scenes, new RegExp(`'${sceneId}'`));

  const vendors = requiredSection(/from \(values([\s\S]*?)\) as seed\(id, scene_id, name, asset_key/i);
  assert.equal(countMatches(vendors, /\('npc\./g), 6);
  const roaming = requiredSection(/with roaming\(npc_id, scene_id, asset_key, x, z\) as \(values([\s\S]*?)\)\s*insert into public\.game_world_npcs/i);
  assert.equal(countMatches(roaming, /\('npc\./g), 9);
  assert.match(migration, /join public\.game_catalog_items item[\s\S]*item\.item_type = 'pet'/i);
  assert.ok(
    migration.indexOf('with roaming(npc_id, scene_id, asset_key, x, z)')
      < migration.indexOf("raise exception 'scene NPC seed cardinality is invalid'"),
    'the cardinality guard must run after roaming NPCs are seeded',
  );
});

test('migration seeds 27 primary and 9 direct NPC offerings', () => {
  const primary = requiredSection(/with offering\(npc_id, asset_key, sort_order\) as \(values([\s\S]*?)\)\s*insert into public\.game_world_npc_offerings/i);
  assert.equal(countMatches(primary, /\('npc\./g), 27);
  const direct = requiredSection(/insert into public\.game_world_npc_offerings\n  \(npc_id, catalog_item_id, sort_order, dialogue_version, is_primary_source\)([\s\S]*?)(?=\n\n-- Existing children)/i);
  assert.match(direct, /npc\.npc_type = 'roaming_pet'/i);
  assert.match(direct, /select npc\.id, npc\.catalog_item_id, 1, 1, false/i);
  assert.match(direct, /on conflict \(npc_id, catalog_item_id\) do update/i);
  assert.match(migration, /scene NPC offering seed cardinality is invalid/i);
  assert.ok(
    migration.indexOf("raise exception 'scene NPC offering seed cardinality is invalid'")
      > migration.indexOf('is_primary_source = false'),
    'the offering cardinality guard must run after both offering seeds',
  );
});

test('migration applies legacy and child-creation flags without deleting compatibility data', () => {
  for (const characterId of ['character.arthur', 'character.elina', 'character.sia', 'character.elio']) {
    assert.match(migration, new RegExp(`'${characterId}'`));
  }
  for (const petId of [
    'pet.forest-guardian',
    'pet.starlight-sprout',
    'pet.chrono-rabbit',
    'pet.silf-owl',
    'pet.yaoguang-deer',
    'pet.murphy-bear',
    'pet.magellan-rabbit',
    'pet.buleifu-tiger',
    'pet.belilos-fox',
    'pet.baruku-mushroom',
    'pet.star-diver',
  ]) assert.match(migration, new RegExp(`'${petId}'`));
  assert.match(migration, /set is_newly_obtainable = false[\s\S]*where item_type = 'pet'/i);
  assert.doesNotMatch(migration, /set is_active\s*=\s*false/i);
  assert.doesNotMatch(migration, /delete from public\.(game_catalog_items|child_inventory_items|game_item_purchases)/i);
  assert.match(migration, /before insert on public\.child_profiles/i);
  assert.doesNotMatch(migration, /before insert or update on public\.child_profiles/i);
  assert.match(migration, /item\.is_child_creation_selectable/i);
  assert.doesNotMatch(migration, /drop trigger if exists child_profile_identity_guard/i);
  assert.doesNotMatch(migration, /create (?:or replace )?function private\.enforce_child_identity_immutable/i);
});

test('migration exposes read-only RLS and security-definer RPC boundaries', () => {
  for (const table of [
    'game_world_scenes',
    'game_world_npcs',
    'game_world_npc_offerings',
    'child_world_scene_unlocks',
    'child_world_npc_dialogue_progress',
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(migration, /revoke all on table[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant select on table[\s\S]*to authenticated/i);
  for (const policy of migration.match(/create policy[\s\S]*?;/gi) ?? []) {
    assert.doesNotMatch(policy, /\bfor (insert|update|delete)\b/i);
  }
  for (const rpc of ['unlock_world_scene_if_eligible', 'complete_world_npc_dialogue', 'purchase_game_item']) {
    const functionSection = requiredSection(new RegExp(`create (?:or replace )?function public\\.${rpc}\\b([\\s\\S]*?)(?=\\n(?:create|revoke|grant|commit))`, 'i'));
    assert.match(functionSection, /security definer/i);
    assert.match(functionSection, /set search_path = pg_catalog, public, private/i);
    assert.match(functionSection, /private\.resolve_game_child/i);
  }
});

test('unlock and dialogue RPCs are server-authoritative and permanently child-scoped', () => {
  const unlock = requiredSection(/create (?:or replace )?function public\.unlock_world_scene_if_eligible\b([\s\S]*?)(?=\ncreate|\nrevoke)/i);
  assert.match(unlock, /task\.status = 'completed'/i);
  assert.match(unlock, /task\.adventure_type = 'general'/i);
  assert.match(unlock, /on conflict \(child_profile_id, scene_id\) do nothing/i);
  assert.match(unlock, /child_row\.family_id/i);
  const dialogue = requiredSection(/create (?:or replace )?function public\.complete_world_npc_dialogue\b([\s\S]*?)(?=\n-- Replace|\nrevoke)/i);
  assert.match(dialogue, /child_world_scene_unlocks/i);
  assert.match(dialogue, /npc\.is_active[\s\S]*scene\.is_active/i);
  assert.match(dialogue, /item\.is_newly_obtainable/i);
  assert.match(dialogue, /jsonb_agg/i);
});

test('purchase RPC replaces the unsafe four-argument overload and preserves transaction behavior', () => {
  assert.match(migration, /drop function if exists public\.purchase_game_item\(uuid, integer, uuid, uuid\);/i);
  assert.match(migration, /create (?:or replace )?function public\.purchase_game_item\([\s\S]*target_source_npc_id text default null/i);
  assert.doesNotMatch(migration, /create (?:or replace )?function public\.purchase_game_item\(\s*target_catalog_item_id uuid,\s*target_quantity integer,\s*purchase_idempotency_key uuid,\s*target_child_profile_id uuid default null\s*\)/i);
  assert.doesNotMatch(migration, /grant execute on function public\.purchase_game_item\(uuid, integer, uuid, uuid\)/i);
  const purchase = requiredSection(/create (?:or replace )?function public\.purchase_game_item\b([\s\S]*?)(?=\nrevoke all on function private)/i);
  for (const contract of [
    /not catalog_row\.is_newly_obtainable/i,
    /NPC does not offer this item/i,
    /scene is locked for this child/i,
    /NPC dialogue is incomplete/i,
    /game_currency_ledger/i,
    /game_item_purchases/i,
    /child_inventory_items/i,
    /source_scene_id/i,
    /source_dialogue_version/i,
    /idempotent_replay/i,
  ]) assert.match(purchase, contract);
  assert.match(purchase, /target_source_npc_id is null[\s\S]*source NPC is required for this item/i);
  assert.match(purchase, /purchase_row\.catalog_item_id <> target_catalog_item_id/i);
  assert.match(purchase, /source_npc_id is distinct from target_source_npc_id/i);
  assert.match(purchase, /source_scene_id.*inventory_row\.source_scene_id/i);
  assert.match(migration, /revoke all on function public\.purchase_game_item\(uuid, integer, uuid, uuid, text\)/i);
  assert.match(migration, /grant execute on function public\.purchase_game_item\(uuid, integer, uuid, uuid, text\)/i);
});
