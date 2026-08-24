import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  patchCollectedWorldDecorations,
  patchPlacedWorldEntity,
  patchRemovedWorldEntity,
  patchUpdatedWorldEntity,
  reconcilePlacedWorldEntity,
  reconcileUpdatedWorldEntity,
} from '../src/features/world/world-optimistic';
import type { ChildGameData, ChildWorldEntity } from '../src/features/world/contracts';
import { toWorldMutationResult } from '../src/lib/data-access';

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
  it('returns only the revision when a world mutation has no entity', () => {
    assert.deepEqual(toWorldMutationResult({ revision: 8 }), { revision: 8 });
  });

  it('uses safe defaults for unknown entity fields and omitted active state', () => {
    const result = toWorldMutationResult({
      revision: 8,
      entity: {
        id: 'server-decoration-fallback',
        inventory_item_id: inventory.id,
        entity_kind: 'unknown-kind',
        world_layout_version: 1,
        position_x: 0,
        position_y: 0,
        position_z: 0,
        rotation_x: 0,
        rotation_y: 0,
        rotation_z: 0,
        scale: 1,
        behavior_mode: 'unknown-mode',
        roaming_slot: null,
      },
    });

    assert.equal(result.entity?.entityKind, 'decoration');
    assert.equal(result.entity?.behaviorMode, 'static');
    assert.equal(result.entity?.roamingSlot, null);
    assert.equal(result.entity?.isActive, true);
  });

  it('normalizes the snake_case entity returned by the world RPC', () => {
    const result = toWorldMutationResult({
      revision: 6,
      entity: {
        id: 'server-decoration-1',
        inventory_item_id: inventory.id,
        entity_kind: 'decoration',
        world_layout_version: 1,
        position_x: 2,
        position_y: 0,
        position_z: -1.5,
        rotation_x: 0,
        rotation_y: 0.5,
        rotation_z: 0,
        scale: 0.1,
        behavior_mode: 'static',
        roaming_slot: null,
        is_active: true,
      },
    });
    assert.equal(result.entity?.inventoryItemId, inventory.id);
    assert.equal(result.entity?.x, 2);
    assert.equal(result.entity?.isActive, true);
    assert.equal(result.entity?.scale, 0.1);
  });

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

  it('does not collect shared decorations through the native collect-all patch', () => {
    const gameData = createGameData([
      { id: 'owned', inventoryItemId: 'owned-inventory', entityKind: 'decoration', worldLayoutVersion: 1, x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, behaviorMode: 'static', roamingSlot: null, isActive: true },
      { id: 'shared', inventoryItemId: 'source-inventory', entityKind: 'decoration', placementScope: 'shared', worldLayoutVersion: 1, x: 1, y: 0, z: 1, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, behaviorMode: 'static', roamingSlot: null, isActive: true },
    ]);
    const collected = patchCollectedWorldDecorations(gameData);
    assert.equal(collected.worldEntities.find((entity) => entity.id === 'owned')?.isActive, false);
    assert.equal(collected.worldEntities.find((entity) => entity.id === 'shared')?.isActive, true);
  });

  it('reconciles an updated decoration without dropping its scene metadata', () => {
    const existingEntity: ChildWorldEntity = {
      id: 'server-decoration-1',
      inventoryItemId: inventory.id,
      entityKind: 'decoration',
      worldLayoutVersion: 1,
      x: 2,
      y: 0,
      z: -1.5,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scale: 0.36,
      behaviorMode: 'static',
      roamingSlot: null,
      isActive: true,
      catalogItemId: catalogItem.id,
      collisionRadius: catalogItem.collisionRadius,
      assetKey: catalogItem.assetKey,
      name: catalogItem.name,
    };
    const optimistic = patchUpdatedWorldEntity(createGameData([existingEntity]), {
      inventoryItemId: inventory.id,
      entityId: existingEntity.id,
      expectedRevision: 4,
      transform: { x: -2, y: 0, z: -2, rotationX: 0, rotationY: 1, rotationZ: 0, scale: 0.5 },
    });
    const serverResult = toWorldMutationResult({
      revision: 6,
      entity: {
        id: existingEntity.id,
        inventory_item_id: inventory.id,
        entity_kind: 'decoration',
        world_layout_version: 1,
        position_x: -2,
        position_y: 0,
        position_z: -2,
        rotation_x: 0,
        rotation_y: 1,
        rotation_z: 0,
        scale: 0.5,
        behavior_mode: 'static',
        roaming_slot: null,
        is_active: true,
      },
    });
    const reconciled = reconcileUpdatedWorldEntity(optimistic, serverResult);
    assert.equal(reconciled.worldRevision, 6);
    assert.equal(reconciled.worldEntities[0].x, -2);
    assert.equal(reconciled.worldEntities[0].scale, 0.5);
    assert.equal(reconciled.worldEntities[0].catalogItemId, catalogItem.id);
    assert.equal(reconciled.worldEntities[0].assetKey, catalogItem.assetKey);
    assert.equal(reconciled.worldEntities[0].collisionRadius, catalogItem.collisionRadius);
    assert.equal(reconciled.worldEntities[0].name, catalogItem.name);
  });
});
