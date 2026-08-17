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

  it('also removes an existing idle entity when its pet becomes a follower', () => {
    const patched = patchFollowingPets({
      ...gameData(),
      loadout: { equippedCharacterInventoryId: null, followingPetInventoryId: null, followingPetInventoryIds: [] },
      worldEntities: [{
        id: 'entity-idle-following',
        inventoryItemId: 'inventory-following',
        entityKind: 'pet',
        worldLayoutVersion: 1,
        x: 1,
        y: 0,
        z: -1,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
        behaviorMode: 'idle',
        roamingSlot: null,
        isActive: true,
        catalogItemId: 'pet-fox',
        assetKey: 'pet.fox',
        name: '小狐',
      }],
    }, ['inventory-following']);

    assert.equal(patched.worldEntities[0]?.isActive, false);
    assert.equal(patched.worldEntities[0]?.behaviorMode, 'idle');
  });

  it("keeps another pet's idle entity when adding a different follower", () => {
    const patched = patchFollowingPets({
      ...gameData(),
      loadout: { equippedCharacterInventoryId: null, followingPetInventoryId: null, followingPetInventoryIds: [] },
      worldEntities: [{
        id: 'entity-idle-one',
        inventoryItemId: 'inventory-one',
        entityKind: 'pet',
        worldLayoutVersion: 1,
        x: 1,
        y: 0,
        z: -1,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
        behaviorMode: 'idle',
        roamingSlot: null,
        isActive: true,
        catalogItemId: 'pet-fox',
        assetKey: 'pet.fox',
        name: '一號',
      }],
    }, ['inventory-two']);

    assert.equal(patched.worldEntities[0]?.inventoryItemId, 'inventory-one');
    assert.equal(patched.worldEntities[0]?.isActive, true);
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

  it('keeps an existing roaming pet at its current position during a queue update', () => {
    const patched = patchRoamingPets({
      ...gameData(),
      inventory: [{ id: 'inventory-fox', catalogItemId: 'pet-fox', quantity: 1, acquiredVia: 'purchase', acquiredAt: '', displayName: null }],
      worldEntities: [{
        id: 'entity-fox',
        inventoryItemId: 'inventory-fox',
        entityKind: 'pet',
        worldLayoutVersion: 1,
        x: 2.25,
        y: 0.15,
        z: -1.75,
        rotationX: 0,
        rotationY: 0.4,
        rotationZ: 0,
        scale: 1,
        behaviorMode: 'idle',
        roamingSlot: null,
        isActive: true,
        catalogItemId: 'pet-fox',
        assetKey: 'pet.fox',
        name: '小狐',
      }],
    }, ['inventory-fox']);

    assert.equal(patched.worldEntities[0]?.x, 2.25);
    assert.equal(patched.worldEntities[0]?.y, 0.15);
    assert.equal(patched.worldEntities[0]?.z, -1.75);
    assert.equal(patched.worldEntities[0]?.rotationY, 0.4);
  });

  it('keeps another active idle pet in the world when the roaming queue changes', () => {
    const patched = patchRoamingPets({
      ...gameData(),
      worldEntities: [
        {
          id: 'entity-idle-pet',
          inventoryItemId: 'inventory-idle',
          entityKind: 'pet',
          worldLayoutVersion: 1,
          x: 2,
          y: 0,
          z: -1,
          rotationX: 0,
          rotationY: 0.25,
          rotationZ: 0,
          scale: 1,
          behaviorMode: 'idle',
          roamingSlot: null,
          isActive: true,
          catalogItemId: 'pet-fox',
          assetKey: 'pet.fox',
          name: '待機夥伴',
        },
        ...gameData().worldEntities,
      ],
    }, ['inventory-old']);

    const idlePet = patched.worldEntities.find((entity) => entity.inventoryItemId === 'inventory-idle');
    assert.equal(idlePet?.isActive, true);
    assert.equal(idlePet?.behaviorMode, 'idle');
    assert.equal(idlePet?.x, 2);
    assert.equal(idlePet?.z, -1);
  });

  it('applies the selected position when a following pet starts roaming', () => {
    const patched = patchRoamingPets({
      ...gameData(),
      inventory: [{ id: 'inventory-fox', catalogItemId: 'pet-fox', quantity: 1, acquiredVia: 'purchase', acquiredAt: '', displayName: null }],
      worldEntities: [{
        id: 'entity-fox',
        inventoryItemId: 'inventory-fox',
        entityKind: 'pet',
        worldLayoutVersion: 1,
        x: -3.5,
        y: 0,
        z: -3.5,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
        behaviorMode: 'idle',
        roamingSlot: null,
        isActive: false,
        catalogItemId: 'pet-fox',
        assetKey: 'pet.fox',
        name: '小狐',
      }],
    }, ['inventory-fox'], {
      'inventory-fox': { x: 2, y: 0, z: -1, rotationX: 0, rotationY: 0.6, rotationZ: 0, scale: 1 },
    });

    assert.equal(patched.worldEntities[0]?.x, 2);
    assert.equal(patched.worldEntities[0]?.z, -1);
    assert.equal(patched.worldEntities[0]?.rotationY, 0.6);
    assert.equal(patched.worldEntities[0]?.behaviorMode, 'wander');
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
