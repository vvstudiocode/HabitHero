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

  it('keeps the mounted world stable while updating character and pet actors in place', () => {
    assert.equal(
      getTerrainWorldSceneKey({
        ...baseGameData,
        loadout: { ...baseGameData.loadout!, equippedCharacterInventoryId: 'inventory-other' },
      }, 'high'),
      getTerrainWorldSceneKey(baseGameData, 'high'),
    );
    assert.equal(
      getTerrainWorldSceneKey({
        ...baseGameData,
        loadout: { ...baseGameData.loadout!, followingPetInventoryId: 'inventory-pet' },
      }, 'high'),
      getTerrainWorldSceneKey(baseGameData, 'high'),
    );
    assert.equal(
      getTerrainWorldSceneKey({
        ...baseGameData,
        worldEntities: [{ id: 'entity-1', inventoryItemId: 'inventory-decoration', entityKind: 'decoration', worldLayoutVersion: 1, x: 1, y: 0, z: -1, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, behaviorMode: 'static', roamingSlot: null, isActive: true }],
      }, 'high'),
      getTerrainWorldSceneKey(baseGameData, 'high'),
    );
    assert.notEqual(getTerrainWorldSceneKey(baseGameData, 'low'), getTerrainWorldSceneKey(baseGameData, 'high'));
  });

  it('keeps the mounted world stable while an existing decoration moves', () => {
    const before = {
      ...baseGameData,
      worldEntities: [{
        id: 'entity-decoration', inventoryItemId: 'inventory-decoration', entityKind: 'decoration' as const,
        worldLayoutVersion: 1, x: 1, y: 0, z: -1, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 0.4,
        behaviorMode: 'static' as const, roamingSlot: null, isActive: true,
        catalogItemId: 'decoration-chair', assetKey: 'decoration.study-chair',
      }],
    };
    const after = {
      ...before,
      worldEntities: before.worldEntities.map((entity) => ({
        ...entity, x: -2, z: 2, rotationY: 1.2, scale: 0.5,
      })),
    };
    assert.equal(getTerrainWorldSceneKey(after, 'high'), getTerrainWorldSceneKey(before, 'high'));
  });

  it('keeps pet presentation changes out of the remount key', () => {
    const petCatalogItem = {
      id: 'pet-nibus', itemType: 'pet' as const, name: '尼布斯', description: '', scrollPrice: 1,
      assetKey: 'pet.nibus', thumbnailUrl: null, isActive: true, isStarter: false, isStackable: false,
      collisionRadius: 0.3, minScale: 0.8, maxScale: 1.2, sortOrder: 2,
      metadata: { model: '/assets/pets/nibus.glb', groundOffset: -0.12, hideGroundMarker: true },
    };
    const petInventory = { id: 'inventory-pet', catalogItemId: 'pet-nibus', quantity: 1, acquiredVia: 'purchase' as const, acquiredAt: '2026-08-09T00:00:00Z' };
    const before = {
      ...baseGameData,
      catalog: [...baseGameData.catalog, petCatalogItem],
      inventory: [...baseGameData.inventory, petInventory],
      loadout: { ...baseGameData.loadout!, followingPetInventoryId: 'inventory-pet' },
    };
    const after = {
      ...before,
      catalog: before.catalog.map((item) => item.id === 'pet-nibus'
        ? { ...item, metadata: { ...item.metadata, groundOffset: -0.22, nameLabelScaleMultiplier: 0.33 } }
        : item),
    };

    assert.equal(getTerrainWorldSceneKey(after, 'high'), getTerrainWorldSceneKey(before, 'high'));
  });
});
