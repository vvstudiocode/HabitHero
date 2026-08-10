import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getTerrainWorldSceneKey } from '../src/features/world/TerrainWorldLayer';
import type { ChildGameData } from '../src/features/world/contracts';

const baseGameData: ChildGameData = {
  walletBalance: 3,
  catalog: [{
    id: 'character-1', itemType: 'character', name: '旅人', description: '', scrollPrice: 1,
    assetKey: 'character.procedural', thumbnailUrl: null, isActive: true, isStarter: true,
    isStackable: false, collisionRadius: 0.2, minScale: 0.9, maxScale: 1.1, sortOrder: 1, metadata: {},
  }],
  prices: { 'character-1': 2 },
  inventory: [{ id: 'inventory-character', catalogItemId: 'character-1', quantity: 1, acquiredVia: 'starter', acquiredAt: '2026-08-09T00:00:00Z' }],
  loadout: { equippedCharacterInventoryId: 'inventory-character', followingPetInventoryId: null },
  worldEntities: [],
  worldRevision: 0,
};

describe('terrain world scene dependencies', () => {
  it('does not change when only economy refresh data or object identities change', () => {
    const refreshed = {
      ...baseGameData,
      walletBalance: 99,
      prices: { 'character-1': 8 },
      catalog: baseGameData.catalog.map((item) => ({ ...item })),
      inventory: baseGameData.inventory.map((item) => ({ ...item })),
    };

    assert.equal(getTerrainWorldSceneKey(refreshed, 'high'), getTerrainWorldSceneKey(baseGameData, 'high'));
  });

  it('changes for equipped character, following pet, world entities, and quality changes', () => {
    assert.notEqual(
      getTerrainWorldSceneKey({
        ...baseGameData,
        loadout: { ...baseGameData.loadout!, equippedCharacterInventoryId: 'inventory-other' },
      }, 'high'),
      getTerrainWorldSceneKey(baseGameData, 'high'),
    );
    assert.notEqual(
      getTerrainWorldSceneKey({
        ...baseGameData,
        loadout: { ...baseGameData.loadout!, followingPetInventoryId: 'inventory-pet' },
      }, 'high'),
      getTerrainWorldSceneKey(baseGameData, 'high'),
    );
    assert.notEqual(
      getTerrainWorldSceneKey({
        ...baseGameData,
        worldEntities: [{ id: 'entity-1', inventoryItemId: 'inventory-decoration', entityKind: 'decoration', worldLayoutVersion: 1, x: 1, y: 0, z: -1, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, behaviorMode: 'static', roamingSlot: null, isActive: true }],
      }, 'high'),
      getTerrainWorldSceneKey(baseGameData, 'high'),
    );
    assert.notEqual(getTerrainWorldSceneKey(baseGameData, 'low'), getTerrainWorldSceneKey(baseGameData, 'high'));
  });
});
