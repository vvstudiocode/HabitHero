import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSharedDecorationSceneData } from '../src/features/shared-decorations/scene-adapter';
import type { FriendWorldSnapshotEntity } from '../src/features/friends/friend-world-snapshot';
import type { GameCatalogItem } from '../src/features/world/contracts';

function catalogItem(assetKey: string): GameCatalogItem {
  return {
    id: `catalog:${assetKey}`,
    itemType: 'decoration',
    name: assetKey,
    description: '',
    scrollPrice: 0,
    assetKey,
    thumbnailUrl: null,
    isActive: true,
    isStarter: false,
    isStackable: true,
    collisionRadius: 0.4,
    minScale: 0.5,
    maxScale: 2,
    sortOrder: 1,
    metadata: { primitive: 'decoration' },
  };
}

function entity(overrides: Partial<FriendWorldSnapshotEntity> = {}): FriendWorldSnapshotEntity {
  return {
    id: 'shared-1',
    entityKind: 'decoration',
    assetKey: 'decoration.sofa',
    x: 1,
    y: 0,
    z: -1,
    rotationX: 0,
    rotationY: 0.2,
    rotationZ: 0,
    scale: 1,
    behaviorMode: 'static',
    placementScope: 'shared',
    canTransform: false,
    canRemove: false,
    sharedByMe: false,
    ...overrides,
  };
}

describe('shared decoration scene adapter', () => {
  it('creates render-only synthetic scene references without changing global game data', () => {
    const catalog = [catalogItem('decoration.sofa')];
    const sourceEntities = [entity()];
    const scene = createSharedDecorationSceneData({ entities: sourceEntities, catalog });

    assert.deepEqual(scene.catalog, catalog);
    assert.deepEqual(scene.inventory, [{
      id: 'shared-decoration-inventory:shared-1',
      catalogItemId: 'catalog:decoration.sofa',
      quantity: 1,
      acquiredVia: 'grant',
      acquiredAt: new Date(0).toISOString(),
    }]);
    assert.deepEqual(scene.worldEntities, [{
      id: 'shared-1',
      inventoryItemId: 'shared-decoration-inventory:shared-1',
      entityKind: 'decoration',
      worldLayoutVersion: 1,
      behaviorMode: 'static',
      roamingSlot: null,
      isActive: true,
      catalogItemId: 'catalog:decoration.sofa',
      assetKey: 'decoration.sofa',
      name: 'decoration.sofa',
      x: 1,
      y: 0,
      z: -1,
      rotationX: 0,
      rotationY: 0.2,
      rotationZ: 0,
      scale: 1,
    }]);
    assert.equal(sourceEntities[0]?.placementScope, 'shared');
  });

  it('ignores non-decoration, inactive, and missing local assets safely', () => {
    const scene = createSharedDecorationSceneData({
      catalog: [catalogItem('decoration.sofa')],
      entities: [
        entity({ id: 'pet', entityKind: 'pet' }),
        entity({ id: 'owned', placementScope: 'owned' }),
        entity({ id: 'missing', assetKey: 'decoration.missing' }),
      ],
    });

    assert.equal(scene.worldEntities.length, 0);
    assert.equal(scene.inventory.length, 0);
    assert.equal(scene.catalog.length, 0);
  });

  it('does not return inactive catalog assets to the scene', () => {
    const inactive = { ...catalogItem('decoration.sofa'), isActive: false };
    const scene = createSharedDecorationSceneData({ entities: [entity()], catalog: [inactive] });
    assert.deepEqual(scene, { catalog: [], inventory: [], worldEntities: [] });
  });
});
