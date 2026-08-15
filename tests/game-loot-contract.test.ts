import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const removalMigrationPath = '../supabase/migrations/20260812200000_remove_game_loot_drops.sql';
const runtime = read('../src/features/world/prototype-world-runtime.ts');
const dashboard = read('../src/components/ChildDashboard.tsx');
const dataAccess = read('../src/lib/data-access.ts');
const gameData = read('../src/features/world/game-data.ts');
const contracts = read('../src/features/world/contracts.ts');
const realtime = read('../src/lib/realtime.ts');
const store = read('../src/store.tsx');

describe('game loot removal contract', () => {
  it('cancels legacy available drops and stops creating new drop rows', () => {
    assert.equal(existsSync(new URL(removalMigrationPath, import.meta.url)), true);
    const migration = read(removalMigrationPath);
    assert.match(migration, /update public\.game_loot_drops[\s\S]*status = 'cancelled'[\s\S]*status = 'available'/i);
    assert.match(migration, /create or replace function private\.create_task_loot_drops/i);
    assert.match(migration, /return;[\s\S]*no-op/i);
  });

  it('does not expose pickup RPCs or subscribe to the legacy loot table', () => {
    assert.doesNotMatch(dataAccess, /collect_game_loot/);
    assert.doesNotMatch(store, /collectGameLoot/);
    assert.doesNotMatch(realtime, /game_loot_drops/);
    assert.doesNotMatch(gameData, /game_loot_drops|lootDrops|LootDrop/);
  });

  it('does not load, render, animate, or pick up stars and scrolls in the world', () => {
    assert.doesNotMatch(runtime, /loot|Loot|Raycaster/);
    assert.doesNotMatch(dashboard, /loot|Loot|onLoot/);
    assert.doesNotMatch(contracts, /GameLoot|lootDrops/);
    assert.equal(existsSync(new URL('../src/features/world/game-loot.ts', import.meta.url)), false);
  });

  it('keeps task approval rewards as direct point and quest-scroll ledger updates', () => {
    const migration = read(removalMigrationPath);
    assert.match(migration, /insert into public\.point_ledger/i);
    assert.match(migration, /update public\.child_profiles set points_balance/i);
    assert.match(migration, /insert into public\.game_currency_ledger/i);
    assert.match(migration, /update public\.child_game_wallets set scroll_balance/i);
    assert.doesNotMatch(migration, /perform private\.create_task_loot_drops/);
  });
});
