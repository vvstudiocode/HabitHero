import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CENTRAL_TREE_KEEP_OUT, CHARACTER_SPAWN, WORLD_BOUNDARY, isTransformWithinWorld, moveWorldCharacter } from '../src/features/world/world-collision';

const valid = { x: 2, y: 0, z: 2, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1 };

describe('world collision contract', () => {
  it('accepts bounded transforms and rejects invalid scale', () => {
    assert.equal(isTransformWithinWorld(valid, 0.3), true);
    assert.equal(isTransformWithinWorld({ ...valid, scale: 3.1 }, 0.3), false);
    assert.equal(isTransformWithinWorld({ ...valid, x: 4.8 }, 0.3), false);
  });

  it('protects the spawn point and keeps the outer tree proxy beyond the movement boundary', () => {
    assert.equal(isTransformWithinWorld({ ...valid, x: CHARACTER_SPAWN.x, z: CHARACTER_SPAWN.z }, 0.3), false);
    assert.ok(CENTRAL_TREE_KEEP_OUT.z + CENTRAL_TREE_KEEP_OUT.radius < -WORLD_BOUNDARY);
    assert.equal(CENTRAL_TREE_KEEP_OUT.radius, 2);
  });

  it('rejects overlapping decoration footprints after scale is applied', () => {
    assert.equal(isTransformWithinWorld(valid, 0.5, [{ x: 2.45, z: 2, radius: 0.2 }]), false);
    assert.equal(isTransformWithinWorld(valid, 0.2, [{ x: 2.45, z: 2, radius: 0.2 }]), true);
  });

  it('slides character movement around decorations and keeps it inside the boundary', () => {
    const next = moveWorldCharacter({ x: 1, z: -2 }, { x: 2, z: -2 }, 0.35, [{ x: 1.55, z: -2, radius: 0.35 }]);
    assert.ok(next.x < 1.25, `expected decoration collision to stop the character, got ${next.x}`);
    assert.ok(Math.abs(next.z) <= WORLD_BOUNDARY - 0.35);
    const boundary = moveWorldCharacter({ x: 4.4, z: 0 }, { x: 6, z: 0 }, 0.35, []);
    assert.equal(boundary.x, WORLD_BOUNDARY - 0.35);
  });

  it('lets the character reach the upper walkable edge without the outer tree blocking it', () => {
    const upperEdge = moveWorldCharacter({ x: 0, z: -4 }, { x: 0, z: -6 }, 0.35);
    assert.equal(upperEdge.z, -WORLD_BOUNDARY + 0.35);
  });
});
