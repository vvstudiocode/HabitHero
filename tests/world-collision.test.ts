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

  it('protects the spawn point and central tree keep-out area', () => {
    assert.equal(isTransformWithinWorld({ ...valid, x: CHARACTER_SPAWN.x, z: CHARACTER_SPAWN.z }, 0.3), false);
    assert.equal(isTransformWithinWorld({ ...valid, x: CENTRAL_TREE_KEEP_OUT.x, z: CENTRAL_TREE_KEEP_OUT.z }, 0.3), false);
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

  it('lets the character approach the big tree while keeping the tree root solid', () => {
    const nearTreeDistance = 1.45;
    const closer = moveWorldCharacter(
      { x: CENTRAL_TREE_KEEP_OUT.x + nearTreeDistance + 0.2, z: CENTRAL_TREE_KEEP_OUT.z },
      { x: CENTRAL_TREE_KEEP_OUT.x + nearTreeDistance, z: CENTRAL_TREE_KEEP_OUT.z },
      0.35,
    );
    assert.equal(closer.x, CENTRAL_TREE_KEEP_OUT.x + nearTreeDistance);

    const blocked = moveWorldCharacter(
      closer,
      { x: CENTRAL_TREE_KEEP_OUT.x, z: CENTRAL_TREE_KEEP_OUT.z },
      0.35,
    );
    assert.equal(blocked.x, closer.x);
    assert.equal(blocked.z, closer.z);
  });
});
