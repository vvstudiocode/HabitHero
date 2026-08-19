import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHARACTER_GROUND_CONTACT_Y,
  PLAYER_CHARACTER_GROUND_OFFSET,
  PROTOTYPE_WORLD_CONFIG,
  TREE_OUTER_EDGE_PADDING,
  getCharacterGroundingCorrection,
  getCharacterGroundingReferenceY,
  getGroundedRootY,
  getOuterTreePlacement,
  getWalkIdlePoseTime,
} from '../src/features/world/world-runtime-geometry';

describe('world runtime geometry helpers', () => {
  it('preserves character grounding and idle-pose calculations', () => {
    assert.equal(PLAYER_CHARACTER_GROUND_OFFSET, -0.12);
    assert.equal(CHARACTER_GROUND_CONTACT_Y, 0.055);
    assert.equal(getCharacterGroundingReferenceY(0, [0.144, 0.134, Number.NaN]), 0.134);
    assert.equal(getCharacterGroundingReferenceY(-0.08, []), -0.08);
    assert.equal(getCharacterGroundingCorrection(-0.08), 0.135);
    assert.ok(Math.abs(getCharacterGroundingCorrection(0.06) + 0.005) < 0.000001);
    assert.ok(Math.abs(getGroundedRootY(-0.12, 0.134) - -0.199) < 1e-9);
    assert.equal(getGroundedRootY(1.2, Number.NaN), 1.2);
    assert.equal(getWalkIdlePoseTime(1), 0.04);
    assert.equal(getWalkIdlePoseTime(0.2), 0.033);
    assert.equal(getWalkIdlePoseTime(0), 0);
  });

  it('keeps the outer tree placement contract outside the walkable terrain edge', () => {
    assert.equal(TREE_OUTER_EDGE_PADDING, 0.08);
    assert.equal(PROTOTYPE_WORLD_CONFIG.gridSize, 9);
    assert.equal(PROTOTYPE_WORLD_CONFIG.cameraPitchMax, Math.PI * (89 / 180));

    const placement = getOuterTreePlacement({
      treeSize: { x: 1.03942, y: 1.04616, z: 1.03661 },
      terrainLimit: 4.862,
      terrainStep: 1.1,
      treeFitToTile: 7.2,
      x: PROTOTYPE_WORLD_CONFIG.treeAnchorX,
    });

    assert.equal(placement.x, PROTOTYPE_WORLD_CONFIG.treeAnchorX);
    assert.ok(placement.z + placement.halfDepth < -4.862);
    assert.ok(placement.z < -4.862);
    assert.ok(placement.scale > 0);
    assert.ok(placement.footprintRadius > 0);
  });
});
