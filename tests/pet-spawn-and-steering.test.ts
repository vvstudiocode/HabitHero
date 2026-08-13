import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  getDistributedPetSpawnPosition,
  getPetNavigationRadius,
} from '../src/features/world/pet-spawning';
import {
  createWanderState,
  getWanderStep,
  hashWanderSeed,
} from '../src/features/world/world-roaming';

const runtimeSource = readFileSync(
  join(process.cwd(), 'src/features/world/prototype-world-runtime.ts'),
  'utf8',
);

describe('pet spawn distribution and stable steering', () => {
  it('spreads login positions across both world axes without overlap', () => {
    const occupied = [{ x: 0, z: 2.2, radius: 0.8 }];
    const spawns = Array.from({ length: 8 }, (_, index) => {
      const spawn = getDistributedPetSpawnPosition(index, 0.38, occupied);
      occupied.push({ ...spawn, radius: 0.38 });
      return spawn;
    });

    assert.ok(new Set(spawns.map((spawn) => spawn.x)).size >= 4);
    assert.ok(new Set(spawns.map((spawn) => spawn.z)).size >= 4);
    for (let left = 0; left < spawns.length; left += 1) {
      for (let right = left + 1; right < spawns.length; right += 1) {
        assert.ok(Math.hypot(spawns[left].x - spawns[right].x, spawns[left].z - spawns[right].z) > 0.76);
      }
    }
  });

  it('keeps navigation radius independent from visual enlargement', () => {
    assert.equal(getPetNavigationRadius(0.38, 1), 0.38);
    assert.ok(Math.abs(getPetNavigationRadius(0.38, 1.2) - 0.456) < 1e-9);
    assert.doesNotMatch(runtimeSource, /const petRadius = [^;]*petWorldScale/);
  });

  it('does not accumulate repeated full circles near a large obstacle', () => {
    const state = createWanderState(hashWanderSeed('pet:tiger'), { x: 0, z: 1 });
    const obstacles = [{ x: 0, z: 2.2, radius: 0.8 }];
    let position = { x: -1.5, z: -3.5 };
    let previousAngle = Math.atan2(state.facing.x, state.facing.z);
    let accumulatedTurn = 0;

    for (let frame = 0; frame < 600; frame += 1) {
      const step = getWanderStep(position, 0.05, 1, 0.5, obstacles, state, frame * 0.05);
      const angle = Math.atan2(step.facing.x, step.facing.z);
      accumulatedTurn += Math.abs(Math.atan2(Math.sin(angle - previousAngle), Math.cos(angle - previousAngle)));
      previousAngle = angle;
      position = step.next;
    }

    assert.ok(accumulatedTurn < Math.PI * 2 * 3.2, `turned ${(accumulatedTurn / (Math.PI * 2)).toFixed(2)} circles`);
  });

  it('explores beyond a small local loop on both world axes', () => {
    const state = createWanderState(hashWanderSeed('pet:fox'), { x: 0, z: 1 });
    const obstacles = [{ x: 0, z: 2.2, radius: 0.8 }];
    let position = { x: -2.8, z: -2.8 };
    let minimumX = position.x;
    let maximumX = position.x;
    let minimumZ = position.z;
    let maximumZ = position.z;

    for (let frame = 0; frame < 600; frame += 1) {
      const step = getWanderStep(position, 0.05, 0.38, 0.5, obstacles, state, frame * 0.05);
      position = step.next;
      minimumX = Math.min(minimumX, position.x);
      maximumX = Math.max(maximumX, position.x);
      minimumZ = Math.min(minimumZ, position.z);
      maximumZ = Math.max(maximumZ, position.z);
    }

    assert.ok(maximumX - minimumX >= 3.5, `x range was ${(maximumX - minimumX).toFixed(2)}`);
    assert.ok(maximumZ - minimumZ >= 3.5, `z range was ${(maximumZ - minimumZ).toFixed(2)}`);
  });

  it('abandons an exploration target instead of staying blocked against the tree', () => {
    const state = createWanderState(hashWanderSeed('pet:tiger'), { x: 0, z: 1 });
    const obstacles = [{ x: 0, z: 2.2, radius: 0.8 }];
    let position = { x: -3.2, z: -2.8 };
    let blockedFrames = 0;
    let consecutiveBlockedFrames = 0;
    let longestBlockedRun = 0;

    for (let frame = 0; frame < 1200; frame += 1) {
      const step = getWanderStep(position, 0.05, 0.38, 0.5, obstacles, state, frame * 0.05);
      position = step.next;
      consecutiveBlockedFrames = step.blocked ? consecutiveBlockedFrames + 1 : 0;
      if (step.blocked) blockedFrames += 1;
      longestBlockedRun = Math.max(longestBlockedRun, consecutiveBlockedFrames);
    }

    assert.ok(blockedFrames < 60, `blocked for ${blockedFrames} frames`);
    assert.ok(longestBlockedRun < 20, `blocked for ${longestBlockedRun} consecutive frames`);
  });

  it('smoothly rotates roaming pet models instead of snapping every frame', () => {
    assert.match(runtimeSource, /actor\.object\.rotation\.y \+= yawDelta \* Math\.min\(1, delta \* 6\)/);
    assert.doesNotMatch(runtimeSource, /actor\.object\.rotation\.y = Math\.atan2\(step\.facing\.x, step\.facing\.z\)/);
  });
});
