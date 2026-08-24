import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeFriendWorldSnapshot } from '../src/features/friends/friend-world-snapshot';
import { normalizeSharedDecorationMutationResult } from '../src/features/shared-decorations/normalization';

function sharedEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shared-entity-1',
    entity_kind: 'decoration',
    asset_key: 'decoration.sofa',
    position_x: 1,
    position_y: 0,
    position_z: -1,
    rotation_x: 0,
    rotation_y: 0.25,
    rotation_z: 0,
    scale: 1,
    behavior_mode: 'static',
    placement_scope: 'shared',
    can_transform: true,
    can_remove: true,
    shared_by_me: true,
    shared_source_display_name: '小明',
    ...overrides,
  };
}

describe('shared decoration contracts', () => {
  it('defaults missing server capability fields closed for legacy friend snapshots', () => {
    const snapshot = normalizeFriendWorldSnapshot({
      world_owner_child_profile_id: 'owner-child',
      display_name: '小華',
      character_asset_key: 'character.noah',
      revision: 4,
      entities: [{
        id: 'owned-decoration',
        entity_kind: 'decoration',
        asset_key: 'decoration.desk',
        position_x: 0,
        position_y: 0,
        position_z: 0,
        rotation_x: 0,
        rotation_y: 0,
        rotation_z: 0,
        scale: 1,
        behavior_mode: 'static',
      }],
    });

    assert.equal(snapshot.canShareDecorations, false);
    assert.equal(snapshot.entities[0]?.placementScope, 'owned');
    assert.equal(snapshot.entities[0]?.canTransform, false);
    assert.equal(snapshot.entities[0]?.canRemove, false);
    assert.equal(snapshot.entities[0]?.sharedByMe, false);
  });

  it('keeps only server-provided shared decoration capability projection', () => {
    const snapshot = normalizeFriendWorldSnapshot({
      world_owner_child_profile_id: 'owner-child',
      display_name: '小華',
      character_asset_key: 'character.noah',
      revision: 5,
      can_share_decorations: true,
      entities: [sharedEntity()],
    });

    assert.equal(snapshot.canShareDecorations, true);
    assert.deepEqual(snapshot.entities[0], {
      id: 'shared-entity-1',
      entityKind: 'decoration',
      assetKey: 'decoration.sofa',
      x: 1,
      y: 0,
      z: -1,
      rotationX: 0,
      rotationY: 0.25,
      rotationZ: 0,
      scale: 1,
      behaviorMode: 'static',
      placementScope: 'shared',
      canTransform: true,
      canRemove: true,
      sharedByMe: true,
      sharedSourceDisplayName: '小明',
    });
  });

  it('rejects malformed server capability values instead of granting access', () => {
    assert.throws(
      () => normalizeFriendWorldSnapshot({
        world_owner_child_profile_id: 'owner-child',
        display_name: '小華',
        character_asset_key: 'character.noah',
        revision: 5,
        can_share_decorations: 'true',
        entities: [],
      }),
      /can_share_decorations/,
    );
    assert.throws(
      () => normalizeFriendWorldSnapshot({
        world_owner_child_profile_id: 'owner-child',
        display_name: '小華',
        character_asset_key: 'character.noah',
        revision: 5,
        entities: [sharedEntity({ can_transform: 'true' })],
      }),
      /can_transform/,
    );
  });

  it('normalizes a mutation result without exposing ownership or inventory data', () => {
    const result = normalizeSharedDecorationMutationResult({
      revision: '8',
      entity: sharedEntity({
        source_child_profile_id: 'must-not-leak',
        source_inventory_item_id: 'must-not-leak',
        quantity: 99,
      }),
    });

    assert.equal(result.revision, 8);
    assert.equal(result.entity?.id, 'shared-entity-1');
    assert.equal('sourceChildProfileId' in (result.entity ?? {}), false);
    assert.equal('sourceInventoryItemId' in (result.entity ?? {}), false);
    assert.equal('quantity' in (result.entity ?? {}), false);
  });

  it('fails closed when a mutation response has an invalid revision or entity', () => {
    assert.throws(
      () => normalizeSharedDecorationMutationResult({ revision: -1 }),
      /revision/,
    );
    assert.throws(
      () => normalizeSharedDecorationMutationResult({ revision: 2, entity: { ...sharedEntity(), scale: 'large' } }),
      /scale/,
    );
  });
});
