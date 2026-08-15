import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  getPetNameDisplayPreference,
  setPetNameDisplayPreference,
} from '../src/features/world/pet-name-display-preference';
import { emptyChildGameData } from '../src/features/world/contracts';
import { patchPetDisplayName } from '../src/features/world/pet-name-optimistic';

const root = new URL('..', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

describe('pet naming contracts', () => {
  it('persists the world-name preference per child and defaults to visible', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    assert.equal(getPetNameDisplayPreference('child-a', storage), true);
    setPetNameDisplayPreference('child-a', false, storage);
    assert.equal(getPetNameDisplayPreference('child-a', storage), false);
    assert.equal(getPetNameDisplayPreference('child-b', storage), true);
    setPetNameDisplayPreference('child-a', true, storage);
    assert.equal(getPetNameDisplayPreference('child-a', storage), true);
  });

  it('adds a safe display-name column and an ownership-checked rename RPC', async () => {
    const migration = await read('supabase/migrations/20260813045409_pet_display_name.sql');
    assert.match(migration, /alter table public\.child_inventory_items[\s\S]*add column if not exists display_name text/);
    assert.match(migration, /char_length\(trim\(display_name\)\) between 1 and 12/);
    assert.match(migration, /create or replace function public\.set_pet_display_name\(/);
    assert.match(migration, /private\.resolve_game_child\(target_child_profile_id\)/);
    assert.match(migration, /item\.item_type = 'pet'/);
    assert.match(migration, /update public\.child_inventory_items[\s\S]*set display_name/);
    assert.doesNotMatch(migration, /updated_at/);
  });

  it('maps names through inventory and world entity snapshots', async () => {
    const contracts = await read('src/features/world/contracts.ts');
    const gameData = await read('src/features/world/game-data.ts');
    assert.match(contracts, /displayName\?: string \| null;/);
    assert.match(contracts, /displayName\?: string;/);
    assert.match(gameData, /displayName: row\.display_name/);
    assert.match(gameData, /displayName: inventory\?\.display_name/);
  });

  it('updates the backpack and placed pet label before the RPC resolves', () => {
    const original = {
      ...emptyChildGameData(),
      inventory: [{ id: 'pet-inventory', catalogItemId: 'pet-mushroom', quantity: 1, acquiredVia: 'purchase' as const, acquiredAt: '', displayName: null }],
      worldEntities: [{
        id: 'pet-entity',
        inventoryItemId: 'pet-inventory',
        entityKind: 'pet' as const,
        worldLayoutVersion: 1,
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
        behaviorMode: 'idle' as const,
        roamingSlot: null,
        isActive: true,
      }],
    };
    const updated = patchPetDisplayName(original, 'pet-inventory', '小菇');
    assert.equal(original.inventory[0].displayName, null);
    assert.equal(updated.inventory[0].displayName, '小菇');
    assert.equal(updated.worldEntities[0].displayName, '小菇');
    assert.equal(patchPetDisplayName(updated, 'pet-inventory', null).inventory[0].displayName, null);
  });

  it('wires direct backpack rename, settings toggle, and white text-only world labels', async () => {
    const panel = await read('src/features/world/components/ChildGamePanel.tsx');
    const dashboard = await read('src/components/ChildDashboard.tsx');
    const layer = await read('src/features/world/TerrainWorldLayer.tsx');
    const runtime = await read('src/features/world/prototype-world-runtime.ts');
    const dataAccess = await read('src/lib/data-access.ts');
    const store = await read('src/store.tsx');
    assert.match(panel, /onRenamePet/);
    assert.match(panel, /寵物名字/);
    assert.match(panel, /顯示寵物名字/);
    assert.match(panel, /正在背景同步/);
    assert.match(panel, /void onRenamePet/);
    assert.match(dashboard, /onRenamePet/);
    assert.match(dashboard, /showPetNames/);
    assert.match(layer, /showPetNames/);
    assert.match(runtime, /showPetNames/);
    assert.match(runtime, /CanvasTexture/);
    assert.match(runtime, /fillStyle\s*=\s*['"]#fff/);
    assert.match(runtime, /transparent:\s*true/);
    assert.match(dataAccess, /set_pet_display_name/);
    assert.match(dataAccess, /target_display_name/);
    assert.match(store, /patchPetDisplayName/);
  });
});
