import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { ChildGameData } from '../src/features/world/contracts';
import {
  getFollowingPetInventoryIds,
  getNextFollowingPets,
} from '../src/features/world/following-pet-state';
import { getFollowingDistance, PET_FOLLOW_DISTANCE, PET_FOLLOW_SPACING } from '../src/features/world/pet-following';
import {
  getPetMovementSpeedMultiplier,
  getPetVisualScaleMultiplier,
} from '../src/features/world/prototype-world-runtime';

const deerTuningMigration = readFileSync(new URL('../supabase/migrations/20260813015423_enlarge_yaoguang_deer_and_remove_grass_wind.sql', import.meta.url), 'utf8');
const deerResizeMigration = readFileSync(new URL('../supabase/migrations/20260813020916_resize_yaoguang_deer_and_reposition_big_tree.sql', import.meta.url), 'utf8');

function gameData(loadout: ChildGameData['loadout']): ChildGameData {
  return {
    walletBalance: 0,
    catalog: [
      { id: 'pet-deer', itemType: 'pet', name: '鹿', description: '', scrollPrice: 0, assetKey: 'pet.yaoguang-deer', thumbnailUrl: null, isActive: true, isStarter: true, isStackable: false, collisionRadius: 0.3, minScale: 1, maxScale: 1, sortOrder: 1, metadata: {} },
      { id: 'pet-bear', itemType: 'pet', name: '熊', description: '', scrollPrice: 0, assetKey: 'pet.murphy-bear', thumbnailUrl: null, isActive: true, isStarter: true, isStackable: false, collisionRadius: 0.3, minScale: 1, maxScale: 1, sortOrder: 2, metadata: {} },
      { id: 'pet-fox', itemType: 'pet', name: '狐狸', description: '', scrollPrice: 0, assetKey: 'pet.fox', thumbnailUrl: null, isActive: true, isStarter: true, isStackable: false, collisionRadius: 0.3, minScale: 1, maxScale: 1, sortOrder: 3, metadata: {} },
      { id: 'pet-rabbit', itemType: 'pet', name: '兔子', description: '', scrollPrice: 0, assetKey: 'pet.rabbit', thumbnailUrl: null, isActive: true, isStarter: true, isStackable: false, collisionRadius: 0.3, minScale: 1, maxScale: 1, sortOrder: 4, metadata: {} },
    ],
    prices: {},
    inventory: [
      { id: 'inventory-deer', catalogItemId: 'pet-deer', quantity: 1, acquiredVia: 'starter', acquiredAt: '' },
      { id: 'inventory-bear', catalogItemId: 'pet-bear', quantity: 1, acquiredVia: 'starter', acquiredAt: '' },
      { id: 'inventory-fox', catalogItemId: 'pet-fox', quantity: 1, acquiredVia: 'starter', acquiredAt: '' },
      { id: 'inventory-rabbit', catalogItemId: 'pet-rabbit', quantity: 1, acquiredVia: 'starter', acquiredAt: '' },
    ],
    loadout,
    worldEntities: [],
    worldRevision: 0,
  };
}

describe('multiple pet following', () => {
  it('keeps all following pets in the configured order and supports legacy singleton data', () => {
    assert.deepEqual(
      getFollowingPetInventoryIds(gameData({
        equippedCharacterInventoryId: null,
        followingPetInventoryId: 'inventory-deer',
        followingPetInventoryIds: ['inventory-deer', 'inventory-bear', 'inventory-fox'],
      })),
      ['inventory-deer', 'inventory-bear', 'inventory-fox'],
    );
    assert.deepEqual(
      getFollowingPetInventoryIds(gameData({ equippedCharacterInventoryId: null, followingPetInventoryId: 'inventory-bear' })),
      ['inventory-bear'],
    );
  });

  it('appends a new follower and removes only the toggled follower', () => {
    assert.deepEqual(
      getNextFollowingPets(['inventory-deer', 'inventory-bear'], 'inventory-fox'),
      ['inventory-deer', 'inventory-bear', 'inventory-fox'],
    );
    assert.deepEqual(
      getNextFollowingPets(['inventory-deer', 'inventory-bear', 'inventory-fox'], 'inventory-bear'),
      ['inventory-deer', 'inventory-fox'],
    );
  });

  it('puts the first follower closer to the player and queues the rest in order', () => {
    assert.equal(PET_FOLLOW_DISTANCE, 0.24);
    assert.equal(PET_FOLLOW_SPACING, 0.31);
    assert.ok(getFollowingDistance(0) < getFollowingDistance(1));
    assert.ok(getFollowingDistance(1) < getFollowingDistance(2));
  });

  it('applies the requested visual and movement multipliers for deer and bear', () => {
    assert.equal(getPetVisualScaleMultiplier('pet.yaoguang-deer'), 1.3 * (8 / 3));
    assert.equal(getPetVisualScaleMultiplier('pet.murphy-bear'), 1.3 * 2);
    assert.equal(getPetVisualScaleMultiplier('pet.other', { visualScaleMultiplier: 1.5 }), 1.3 * 1.5);
    assert.equal(getPetVisualScaleMultiplier('pet.other'), 1.3);
    assert.equal(getPetMovementSpeedMultiplier('pet.yaoguang-deer'), 0.6);
    assert.equal(getPetMovementSpeedMultiplier('pet.murphy-bear'), 1);
    assert.equal(getPetMovementSpeedMultiplier('pet.other', { movementSpeedMultiplier: 0.5 }), 0.5);
  });

  it('persists deer tuning in the follow-up migration', () => {
    assert.match(deerTuningMigration, /asset_key = 'pet\.yaoguang-deer'/);
    assert.match(deerTuningMigration, /'visualScaleMultiplier', 4/);
    assert.match(deerTuningMigration, /'movementSpeedMultiplier', 0\.3/);
  });

  it('persists the latest deer tuning in the resize migration', () => {
    assert.match(deerResizeMigration, /asset_key = 'pet\.yaoguang-deer'/);
    assert.match(deerResizeMigration, /'visualScaleMultiplier', 8\.0 \/ 3\.0/);
    assert.match(deerResizeMigration, /'movementSpeedMultiplier', 0\.6/);
  });
});
