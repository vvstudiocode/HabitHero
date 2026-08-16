import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createWorldSceneGameDataSnapshot,
  getRequiredWorldDecorationCatalogItems,
  getRequiredWorldPetCatalogItems,
} from '../src/features/world/world-scene-data';
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

function decoration(id: string, assetKey: string): GameCatalogItem {
  return {
    id,
    itemType: 'decoration',
    name: id,
    description: '',
    scrollPrice: 0,
    assetKey,
    thumbnailUrl: null,
    isActive: true,
    isStarter: false,
    isStackable: true,
    collisionRadius: 0.38,
    minScale: 0.7,
    maxScale: 1.5,
    sortOrder: 1,
    metadata: { primitive: 'lantern' },
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
  it('returns only following and active pet catalog items for model loading', () => {
    const data = gameData(
      [
        pet('pet-silf', 'pet.silf-owl'),
        pet('pet-yaoguang', 'pet.yaoguang-deer'),
        pet('pet-unused', 'pet.murphy-bear'),
      ],
      [{
        id: 'entity-yaoguang', inventoryItemId: 'inventory-yaoguang', entityKind: 'pet', worldLayoutVersion: 1,
        x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1,
        behaviorMode: 'wander', roamingSlot: 1, isActive: true, catalogItemId: 'pet-yaoguang', assetKey: 'pet.yaoguang-deer',
      }],
    );

    assert.deepEqual(
      getRequiredWorldPetCatalogItems(data).map((item) => item.assetKey),
      ['pet.silf-owl', 'pet.yaoguang-deer'],
    );
  });

  it('returns only active decorations plus the current placement item', () => {
    const placed = decoration('decoration-placed', 'decoration.study-desk');
    const unused = decoration('decoration-unused', 'decoration.bookcase');
    const placement = decoration('decoration-preview', 'decoration.study-chair');
    const data = gameData(
      [pet('pet-silf', 'pet.silf-owl'), placed, unused],
      [{
        id: 'entity-placed', inventoryItemId: 'inventory-placed', entityKind: 'decoration', worldLayoutVersion: 1,
        x: 1, y: 0, z: -1, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1,
        behaviorMode: 'static', roamingSlot: null, isActive: true, catalogItemId: placed.id,
      }],
    );

    assert.deepEqual(
      getRequiredWorldDecorationCatalogItems(data, placement).map((item) => item.assetKey),
      ['decoration.study-desk', 'decoration.study-chair'],
    );
  });

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

  it('keeps active decoration catalog rows available to the world renderer', () => {
    const snapshot = createWorldSceneGameDataSnapshot(
      gameData(
        [pet('pet-silf', 'pet.silf-owl'), decoration('decoration-lantern', 'decoration.flower-lantern')],
        [{
          id: 'entity-lantern', inventoryItemId: 'inventory-lantern', entityKind: 'decoration', worldLayoutVersion: 1,
          x: 1, y: 0, z: -1, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1,
          behaviorMode: 'static', roamingSlot: null, isActive: true, catalogItemId: 'decoration-lantern',
        }],
      ),
    );

    assert.deepEqual(snapshot.catalog.map((item) => item.assetKey), ['pet.silf-owl', 'decoration.flower-lantern']);
  });
});
