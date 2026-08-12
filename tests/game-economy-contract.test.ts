import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const root = new URL('..', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

describe('game economy database contract', () => {
  it('keeps new public tables behind RLS and read-only grants', async () => {
    const schema = await read('supabase/migrations/20260810010550_game_economy_schema.sql');
    for (const table of [
      'game_catalog_items', 'family_game_item_prices', 'child_game_wallets',
      'game_item_purchases', 'game_currency_ledger', 'child_inventory_items',
      'child_game_loadouts', 'child_world_states', 'child_world_entities',
      'task_approval_corrections',
    ]) {
      assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`));
    }
    assert.match(schema, /revoke all on table public\.game_catalog_items[\s\S]*from public, anon, authenticated/);
    assert.match(schema, /grant select on table public\.game_catalog_items[\s\S]*to authenticated/);
    assert.match(schema, /unique index child_world_wandering_pet_slot_unique/);
    assert.doesNotMatch(schema, /unique \(child_profile_id, inventory_item_id\)/);
  });

  it('keeps purchase pricing and idempotency server-authoritative', async () => {
    const schema = await read('supabase/migrations/20260810010550_game_economy_schema.sql');
    const rpcs = await read('supabase/migrations/20260810010603_game_economy_rpcs.sql');
    assert.match(rpcs, /create or replace function public\.purchase_game_item\([\s\S]*purchase_idempotency_key uuid/);
    assert.match(rpcs, /select \* into wallet_row from public\.child_game_wallets[\s\S]*for update/);
    assert.match(rpcs, /select scroll_price into family_override/);
    assert.match(schema, /unique \(child_profile_id, idempotency_key\)/);
    assert.match(rpcs, /catalog_row\.is_starter/);
    assert.match(rpcs, /target_entity_id uuid default null/);
    assert.match(rpcs, /expected_revision is null or expected_revision <> world_state\.revision/);
  });

  it('covers reward issuance, correction, starter backfill, and RPC grants', async () => {
    const rpcs = await read('supabase/migrations/20260810010603_game_economy_rpcs.sql');
    const schema = await read('supabase/migrations/20260810010550_game_economy_schema.sql');
    const starter = await read('supabase/migrations/20260810010610_game_economy_starter.sql');
    assert.match(rpcs, /review_adventure_completion/);
    assert.match(schema, /game_currency_task_grant_unique/);
    assert.match(rpcs, /revoke_task_approval/);
    assert.match(rpcs, /grant execute on function public\.batch_review_daily_adventures/);
    assert.match(starter, /character\.anime-maiden/);
    assert.match(starter, /initialize_child_game_data/);
    assert.match(starter, /child_game_data_initializer/);
    assert.match(starter, /'character\.starlight-adventurer'/);
    assert.match(starter, /'星光冒險家'/);
  });

  it('replaces every legacy point-ledger check before adding reversal-safe rules', async () => {
    const schema = await read('supabase/migrations/20260810010550_game_economy_schema.sql');
    const legacyCheckCleanup = schema.indexOf("con.contype = 'c'");
    const newCheck = schema.indexOf('add constraint point_ledger_game_entry_check');

    assert.ok(legacyCheckCleanup >= 0, 'legacy point_ledger CHECK constraints must be discovered dynamically');
    assert.ok(newCheck > legacyCheckCleanup, 'replacement constraint must be added after legacy checks are removed');
    assert.match(schema, /rel\.relname = 'point_ledger'/);
    assert.match(schema, /point_ledger_points_delta_nonzero_check/);
    assert.match(schema, /entry_type = 'task_approval_reversal'[\s\S]*points_delta < 0[\s\S]*reversal_of_ledger_id is not null/);
    assert.match(schema, /entry_type = 'task_approved'[\s\S]*points_delta > 0[\s\S]*reversal_of_ledger_id is null/);
    assert.match(schema, /pg_get_constraintdef\(con\.oid\)[\s\S]*task_id/);
  });

  it('locks world state and advances revision when following_pet disables a wandering entity', async () => {
    const rpcs = await read('supabase/migrations/20260810010603_game_economy_rpcs.sql');
    const followingPet = rpcs.match(/create or replace function public\.set_following_pet[\s\S]*?\n\$\$;/)?.[0] ?? '';
    assert.match(followingPet, /world_state public\.child_world_states/);
    assert.match(followingPet, /select \* into world_state[\s\S]*from public\.child_world_states[\s\S]*for update/);
    assert.match(followingPet, /update public\.child_world_entities[\s\S]*behavior_mode = 'wander'/);
    assert.match(followingPet, /update public\.child_world_states[\s\S]*set revision = revision \+ 1/);
    assert.match(followingPet, /returns jsonb/);
    assert.match(followingPet, /return jsonb_build_object\('revision', world_state\.revision\)/);
    assert.doesNotMatch(followingPet, /returns public\.child_game_loadouts/);
    const roamingPets = rpcs.match(/create or replace function public\.set_roaming_pets[\s\S]*?\n\$\$;/)?.[0] ?? '';
    assert.match(roamingPets, /returns jsonb/);
    assert.match(roamingPets, /return jsonb_build_object\('revision', world_state\.revision\)/);
    assert.match(rpcs, /declare\n  v_family_id uuid;/);
    assert.doesNotMatch(rpcs, /declare\n  family_id uuid;[\s\S]*values \(family_id,/);
  });

  it('aliases unnest ordinality columns so roaming pets do not reference a missing value column', async () => {
    const rpcs = await read('supabase/migrations/20260810010603_game_economy_rpcs.sql');
    const roamingPets = rpcs.match(/create or replace function public\.set_roaming_pets[\s\S]*?\n\$\$;/)?.[0] ?? '';
    assert.match(roamingPets, /select roaming_item\.value, roaming_item\.ordinal::smallint[\s\S]*as roaming_item\(value, ordinal\)/);
    assert.doesNotMatch(roamingPets, /select value, ordinal::smallint/);
  });
});

describe('terrain world loading contract', () => {
  it('uses lazy Three.js loading and does not embed the prototype in an iframe', async () => {
    const child = await read('src/components/ChildDashboard.tsx');
    const world = await read('src/features/world/TerrainWorldLayer.tsx');
    const runtime = await read('src/features/world/prototype-world-runtime.ts');
    assert.match(child, /lazy\(\(\) => import\('\.\.\/features\/world\/TerrainWorldLayer'\)/);
    assert.match(runtime, /import\('three'\)/);
    assert.match(runtime, /disposeScene/);
    assert.match(runtime, /visibilitychange/);
    assert.match(world, /mountPrototypeWorld/);
    assert.doesNotMatch(world, /<iframe|https:\/\/unpkg|importmap/);
  });
});
