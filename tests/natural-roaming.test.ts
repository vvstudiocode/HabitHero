import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createWanderState,
  getWanderStep,
  hashWanderSeed,
} from '../src/features/world/world-roaming';
import { WORLD_BOUNDARY } from '../src/features/world/world-collision';

describe('natural roaming steering', () => {
  it('starts turning inward before a pet reaches the hard world boundary', () => {
    const state = createWanderState(hashWanderSeed('tiger'), { x: 1, z: 0 });
    const current = { x: WORLD_BOUNDARY - 0.62, z: 0 };
    const step = getWanderStep(current, 0.1, 0.34, 0.5, [], state, 0.1);

    assert.equal(step.walking, true);
    assert.ok(step.facing.x < 0, `expected an inward turn, got ${step.facing.x}`);
    assert.ok(Math.abs(step.next.x) + 0.34 < WORLD_BOUNDARY - 0.01);
  });

  it('keeps nearby obstacle avoidance smooth instead of waiting for a blocked step', () => {
    const state = createWanderState(hashWanderSeed('fox'), { x: 1, z: 0 });
    const current = { x: -1.3, z: 0 };
    const obstacle = { x: 0, z: 0, radius: 0.8 };
    const step = getWanderStep(current, 0.1, 0.34, 0.5, [obstacle], state, 0.1);

    assert.equal(step.blocked, false);
    assert.ok(Math.abs(step.facing.z) > 0.01, `expected a curved path, got z=${step.facing.z}`);
    assert.ok(Math.hypot(step.next.x - obstacle.x, step.next.z - obstacle.z) > obstacle.radius + 0.34);
  });

  it('gives each actor an independent but deterministic wander stream', () => {
    const first = createWanderState(hashWanderSeed('first'), { x: 0, z: 1 });
    const second = createWanderState(hashWanderSeed('second'), { x: 0, z: 1 });
    const firstAgain = createWanderState(hashWanderSeed('first'), { x: 0, z: 1 });
    const firstStep = getWanderStep({ x: 0, z: 0 }, 0.1, 0.34, 0.5, [], first, 0.1);
    const secondStep = getWanderStep({ x: 0, z: 0 }, 0.1, 0.34, 0.5, [], second, 0.1);
    const firstAgainStep = getWanderStep({ x: 0, z: 0 }, 0.1, 0.34, 0.5, [], firstAgain, 0.1);

    assert.notDeepEqual(firstStep.facing, secondStep.facing);
    assert.deepEqual(firstStep, firstAgainStep);
  });

  it('can pause in a safe location without treating the pause as a collision', () => {
    const state = createWanderState(hashWanderSeed('pause'), { x: 0, z: 1 });
    state.nextPauseAt = 0;
    const current = { x: 0, z: 0 };
    const step = getWanderStep(current, 0.1, 0.34, 0.5, [], state, 1);

    assert.equal(step.walking, false);
    assert.equal(step.blocked, false);
    assert.deepEqual(step.next, current);
  });
});
