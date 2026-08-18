import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appendFollowingTrailSample,
  getFollowingDistance,
  getFollowingStep,
  getFollowingTrailTarget,
  getFollowingTarget,
  PET_FOLLOW_CLEARANCE,
  PET_FOLLOW_DISTANCE,
  PET_FOLLOW_SPACING,
  PET_FOLLOW_SPEED,
  PET_FOLLOW_STOP_DISTANCE,
} from '../src/features/world/pet-following';

describe('pet following movement', () => {
  it('uses compact collision-safe follow spacing and a slower pet speed', () => {
    assert.equal(PET_FOLLOW_SPEED, 0.75);
    assert.equal(PET_FOLLOW_DISTANCE, 0.12);
    assert.equal(PET_FOLLOW_SPACING, 0.16);
    assert.equal(PET_FOLLOW_CLEARANCE, 0.04);
    assert.equal(PET_FOLLOW_STOP_DISTANCE, 0.18);
  });

  it('keeps the pet on its current side instead of using the player facing direction', () => {
    const current = { x: 2, z: 2.8 };
    assert.deepEqual(
      getFollowingTarget(current, { position: { x: 2, z: 2 }, facing: { x: 0, z: 1 } }, PET_FOLLOW_DISTANCE),
      { x: 2, z: 2 + PET_FOLLOW_DISTANCE },
    );
    assert.deepEqual(
      getFollowingTarget(current, { position: { x: 2, z: 2 }, facing: { x: 0, z: -1 } }, PET_FOLLOW_DISTANCE),
      { x: 2, z: 2 + PET_FOLLOW_DISTANCE },
    );
  });

  it('does not move a nearby pet just to place it behind a turning player', () => {
    const step = getFollowingStep(
      { x: 0, z: 0.5 },
      { position: { x: 0, z: 0 }, facing: { x: 0, z: -1 } },
      0.1,
      0.3,
    );

    assert.deepEqual(step.next, { x: 0, z: 0.5 });
    assert.deepEqual(step.target, step.next);
    assert.equal(step.arrived, true);
    assert.equal(step.rerouted, false);
  });

  it('moves toward the pet-side position instead of teleporting or orbiting in place', () => {
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

  it('keeps the same direct route when the player turns', () => {
    const current = { x: 0, z: 1.35 };
    const beforeTurn = getFollowingStep(
      current,
      { position: { x: 0, z: 0 }, facing: { x: 0, z: 1 } },
      0.2,
      0.3,
    );
    const afterTurn = getFollowingStep(
      current,
      { position: { x: 0, z: 0 }, facing: { x: 0, z: -1 } },
      0.2,
      0.3,
    );

    assert.deepEqual(afterTurn.target, beforeTurn.target);
    assert.deepEqual(afterTurn.next, beforeTurn.next);
    assert.equal(afterTurn.rerouted, false);
    assert.ok(afterTurn.next.z < current.z);
  });

  it('builds a trail only from actual movement and keeps its target stable while the leader turns', () => {
    const trail: Array<{ x: number; z: number }> = [];
    appendFollowingTrailSample(trail, { x: 0, z: 0 });
    appendFollowingTrailSample(trail, { x: 0, z: 0.4 });
    const beforeTurn = getFollowingTrailTarget(trail, { x: 0, z: 0.4 }, 0.2);
    const afterTurn = getFollowingTrailTarget(trail, { x: 0, z: 0.4 }, 0.2);

    assert.deepEqual(trail, [{ x: 0, z: 0.4 }, { x: 0, z: 0 }]);
    assert.deepEqual(afterTurn, beforeTurn);
    assert.deepEqual(afterTurn, { x: 0, z: 0.2 });
  });

  it('lets each pet read the previous actor trail so turns are staggered', () => {
    const firstPetTrail: Array<{ x: number; z: number }> = [
      { x: 0.4, z: 0 },
      { x: 0, z: 0 },
    ];
    const secondPetTrail: Array<{ x: number; z: number }> = [
      { x: 0, z: 0 },
      { x: 0, z: -0.4 },
    ];

    const firstPetTarget = getFollowingTrailTarget(firstPetTrail, { x: 0.4, z: 0 }, 0.2);
    const secondPetTarget = getFollowingTrailTarget(secondPetTrail, { x: 0, z: 0 }, 0.2);

    assert.deepEqual(firstPetTarget, { x: 0.2, z: 0 });
    assert.deepEqual(secondPetTarget, { x: 0, z: -0.2 });
    assert.notDeepEqual(firstPetTarget, secondPetTarget);
  });

  it('stops instead of crossing the leader when a reverse target is on the other side', () => {
    const current = { x: 0, z: -1 };
    const step = getFollowingStep(
      current,
      { position: { x: 0, z: 0 }, facing: { x: 0, z: -1 } },
      0.2,
      0.3,
      PET_FOLLOW_SPEED,
      [],
      0.35,
      getFollowingDistance(0),
      { x: 0, z: 1 },
    );

    assert.deepEqual(step.next, current);
    assert.equal(step.arrived, false);
    assert.equal(step.blocked, true);
    assert.equal(step.rerouted, false);
  });

  it('keeps each follow link close to the collision boundary with only a small gap', () => {
    const firstPet = getFollowingStep(
      { x: 2, z: 0 },
      { position: { x: 0, z: 0 }, facing: { x: 0, z: 1 } },
      0.1,
      0.3,
      PET_FOLLOW_SPEED,
      [],
      0.35,
      getFollowingDistance(0),
    );
    const secondPet = getFollowingStep(
      { x: 2, z: 0 },
      { position: { x: 0, z: 0 }, facing: { x: 0, z: 1 } },
      0.1,
      0.3,
      PET_FOLLOW_SPEED,
      [],
      0.3,
      getFollowingDistance(1),
    );

    assert.ok(Math.abs(firstPet.target.x - (0.35 + 0.3 + PET_FOLLOW_CLEARANCE)) < 0.0001);
    assert.ok(Math.abs(secondPet.target.x - (0.3 + 0.3 + PET_FOLLOW_CLEARANCE)) < 0.0001);
  });
});
