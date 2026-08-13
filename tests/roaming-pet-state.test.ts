import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  getNextRoamingPets,
  getRoamablePetInventoryIds,
  getRoamingPetSnapshot,
} from '../src/features/world/components/roaming-pet-state';
import type { ChildGameData } from '../src/features/world/contracts';

const childGamePanelSource = readFileSync(
  new URL('../src/features/world/components/ChildGamePanel.tsx', import.meta.url),
  'utf8',
);

function createGameData(overrides: Partial<ChildGameData> = {}): ChildGameData {
  return {
    walletBalance: 0,
    catalog: [
      { id: 'pet-cat', itemType: 'pet', name: '貓咪', description: '', scrollPrice: 0, assetKey: 'cat', thumbnailUrl: null, isActive: true, isStarter: true, isStackable: false, collisionRadius: 0.3, minScale: 1, maxScale: 1, sortOrder: 1, metadata: {} },
      { id: 'pet-dog', itemType: 'pet', name: '狗狗', description: '', scrollPrice: 0, assetKey: 'dog', thumbnailUrl: null, isActive: true, isStarter: true, isStackable: false, collisionRadius: 0.3, minScale: 1, maxScale: 1, sortOrder: 2, metadata: {} },
      { id: 'decoration-flower', itemType: 'decoration', name: '花', description: '', scrollPrice: 0, assetKey: 'flower', thumbnailUrl: null, isActive: true, isStarter: true, isStackable: false, collisionRadius: 0.3, minScale: 1, maxScale: 1, sortOrder: 3, metadata: {} },
    ],
    prices: {},
    inventory: [
      { id: 'inventory-cat', catalogItemId: 'pet-cat', quantity: 1, acquiredVia: 'starter', acquiredAt: '' },
      { id: 'inventory-dog', catalogItemId: 'pet-dog', quantity: 1, acquiredVia: 'starter', acquiredAt: '' },
    ],
    loadout: { equippedCharacterInventoryId: null, followingPetInventoryId: 'inventory-dog' },
    worldEntities: [],
    worldRevision: 7,
    ...overrides,
  };
}

describe('roaming pet state', () => {
  it('derives a server snapshot from active owned wandering pets and excludes the following pet', () => {
    const data = createGameData({
      worldEntities: [
        { id: 'entity-dog', inventoryItemId: 'inventory-dog', entityKind: 'pet', worldLayoutVersion: 1, x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, behaviorMode: 'wander', roamingSlot: 1, isActive: true },
        { id: 'entity-cat', inventoryItemId: 'inventory-cat', entityKind: 'pet', worldLayoutVersion: 1, x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, behaviorMode: 'wander', roamingSlot: 2, isActive: true },
        { id: 'inactive-cat', inventoryItemId: 'inventory-cat', entityKind: 'pet', worldLayoutVersion: 1, x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, behaviorMode: 'wander', roamingSlot: 3, isActive: false },
      ],
    });

    assert.deepEqual(getRoamablePetInventoryIds(data), ['inventory-cat']);
    assert.deepEqual(getRoamingPetSnapshot(data), ['inventory-cat']);
  });

  it('rejects non-roamable pets but keeps every selected roaming pet in order', () => {
    const roamablePetIds = ['inventory-cat'];

    assert.deepEqual(getNextRoamingPets(['inventory-cat'], 'inventory-dog', roamablePetIds), ['inventory-cat']);
    assert.deepEqual(getNextRoamingPets(['inventory-cat'], 'inventory-missing', roamablePetIds), ['inventory-cat']);
    assert.deepEqual(getNextRoamingPets(['inventory-cat', 'inventory-dog'], 'inventory-cat', roamablePetIds), ['inventory-dog']);

    const fullRoamablePetIds = ['inventory-cat', 'inventory-dog', 'inventory-bird', 'inventory-fox'];
    assert.deepEqual(getNextRoamingPets(fullRoamablePetIds.slice(0, 3), 'inventory-fox', fullRoamablePetIds), fullRoamablePetIds);
  });

  it('does not expose retired pet catalog rows to roaming', () => {
    const data = createGameData({
      catalog: [
        ...createGameData().catalog,
        { id: 'pet-retired', itemType: 'pet', name: '舊寵物', description: '', scrollPrice: 0, assetKey: 'retired', thumbnailUrl: null, isActive: false, isStarter: false, isStackable: false, collisionRadius: 0.3, minScale: 1, maxScale: 1, sortOrder: 4, metadata: {} },
      ],
      inventory: [
        ...createGameData().inventory,
        { id: 'inventory-retired', catalogItemId: 'pet-retired', quantity: 1, acquiredVia: 'purchase', acquiredAt: '' },
      ],
      loadout: { equippedCharacterInventoryId: null, followingPetInventoryId: null },
    });

    assert.deepEqual(getRoamablePetInventoryIds(data), ['inventory-cat', 'inventory-dog']);
    assert.equal(getRoamablePetInventoryIds(data).includes('inventory-retired'), false);
  });

  it('keeps the panel synchronized with refreshed game data and restores its server snapshot after RPC failure', () => {
    assert.match(childGamePanelSource, /useEffect\(\(\) => \{[\s\S]*?getRoamingPetSnapshot\(gameData\)[\s\S]*?setRoamingPets\(/);
    assert.match(childGamePanelSource, /roamingPetsServerSnapshotRef/);
    assert.match(childGamePanelSource, /巡遊夥伴更新失敗，已恢復上次同步狀態/);
    assert.match(childGamePanelSource, /toggleFollowingPet\(inventory\.id\)/);
    assert.match(childGamePanelSource, /onSetFollowingPets\(next\)/);
    assert.match(childGamePanelSource, /取消跟隨/);
    assert.match(childGamePanelSource, /disabled=\{mutationPending\}/);
    assert.match(childGamePanelSource, /disabled=\{mutationPending \|\| isFollowing \|\| roamingMutationPending/);
  });
});
