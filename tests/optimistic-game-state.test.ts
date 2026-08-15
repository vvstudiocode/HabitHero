import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppState } from '../src/types';
import type { ChildGameData, GamePurchaseResult } from '../src/features/world/contracts';
import {
  patchPurchasedGameItem,
  reconcilePurchasedGameItem,
  rollbackPurchasedGameItem,
  patchFollowingPets,
  patchRoamingPets,
} from '../src/features/world/game-loadout';
import { patchDeletedChild, rollbackDeletedChild } from '../src/lib/optimistic-app-state';

function gameData(overrides: Partial<ChildGameData> = {}): ChildGameData {
  return {
    walletBalance: 100,
    catalog: [
      {
        id: 'pet-fox',
        itemType: 'pet',
        name: '小狐',
        description: '敏捷的森林夥伴',
        scrollPrice: 30,
        assetKey: 'pet.fox',
        thumbnailUrl: null,
        isActive: true,
        isStarter: false,
        isStackable: false,
        collisionRadius: 0.3,
        minScale: 1,
        maxScale: 1,
        sortOrder: 1,
        metadata: {},
      },
      {
        id: 'decoration-flower',
        itemType: 'decoration',
        name: '小花',
        description: '一朵小花',
        scrollPrice: 5,
        assetKey: 'decoration.flower',
        thumbnailUrl: null,
        isActive: true,
        isStarter: false,
        isStackable: true,
        collisionRadius: 0.2,
        minScale: 0.5,
        maxScale: 1.5,
        sortOrder: 2,
        metadata: {},
      },
    ],
    prices: { 'pet-fox': 25, 'decoration-flower': 5 },
    inventory: [],
    loadout: {
      equippedCharacterInventoryId: null,
      followingPetInventoryId: null,
      followingPetInventoryIds: [],
    },
    worldEntities: [
      {
        id: 'entity-roaming-old',
        inventoryItemId: 'inventory-old',
        entityKind: 'pet',
        worldLayoutVersion: 1,
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
        behaviorMode: 'wander',
        roamingSlot: 1,
        isActive: true,
        catalogItemId: 'pet-fox',
        assetKey: 'pet.fox',
        name: '小狐',
      },
      {
        id: 'entity-decoration',
        inventoryItemId: 'inventory-flower',
        entityKind: 'decoration',
        worldLayoutVersion: 1,
        x: 2,
        y: 0,
        z: 2,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
        behaviorMode: 'static',
        roamingSlot: null,
        isActive: true,
      },
    ],
    worldRevision: 7,
    ...overrides,
  };
}

function appState(overrides: Partial<AppState> = {}): AppState {
  return {
    parentPin: null,
    parentConsentVersion: null,
    children: [
      { id: 'child-a', name: '小安', tasks: [], rewards: [], wishlist: [], tickets: [], points: 0, loginName: null, code: '', characterId: 'character.arthur', theme: { accentColor: null, mobileBackgroundImageUrl: null, desktopBackgroundImageUrl: null } },
      { id: 'child-b', name: '小恩', tasks: [], rewards: [], wishlist: [], tickets: [], points: 0, loginName: null, code: '', characterId: 'character.elina', theme: { accentColor: null, mobileBackgroundImageUrl: null, desktopBackgroundImageUrl: null } },
    ],
    parentActiveChildId: 'child-a',
    childLoggedInId: null,
    taskTemplates: [],
    ledger: [],
    lastResetDate: null,
    familyTheme: { accentColor: 'amber', mobileBackgroundImageUrl: null, desktopBackgroundImageUrl: null },
    adventureGroups: [],
    taskSchedules: [],
    timerSessions: [],
    gameDataByChildId: { 'child-a': gameData(), 'child-b': gameData() },
    ...overrides,
  };
}

