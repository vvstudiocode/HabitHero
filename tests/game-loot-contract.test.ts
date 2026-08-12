import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260812100106_game_loot_drops.sql', import.meta.url),
  'utf8',
);
const starInstancesMigration = readFileSync(
  new URL('../supabase/migrations/20260812102002_game_loot_star_instances.sql', import.meta.url),
  'utf8',
);
const batchCollectionMigration = readFileSync(
  new URL('../supabase/migrations/20260812104722_game_loot_batch_collection.sql', import.meta.url),
  'utf8',
);
const batchCollectionFixMigration = readFileSync(
  new URL('../supabase/migrations/20260812104948_fix_game_loot_batch_uuid_aggregate.sql', import.meta.url),
  'utf8',
);
const scatterMigration = readFileSync(
  new URL('../supabase/migrations/20260812105915_scatter_game_loot_stars.sql', import.meta.url),
  'utf8',
);
const runtime = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/components/ChildDashboard.tsx', import.meta.url), 'utf8');
const dataAccess = readFileSync(new URL('../src/lib/data-access.ts', import.meta.url), 'utf8');

describe('game loot database contract', () => {
  it('persists available drops with RLS and stable task/kind uniqueness', () => {
    assert.match(migration, /create table if not exists public\.game_loot_drops/i);
    assert.match(migration, /unique \(source_task_id, drop_kind\)/i);
    assert.match(migration, /alter table public\.game_loot_drops enable row level security/i);
    assert.match(migration, /create policy .*game_loot_drops.*select/i);
    assert.match(migration, /status.*available.*claimed.*cancelled/i);
  });

  it('creates one persistent star and scroll per approved task without overwriting a drop', () => {
    assert.match(migration, /create or replace function private\.create_task_loot_drops/i);
    assert.match(migration, /on conflict \(source_task_id, drop_kind\) do nothing/i);
    assert.match(migration, /create_task_loot_drops\(target_task_id, points_to_award\)/i);
  });

  it('uses a locked, idempotent pickup RPC and records the claim instead of deleting the drop', () => {
    assert.match(migration, /create or replace function public\.collect_game_loot/i);
    assert.match(migration, /pickup_idempotency_key uuid/i);
    assert.match(migration, /for update/i);
    assert.match(migration, /status = 'claimed'/i);
    assert.match(migration, /idempotent_replay/i);
    assert.match(migration, /grant execute on function public\.collect_game_loot/i);
  });

  it('cancels unclaimed drops when an approved task is revoked', () => {
    assert.match(migration, /update public\.game_loot_drops[\s\S]*status = 'cancelled'/i);
    assert.match(migration, /create or replace function public\.revoke_task_approval/i);
  });

  it('keeps the world pickup path interactive, safe, and background-driven', () => {
    assert.match(runtime, /createLootDropObject/);
    assert.match(runtime, /requestLootPickup/);
    assert.match(runtime, /onLootAnimationRef\.current/);
    assert.match(runtime, /GAME_LOOT_STAR_VISUAL_SCALE/);
    assert.match(runtime, /GAME_LOOT_STAR_GLOW_RADIUS/);
    assert.doesNotMatch(runtime, /new THREE\.PointLight/);
    assert.doesNotMatch(runtime, /targetLootId/);
    assert.doesNotMatch(runtime, /const nearestLoot/);
    assert.match(dashboard, /onLootPickup=\{handleLootPickup\}/);
    assert.match(dashboard, /onLootAnimation=\{handleLootAnimation\}/);
    assert.match(dashboard, /target: 'points'/);
    assert.match(dashboard, /target: 'scroll'/);
    assert.match(dataAccess, /client\.rpc\('collect_game_loot'/);
  });

  it('represents every awarded point as its own one-point star drop', () => {
    assert.match(starInstancesMigration, /add column if not exists drop_index/i);
    assert.match(starInstancesMigration, /create unique index[\s\S]*on public\.game_loot_drops \(source_task_id, drop_kind, drop_index\)/i);
    assert.match(starInstancesMigration, /for star_index in 1\.\.points_to_award loop/i);
    assert.match(starInstancesMigration, /drop_kind, drop_index, amount/i);
    assert.match(starInstancesMigration, /'star', star_index, 1/i);
    assert.match(starInstancesMigration, /drop_index/i);
  });

  it('triggers pickup for the player character while keeping roaming pickup disabled', () => {
    assert.match(runtime, /isLootDropInPickupRange\(playerRoot\.position, drop, CHARACTER_COLLISION_RADIUS\)/);
    assert.match(runtime, /void requestLootPickupBatch\(touchCollectedDropIds\)/);
    assert.doesNotMatch(runtime, /roamingActor[\s\S]{0,1200}requestLootPickup/);
  });

  it('collects a batch with one server round trip and adds every one-point star', () => {
    assert.match(batchCollectionMigration, /create or replace function public\.collect_game_loot_batch/i);
    assert.match(batchCollectionMigration, /target_drop_ids uuid\[\]/i);
    assert.match(batchCollectionMigration, /points_delta = points_delta \+ task_group\.amount/i);
    assert.match(batchCollectionMigration, /update public\.point_ledger/i);
    assert.match(batchCollectionMigration, /return jsonb_build_object/i);
    assert.match(batchCollectionFixMigration, /array_agg\(drop\.family_id order by drop\.created_at, drop\.id\)/i);
    assert.doesNotMatch(batchCollectionFixMigration, /min\(drop\.family_id\)/i);
    assert.match(dataAccess, /collect_game_loot_batch/);
    assert.match(dashboard, /handleLootPickupBatch/);
    assert.match(runtime, /onLootPickupBatchRef/);
  });

  it('does not create one React animation state update per collected drop', () => {
    assert.match(dashboard, /setLootAnimations\(\(current\) => \[/);
    assert.match(dashboard, /handleLootAnimationBatch/);
    assert.match(runtime, /onLootAnimationBatchRef/);
  });

  it('scatters stars around a nearby center instead of placing them in a tight grid', () => {
    assert.match(scatterMigration, /cos\(/i);
    assert.match(scatterMigration, /sin\(/i);
    assert.match(scatterMigration, /0\.32.*1\.05|1\.05.*0\.32/i);
    assert.match(scatterMigration, /status = 'available'/i);
    assert.match(scatterMigration, /position_x[\s\S]*position_z/i);
  });
});
