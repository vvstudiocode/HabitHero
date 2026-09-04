import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findWorldNpcPetSpawnPosition,
  isWorldNpcPetPositionAvailable,
} from '../src/features/world/world-npc-spawn';
import { createWanderState, getWanderStep } from '../src/features/world/world-roaming';

const npc = {
  position: { x: 0, y: 0, z: 0 },
  roamBounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 },
};

test('finds a nearby pet spawn that is clear of obstacles and inside its roam area', () => {
  const spawn = findWorldNpcPetSpawnPosition({
    wanderObstacles: [{ x: 0, z: 0, radius: 0.8 }],
    walkableBoundary: 4,
    isPetPositionWalkable: () => true,
  }, npc, 0.35);

  assert.ok(Math.abs(spawn.x) <= 1.65);
  assert.ok(Math.abs(spawn.z) <= 1.65);
  assert.equal(isWorldNpcPetPositionAvailable({
    wanderObstacles: [{ x: 0, z: 0, radius: 0.8 }],
    walkableBoundary: 4,
    isPetPositionWalkable: () => true,
  }, npc, spawn, 0.35), true);
});

test('rejects positions outside the authored map or on a non-walkable surface', () => {
  const options = {
    wanderObstacles: [],
    walkableBoundary: 4,
    walkableRadialBoundary: { center: { x: 0, z: 0 }, radii: Array(72).fill(2) },
    isPetPositionWalkable: (position: { x: number; z: number }) => position.z >= 0,
  };

  assert.equal(isWorldNpcPetPositionAvailable(options, npc, { x: 1.6, z: 0 }, 0.2), true);
  assert.equal(isWorldNpcPetPositionAvailable(options, npc, { x: 1.95, z: 0 }, 0.2), false);
  assert.equal(isWorldNpcPetPositionAvailable(options, npc, { x: 0, z: -1 }, 0.2), false);
});

test('keeps each wander step inside a scene-sized radial walkable boundary', () => {
  const radialBoundary = { center: { x: 0, z: 0 }, radii: Array(72).fill(2) };
  const state = createWanderState(42, { x: 1, z: 0 });
  state.nextPauseAt = Number.POSITIVE_INFINITY;
  state.nextTurnAt = Number.POSITIVE_INFINITY;
  state.nextExploreAt = Number.POSITIVE_INFINITY;
  let current = { x: 1.5, z: 0 };

  for (let index = 0; index < 80; index += 1) {
    const step = getWanderStep(
      current,
      0.2,
      0.2,
      1,
      [],
      state,
      index,
      { min: 0, max: 0 },
      3,
      radialBoundary,
    );
    assert.equal(isWorldNpcPetPositionAvailable({
      wanderObstacles: [],
      walkableBoundary: 3,
      walkableRadialBoundary: radialBoundary,
      isPetPositionWalkable: () => true,
    }, { roamBounds: undefined }, step.next, 0.2), true);
    current = step.next;
  }
});
