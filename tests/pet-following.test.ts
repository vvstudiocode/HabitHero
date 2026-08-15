import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getFollowingStep,
  getFollowingTarget,
  PET_FOLLOW_DISTANCE,
  PET_FOLLOW_SPACING,
  PET_FOLLOW_SPEED,
  PET_FOLLOW_STOP_DISTANCE,
} from '../src/features/world/pet-following';

describe('pet following movement', () => {
  it('uses a slower pet speed and a closer trailing target', () => {
    assert.equal(PET_FOLLOW_SPEED, 0.75);
    assert.equal(PET_FOLLOW_DISTANCE, 0.24);
    assert.equal(PET_FOLLOW_SPACING, 0.31);
    assert.equal(PET_FOLLOW_STOP_DISTANCE, 0.18);
  });

  it('keeps the pet behind the player based on the player facing direction', () => {
    assert.deepEqual(
      getFollowingTarget({ position: { x: 2, z: 2 }, facing: { x: 0, z: 1 } }),
      { x: 2, z: 2 - PET_FOLLOW_DISTANCE },
    );
    assert.deepEqual(
      getFollowingTarget({ position: { x: 2, z: 2 }, facing: { x: 0, z: -1 } }),
      { x: 2, z: 2 + PET_FOLLOW_DISTANCE },
    );
  });

  it('moves toward the trailing position instead of teleporting or orbiting in place', () => {
    const step = getFollowingStep(
      { x: 1.8, z: 0 },
      { position: { x: 0, z: 0 }, facing: { x: 0, z: 1 } },
      0.1,
      0.3,
    );

    assert.ok(step.next.x < 1.8);
    assert.equal(step.blocked, false);
    assert.equal(step.rerouted, false);
  });

  it('routes around the player when the player turns and the new rear point is across them', () => {
    const step = getFollowingStep(
      { x: 0, z: 1.35 },
      { position: { x: 0, z: 0 }, facing: { x: 0, z: 1 } },
      0.2,
      0.3,
    );

    assert.equal(step.rerouted, true);
    assert.ok(Math.abs(step.next.x) > 0);
    assert.ok(step.next.z > 0);
  });
});
