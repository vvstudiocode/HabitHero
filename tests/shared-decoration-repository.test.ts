import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSharedDecorationRepository, SharedDecorationRepositoryError } from '../src/lib/social-data/shared-decoration-repository';

function mutationEntity() {
  return {
    id: 'shared-entity-1',
    entity_kind: 'decoration',
    asset_key: 'decoration.sofa',
    position_x: 1,
    position_y: 0,
    position_z: -1,
    rotation_x: 0,
    rotation_y: 0.2,
    rotation_z: 0,
    scale: 1,
    behavior_mode: 'static',
    placement_scope: 'shared',
    can_transform: true,
    can_remove: true,
    shared_by_me: true,
  };
}

describe('shared decoration repository', () => {
  it('uses typed RPCs and sends one transform payload at confirmation time', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: { revision: 9, entity: mutationEntity() }, error: null };
      },
    };
    const repository = createSharedDecorationRepository(client as never);

    const result = await repository.place({
      targetWorldOwnerChildProfileId: 'owner-child',
      sourceInventoryItemId: 'inventory-sofa',
      expectedRevision: 8,
      transform: { x: 1, y: 0, z: -1, rotationX: 0, rotationY: 0.2, rotationZ: 0, scale: 1 },
    });

    assert.equal(result.revision, 9);
    assert.deepEqual(calls, [{
      name: 'place_shared_world_decoration',
      args: {
        target_world_owner_child_profile_id: 'owner-child',
        source_inventory_item_id: 'inventory-sofa',
        expected_revision: 8,
        position_x: 1,
        position_y: 0,
        position_z: -1,
        rotation_x: 0,
        rotation_y: 0.2,
        rotation_z: 0,
        scale: 1,
      },
    }]);
  });

  it('does not accept source identity for transform or removal routes', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: { revision: 10 }, error: null };
      },
    };
    const repository = createSharedDecorationRepository(client as never);

    await repository.updateTransform({
      targetWorldOwnerChildProfileId: 'owner-child',
      sharedEntityId: 'shared-entity-1',
      expectedRevision: 9,
      transform: { x: 2, y: 0, z: -2, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1 },
    });
    await repository.remove({ targetWorldOwnerChildProfileId: 'owner-child', sharedEntityId: 'shared-entity-1', expectedRevision: 10 });

    assert.deepEqual(calls, [
      {
        name: 'update_shared_world_decoration_transform',
        args: {
          target_world_owner_child_profile_id: 'owner-child',
          shared_entity_id: 'shared-entity-1',
          expected_revision: 9,
          position_x: 2,
          position_y: 0,
          position_z: -2,
          rotation_x: 0,
          rotation_y: 0,
          rotation_z: 0,
          scale: 1,
        },
      },
      {
        name: 'remove_shared_world_decoration',
        args: {
          target_world_owner_child_profile_id: 'owner-child',
          shared_entity_id: 'shared-entity-1',
          expected_revision: 10,
        },
      },
    ]);
    assert.equal('source_child_profile_id' in calls[0]!.args, false);
  });

  it('maps server failures to safe product errors without exposing SQL details', async () => {
    const client = {
      rpc: async () => ({ data: null, error: { message: 'world revision conflict: private constraint detail' } }),
    };
    const repository = createSharedDecorationRepository(client as never);

    await assert.rejects(
      () => repository.collect({ targetWorldOwnerChildProfileId: 'owner-child', expectedRevision: 3 }),
      (error: unknown) => error instanceof SharedDecorationRepositoryError
        && error.code === 'revision-conflict'
        && error.message === '世界剛被好友更新，請重新確認位置。'
        && !error.message.includes('private constraint'),
    );
  });

  it('rejects unsafe client inputs before making an RPC call', async () => {
    let callCount = 0;
    const client = { rpc: async () => { callCount += 1; return { data: { revision: 1 }, error: null }; } };
    const repository = createSharedDecorationRepository(client as never);

    await assert.rejects(() => repository.place({
      targetWorldOwnerChildProfileId: 'owner-child',
      sourceInventoryItemId: 'inventory-sofa',
      expectedRevision: 1,
      transform: { x: Number.NaN, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1 },
    }), /裝飾座標無效/);
    assert.equal(callCount, 0);
  });
});
