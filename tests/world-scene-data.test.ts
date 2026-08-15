import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createWorldSceneGameDataSnapshot } from '../src/features/world/world-scene-data';
import type { ChildGameData, GameCatalogItem } from '../src/features/world/contracts';

function pet(id: string, assetKey: string): GameCatalogItem {
  return {
    id,
    itemType: 'pet',
    name: id,
    description: '',
    scrollPrice: 0,
    assetKey,
    thumbnailUrl: null,
    isActive: true,
    isStarter: false,
    isStackable: false,
    collisionRadius: 0.3,
    minScale: 0.8,
    maxScale: 1.2,
    sortOrder: 1,
    metadata: { model: `/assets/${assetKey}.glb` },
  };
}

function gameData(catalog: GameCatalogItem[], worldEntities: ChildGameData['worldEntities']): ChildGameData {
  return {
    walletBalance: 0,
    catalog,
    prices: {},
    inventory: [
      { id: 'inventory-following', catalogItemId: 'pet-silf', quantity: 1, acquiredVia: 'purchase', acquiredAt: '' },
    ],
    loadout: { equippedCharacterInventoryId: null, followingPetInventoryId: 'inventory-following' },
    worldEntities,
    worldRevision: 1,
  };
}

describe('world scene game data snapshot', () => {
  it('keeps every active roaming pet catalog item alongside the following pet', () => {
    const snapshot = createWorldSceneGameDataSnapshot(
      gameData(
        [
          pet('pet-silf', 'pet.silf-owl'),
          pet('pet-yaoguang', 'pet.yaoguang-deer'),
          pet('pet-forest', 'pet.starlight-sprout'),
          pet('pet-murphy', 'pet.murphy-bear'),
        ],
        [
          {
            id: 'entity-yaoguang', inventoryItemId: 'inventory-yaoguang', entityKind: 'pet', worldLayoutVersion: 1,
            x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1,
            behaviorMode: 'wander', roamingSlot: 1, isActive: true, catalogItemId: 'pet-yaoguang', assetKey: 'pet.yaoguang-deer',
          },
          {
            id: 'entity-forest', inventoryItemId: 'inventory-forest', entityKind: 'pet', worldLayoutVersion: 1,
            x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1,
            behaviorMode: 'wander', roamingSlot: 2, isActive: true, catalogItemId: 'pet-forest', assetKey: 'pet.starlight-sprout',
          },
          {
            id: 'entity-murphy', inventoryItemId: 'inventory-murphy', entityKind: 'pet', worldLayoutVersion: 1,
            x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1,
            behaviorMode: 'wander', roamingSlot: 3, isActive: true, catalogItemId: 'pet-murphy', assetKey: 'pet.murphy-bear',
          },
        ],
      ),
    );

    assert.deepEqual(
      snapshot.catalog.map((item) => item.assetKey),
      ['pet.silf-owl', 'pet.yaoguang-deer', 'pet.starlight-sprout', 'pet.murphy-bear'],
    );
  });

  it('keeps legacy active roaming entities resolvable by asset key', () => {
    const snapshot = createWorldSceneGameDataSnapshot(
      gameData(
        [pet('pet-silf', 'pet.silf-owl'), pet('pet-murphy', 'pet.murphy-bear')],
        [{
          id: 'entity-murphy', inventoryItemId: 'inventory-murphy', entityKind: 'pet', worldLayoutVersion: 1,
          x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1,
          behaviorMode: 'wander', roamingSlot: 1, isActive: true, assetKey: 'pet.murphy-bear',
        }],
      ),
    );

    assert.deepEqual(snapshot.catalog.map((item) => item.assetKey), ['pet.silf-owl', 'pet.murphy-bear']);
  });
});
