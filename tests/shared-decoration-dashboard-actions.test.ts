import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createChildDecorationActions,
  type ChildDecorationActionDependencies,
  type DecorationPlacementSession,
  type SharedDecorationItem,
} from '../src/features/shared-decorations/child-decoration-actions';
import type { GameCatalogItem } from '../src/features/world/contracts';
import {
  SharedDecorationRepositoryError,
  type SharedDecorationRepository,
} from '../src/lib/social-data/shared-decoration-repository';

const catalogItem: GameCatalogItem = {
  id: 'catalog-sofa',
  itemType: 'decoration',
  name: '沙發',
  description: 'shared decoration test item',
  scrollPrice: 1,
  assetKey: 'decoration.sofa',
  thumbnailUrl: null,
  isActive: true,
  isStarter: false,
  isStackable: false,
  collisionRadius: 0.8,
  minScale: 0.8,
  maxScale: 1.2,
  sortOrder: 1,
  metadata: {},
};

function createDependencies(overrides: Partial<ChildDecorationActionDependencies> = {}) {
  const placement: DecorationPlacementSession = {
    inventoryItemId: 'inventory-sofa',
    catalogItemId: catalogItem.id,
    entityId: 'shared-entity-1',
    placementScope: 'shared',
    draft: { x: 1, z: -1, rotationY: 0, scale: 1 },
  };
  const shareItem: SharedDecorationItem = { inventoryItemId: 'inventory-sofa', item: catalogItem };
  const state = {
    placement,
    placementPending: false,
    shareItem,
    placementStateUpdates: [] as Array<DecorationPlacementSession | null>,
    pendingStateUpdates: [] as boolean[],
    shareStateUpdates: [] as Array<SharedDecorationItem | null>,
    toasts: [] as string[],
    reloadCount: 0,
  };
  const repository: SharedDecorationRepository = {
    setCollaboration: async () => undefined,
    updateTransform: async () => ({ revision: 8 }),
    remove: async () => ({ revision: 9 }),
    place: async () => ({ revision: 10 }),
    collect: async () => ({ revision: 11 }),
  };
  const dependencies: ChildDecorationActionDependencies = {
    activeChildId: 'child-source',
    gameData: {
      walletBalance: 0,
      catalog: [catalogItem],
      prices: {},
      inventory: [{
        id: 'inventory-sofa',
        catalogItemId: catalogItem.id,
        quantity: 1,
        acquiredVia: 'purchase',
        acquiredAt: '2026-08-24T00:00:00.000Z',
      }],
      loadout: null,
      worldEntities: [],
      worldRevision: 3,
    },
    worldGameData: {
      walletBalance: 0,
      catalog: [catalogItem],
      prices: {},
      inventory: [{
        id: 'inventory-sofa',
        catalogItemId: catalogItem.id,
        quantity: 1,
        acquiredVia: 'purchase',
        acquiredAt: '2026-08-24T00:00:00.000Z',
      }],
      loadout: null,
      worldEntities: [{
        id: 'shared-entity-1',
        inventoryItemId: 'inventory-sofa',
        entityKind: 'decoration',
        worldLayoutVersion: 1,
        behaviorMode: 'static',
        roamingSlot: null,
        isActive: true,
        catalogItemId: catalogItem.id,
        collisionRadius: catalogItem.collisionRadius,
        assetKey: catalogItem.assetKey,
        placementScope: 'shared',
        canTransform: true,
        canRemove: true,
        sharedByMe: false,
        x: 1,
        y: 0,
        z: -1,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
      }],
      worldRevision: 7,
    },
    socialSession: {
      worldOwnerChildProfileId: 'child-owner',
      friendWorldRepository: {
        getFriendWorldSnapshot: async () => ({
          worldOwnerChildProfileId: 'child-target',
          displayName: '小華',
          characterAssetKey: 'character.noah',
          revision: 12,
          entities: [],
          canShareDecorations: true,
        }),
      },
      sharedDecorationRepository: repository,
      reloadSnapshot: async () => {
        state.reloadCount += 1;
      },
    },
    decorationPurchasePrompt: null,
    decorationPlacement: placement,
    placementItem: catalogItem,
    placementValid: true,
    decorationPlacementPending: state.placementPending,
    shareDecorationItem: shareItem,
    closeChildFeature: () => undefined,
    showToast: (message) => state.toasts.push(message),
    setDecorationPurchasePrompt: () => undefined,
    setDecorationPlacement: (value) => {
      const next = typeof value === 'function' ? value(state.placement) : value;
      state.placement = next;
      state.placementStateUpdates.push(next);
    },
    setDecorationPlacementPending: (value) => {
      state.placementPending = value;
      state.pendingStateUpdates.push(value);
    },
    setShareDecorationItem: (value) => {
      state.shareItem = value;
      state.shareStateUpdates.push(value);
    },
    setHeroFeature: () => undefined,
    setHeroMenuGroup: () => undefined,
    setHeroMenuVisible: () => undefined,
    removeWorldEntity: async () => ({ revision: 13 }),
    updateWorldEntityTransform: async () => ({ revision: 14 }),
    placeWorldEntity: async () => ({ revision: 15 }),
    ...overrides,
  };
  return { dependencies, repository, state };
}

