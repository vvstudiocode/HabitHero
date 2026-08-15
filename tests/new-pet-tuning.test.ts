import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getPetGroundOffset, getPetMovementSpeedMultiplier, getPetVisualScaleMultiplier } from '../src/features/world/prototype-world-runtime';
import { selectFollowingPet } from '../src/features/world/following-pet-state';
import { patchFollowingPets } from '../src/features/world/game-loadout';

const root = new URL('../', import.meta.url);
const migrationName = readdirSync(new URL('supabase/migrations/', root)).find((name) => name.includes('tune_star_diver_and_teddy_sou_pets'));
const migration = migrationName
  ? readFileSync(new URL(`supabase/migrations/${migrationName}`, root), 'utf8')
  : '';
const groundMigrationName = readdirSync(new URL('supabase/migrations/', root)).find((name) => name.includes('lower_star_diver_and_teddy_sou_to_grass'));
const groundMigration = groundMigrationName
  ? readFileSync(new URL(`supabase/migrations/${groundMigrationName}`, root), 'utf8')
  : '';
const runtime = readFileSync(new URL('src/features/world/prototype-world-runtime.ts', root), 'utf8');

describe('Star Diver and Teddy Sou tuning', () => {
  it('uses the requested size and slower movement tuning', () => {
    assert.equal(getPetVisualScaleMultiplier('pet.star-diver', { visualScaleMultiplier: 2 }), 1.3 * 2);
    assert.equal(getPetMovementSpeedMultiplier('pet.star-diver', { movementSpeedMultiplier: 0.65 }), 0.65);
  });

  it('lowers the supplied pets onto the grass instead of leaving them hovering', () => {
    assert.equal(getPetGroundOffset('pet.star-diver', { groundOffset: -0.12 }), -0.12);
  });

  it('promotes the selected pet without discarding the rest of the follow queue', () => {
    assert.deepEqual(
      selectFollowingPet(['inventory-teddy'], 'inventory-star'),
      ['inventory-star', 'inventory-teddy'],
    );
  });

  it('optimistically promotes the selected pet in the world game data too', () => {
    const patched = patchFollowingPets({
      walletBalance: 0,
      catalog: [],
      prices: {},
      inventory: [],
      loadout: {
        equippedCharacterInventoryId: null,
        followingPetInventoryId: 'inventory-teddy',
        followingPetInventoryIds: ['inventory-teddy'],
      },
      worldEntities: [],
      worldRevision: 4,
    }, ['inventory-star', 'inventory-teddy']);

    assert.deepEqual(patched.loadout?.followingPetInventoryIds, ['inventory-star', 'inventory-teddy']);
    assert.equal(patched.loadout?.followingPetInventoryId, 'inventory-star');
  });

  it('keeps pet names compact and supports per-pet ground-shadow removal', () => {
    assert.match(runtime, /PET_NAME_LABEL_WORLD_SCALE\s*=\s*0\.11/);
    assert.match(runtime, /hideGroundShadow/);
    assert.match(runtime, /getPetGroundOffset/);
  });

  it('persists the identity and presentation tuning in the Supabase migration', () => {
    assert.ok(migrationName, 'tuning migration should exist');
    assert.match(migration, /asset_key = 'pet\.star-diver'/);
    assert.match(migration, /'visualScaleMultiplier', 2/);
    assert.match(migration, /'movementSpeedMultiplier', 0\.65/);
    assert.match(migration, /'hideGroundShadow', true/);
    assert.ok(groundMigrationName, 'grounding migration should exist');
    assert.match(groundMigration, /'groundOffset', -0\.12/);
    assert.match(migration, /麵包狗/);
    assert.match(migration, /潛水/);
  });
});
