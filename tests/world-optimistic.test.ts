import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  patchCollectedWorldDecorations,
  patchPlacedWorldEntity,
  patchRemovedWorldEntity,
  patchUpdatedWorldEntity,
  reconcilePlacedWorldEntity,
} from '../src/features/world/world-optimistic';
import type { ChildGameData, ChildWorldEntity } from '../src/features/world/contracts';

const catalogItem = {
  id: 'decoration.chair',
  itemType: 'decoration' as const,
  name: '木製椅子',
  description: '',
  scrollPrice: 5,
  assetKey: 'decoration.study-chair',
  thumbnailUrl: null,
  isActive: true,
  isStarter: false,
  isStackable: true,
  collisionRadius: 0.48,
  minScale: 0.1,
  maxScale: 0.65,
  sortOrder: 60,
  metadata: {},
};

const inventory = {
  id: 'inventory-chair',
  catalogItemId: catalogItem.id,
  quantity: 2,
  acquiredVia: 'purchase' as const,
  acquiredAt: '2026-08-16T00:00:00.000Z',
  displayName: null,
};

function createGameData(worldEntities: ChildWorldEntity[] = []): ChildGameData {
  return {
    walletBalance: 10,
    catalog: [catalogItem],
    prices: { [catalogItem.id]: 5 },
    inventory: [inventory],
    loadout: null,
    worldEntities,
    worldRevision: 4,
  };
}

describe('optimistic decoration world mutations', () => {
  it('shows a newly placed decoration immediately and reconciles its server id', () => {
    const optimistic = patchPlacedWorldEntity(createGameData(), {
      inventoryItemId: inventory.id,
      expectedRevision: 4,
      transform: { x: 2, y: 0, z: -1.5, rotationX: 0, rotationY: 0.5, rotationZ: 0, scale: 0.1 },
      behaviorMode: 'static',
    }, 'local-decoration-1');
    assert.equal(optimistic.worldRevision, 5);
    assert.deepEqual(optimistic.worldEntities.map((entity) => entity.id), ['local-decoration-1']);
    assert.equal(optimistic.worldEntities[0].scale, 0.1);

    const serverEntity = { ...optimistic.worldEntities[0], id: 'server-decoration-1' };
    const reconciled = reconcilePlacedWorldEntity(optimistic, 'local-decoration-1', {
      revision: 9,
      entity: serverEntity,
    });
    assert.equal(reconciled.worldRevision, 9);
    assert.deepEqual(reconciled.worldEntities.map((entity) => entity.id), ['server-decoration-1']);
  });

  it('updates, removes, and collects local decorations without waiting for refresh', () => {
    const first = patchPlacedWorldEntity(createGameData(), {
      inventoryItemId: inventory.id,
      expectedRevision: 4,
      transform: { x: 2, y: 0, z: -1.5, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 0.36 },
      behaviorMode: 'static',
    }, 'local-decoration-1');
    const updated = patchUpdatedWorldEntity(first, {
      inventoryItemId: inventory.id,
      entityId: 'local-decoration-1',
      expectedRevision: 5,
      transform: { x: -2, y: 0, z: -2, rotationX: 0, rotationY: 1, rotationZ: 0, scale: 0.5 },
    });
    assert.equal(updated.worldEntities[0].x, -2);
    assert.equal(updated.worldEntities[0].scale, 0.5);
    const removed = patchRemovedWorldEntity(updated, inventory.id, 'local-decoration-1');
    assert.equal(removed.worldEntities[0].isActive, false);

    const second = patchPlacedWorldEntity(removed, {
      inventoryItemId: inventory.id,
      expectedRevision: removed.worldRevision,
      transform: { x: 2, y: 2, z: 2, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 0.36 },
      behaviorMode: 'static',
    }, 'local-decoration-2');
    const collected = patchCollectedWorldDecorations(second);
    assert.equal(collected.worldEntities.every((entity) => !entity.isActive), true);
  });
});