describe('optimistic game state', () => {
  it('shows a purchased pet immediately and reconciles its temporary inventory id', () => {
    const optimistic = patchPurchasedGameItem(gameData(), {
      catalogItemId: 'pet-fox',
      quantity: 1,
      localInventoryItemId: 'local-purchase-1',
      acquiredAt: '2026-08-13T00:00:00.000Z',
    });

    assert.equal(optimistic.walletBalance, 75);
    assert.deepEqual(optimistic.inventory, [{
      id: 'local-purchase-1',
      catalogItemId: 'pet-fox',
      quantity: 1,
      acquiredVia: 'purchase',
      acquiredAt: '2026-08-13T00:00:00.000Z',
      displayName: null,
    }]);

    const result: GamePurchaseResult = {
      purchaseId: 'purchase-1',
      inventoryItemId: 'inventory-fox',
      walletBalance: 75,
      quantity: 1,
    };
    const reconciled = reconcilePurchasedGameItem(optimistic, 'local-purchase-1', result);
    assert.equal(reconciled.walletBalance, 75);
    assert.equal(reconciled.inventory[0]?.id, 'inventory-fox');
  });

  it('rolls back only the failed purchase while preserving another optimistic purchase', () => {
    const first = patchPurchasedGameItem(gameData(), {
      catalogItemId: 'pet-fox',
      quantity: 1,
      localInventoryItemId: 'local-purchase-1',
      acquiredAt: '2026-08-13T00:00:00.000Z',
    });
    const both = patchPurchasedGameItem(first, {
      catalogItemId: 'pet-fox',
      quantity: 1,
      localInventoryItemId: 'local-purchase-2',
      acquiredAt: '2026-08-13T00:00:01.000Z',
    });

    const rolledBack = rollbackPurchasedGameItem(both, {
      catalogItemId: 'pet-fox',
      quantity: 1,
      localInventoryItemId: 'local-purchase-1',
      acquiredAt: '2026-08-13T00:00:00.000Z',
    });
    assert.equal(rolledBack.walletBalance, 75);
    assert.deepEqual(rolledBack.inventory.map((item) => item.id), ['local-purchase-2']);
  });

  it('updates following state immediately and removes selected pets from roaming entities', () => {
    const patched = patchFollowingPets({
      ...gameData(),
      loadout: { equippedCharacterInventoryId: null, followingPetInventoryId: null, followingPetInventoryIds: [] },
    }, ['inventory-old']);

    assert.deepEqual(patched.loadout?.followingPetInventoryIds, ['inventory-old']);
    assert.equal(patched.loadout?.followingPetInventoryId, 'inventory-old');
    assert.equal(patched.worldEntities[0]?.isActive, false);
    assert.equal(patched.worldEntities[0]?.behaviorMode, 'idle');
    assert.equal(patched.worldEntities[1]?.isActive, true);
  });

  it('updates roaming entities immediately, including creating a local entity for a new roaming pet', () => {
    const patched = patchRoamingPets({
      ...gameData(),
      inventory: [{ id: 'inventory-fox', catalogItemId: 'pet-fox', quantity: 1, acquiredVia: 'purchase', acquiredAt: '', displayName: null }],
    }, ['inventory-fox']);

    const roaming = patched.worldEntities.find((entity) => entity.inventoryItemId === 'inventory-fox');
    assert.equal(roaming?.isActive, true);
    assert.equal(roaming?.behaviorMode, 'wander');
    assert.equal(roaming?.roamingSlot, 1);
    assert.equal(patched.worldEntities.find((entity) => entity.inventoryItemId === 'inventory-old')?.isActive, false);
    assert.equal(patched.worldEntities.find((entity) => entity.entityKind === 'decoration')?.isActive, true);
  });

  it('removes a deleted child and its game data while selecting a valid fallback child', () => {
    const removed = patchDeletedChild(appState(), 'child-a');
    assert.deepEqual(removed.children.map((child) => child.id), ['child-b']);
    assert.equal(removed.parentActiveChildId, 'child-b');
    assert.equal(removed.gameDataByChildId['child-a'], undefined);
  });

  it('rolls back a failed child deletion without discarding unrelated current state', () => {
    const previous = appState();
    const optimistic = patchDeletedChild(previous, 'child-a');
    const current = { ...optimistic, parentPin: 'changed-locally' };
    const restored = rollbackDeletedChild(current, previous, 'child-a');
    assert.deepEqual(restored.children.map((child) => child.id), ['child-a', 'child-b']);
    assert.equal(restored.parentPin, 'changed-locally');
    assert.equal(restored.parentActiveChildId, 'child-a');
  });
});
