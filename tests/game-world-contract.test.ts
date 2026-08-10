import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toWorldMutationPayload } from '../src/features/world/contracts';

describe('game world mutation contract', () => {
  it('always carries an expected revision and never accepts a client price', () => {
    const payload = toWorldMutationPayload({
      inventoryItemId: 'inventory-1',
      expectedRevision: 4,
      transform: { x: 1, y: 0, z: -1, rotationX: 0, rotationY: 1, rotationZ: 0, scale: 1.2 },
      behaviorMode: 'wander',
      roamingSlot: 2,
    });
    assert.deepEqual(payload, {
      target_inventory_item_id: 'inventory-1',
      expected_revision: 4,
      position_x: 1,
      position_y: 0,
      position_z: -1,
      rotation_x: 0,
      rotation_y: 1,
      rotation_z: 0,
      scale: 1.2,
      target_behavior_mode: 'wander',
      target_roaming_slot: 2,
    });
    assert.equal('price' in payload, false);
  });
});