describe('child dashboard shared-decoration actions', () => {
  it('updates a shared placement and reloads the visitor snapshot', async () => {
    const { dependencies, repository, state } = createDependencies();
    let updateInput: unknown;
    repository.updateTransform = async (input) => {
      updateInput = input;
      return { revision: 8 };
    };

    const actions = createChildDecorationActions(dependencies);
    await actions.completeDecorationPlacement();

    assert.deepEqual(updateInput, {
      targetWorldOwnerChildProfileId: 'child-owner',
      sharedEntityId: 'shared-entity-1',
      expectedRevision: 7,
      transform: {
        x: 1,
        y: 0,
        z: -1,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
      },
    });
    assert.equal(state.reloadCount, 1);
    assert.deepEqual(state.toasts, ['共享裝飾位置已更新。']);
    assert.deepEqual(state.pendingStateUpdates, [true, false]);
  });

  it('drops a stale placement draft after a revision conflict and reloads the snapshot', async () => {
    const { dependencies, repository, state } = createDependencies();
    repository.updateTransform = async () => {
      throw new SharedDecorationRepositoryError('revision-conflict', '世界版本已更新。');
    };

    const actions = createChildDecorationActions(dependencies);
    await actions.completeDecorationPlacement();

    assert.equal(state.placement, null);
    assert.equal(state.reloadCount, 1);
    assert.deepEqual(state.pendingStateUpdates, [true, false]);
  });

  it('removes a selected shared placement through the shared repository', async () => {
    const { dependencies, repository, state } = createDependencies();
    let removeInput: unknown;
    repository.remove = async (input) => {
      removeInput = input;
      return { revision: 9 };
    };

    const actions = createChildDecorationActions(dependencies);
    await actions.collectSelectedDecoration('shared-entity-1');

    assert.deepEqual(removeInput, {
      targetWorldOwnerChildProfileId: 'child-owner',
      sharedEntityId: 'shared-entity-1',
      expectedRevision: 7,
    });
    assert.equal(state.reloadCount, 1);
    assert.deepEqual(state.toasts, ['共享裝飾已從這個世界移除。']);
  });

  it('shares a source inventory item using its existing world transform', async () => {
    const { dependencies, repository, state } = createDependencies();
    let placeInput: unknown;
    repository.place = async (input) => {
      placeInput = input;
      return { revision: 13 };
    };

    const actions = createChildDecorationActions(dependencies);
    await actions.shareDecorationWithFriend({
      childProfileId: 'child-target',
      displayName: '小華',
      isOnline: true,
      worldRevision: 12,
    });

    assert.deepEqual(placeInput, {
      targetWorldOwnerChildProfileId: 'child-target',
      sourceInventoryItemId: 'inventory-sofa',
      expectedRevision: 12,
      transform: {
        x: 1,
        y: 0,
        z: -1,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
      },
    });
    assert.deepEqual(state.shareStateUpdates, [null]);
    assert.deepEqual(state.toasts, ['已將沙發分享給小華。']);
  });

  it('submits an owned placement only once when completion is triggered twice', async () => {
    const { dependencies } = createDependencies({
      socialSession: null,
      decorationPlacement: {
        inventoryItemId: 'inventory-sofa',
        catalogItemId: catalogItem.id,
        draft: { x: 1, z: -1, rotationY: 0, scale: 1 },
        placementScope: 'owned',
      },
      placementSubmissionInFlight: { current: false },
    });
    let resolvePlacement: (() => void) | undefined;
    let placeCalls = 0;
    dependencies.placeWorldEntity = async () => {
      placeCalls += 1;
      if (placeCalls === 1) await new Promise<void>((resolve) => { resolvePlacement = resolve; });
      return { revision: 4 };
    };

    const actions = createChildDecorationActions(dependencies);
    const firstSubmission = actions.completeDecorationPlacement();
    const rerenderedActions = createChildDecorationActions(dependencies);
    const duplicateSubmission = rerenderedActions.completeDecorationPlacement();
    resolvePlacement?.();
    await Promise.all([firstSubmission, duplicateSubmission]);

    assert.equal(placeCalls, 1);
  });
});
