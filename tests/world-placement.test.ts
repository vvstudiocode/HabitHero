import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyDecorationPlacementControl,
  createDecorationPlacementDraft,
  getPlacementGridCells,
  isDecorationPlacementValid,
  toDecorationPlacementTransform,
} from '../src/features/world/world-placement';

const decoration = {
  collisionRadius: 0.38,
  minScale: 0.1,
  maxScale: 1.5,
};

describe('decoration placement flow', () => {
  it('starts with a safe, easy-to-see placement draft', () => {
    assert.deepEqual(createDecorationPlacementDraft(), {
      x: 1.8,
      z: -1.5,
      rotationY: 0,
      scale: 1,
    });
    assert.equal(createDecorationPlacementDraft({ minScale: 0.25, maxScale: 0.8, metadata: { defaultScale: 0.62 } }).scale, 0.62);
    assert.equal(createDecorationPlacementDraft({ minScale: 0.25, maxScale: 0.8, metadata: { defaultScale: 1.4 } }).scale, 0.8);
    const studyDesk = { collisionRadius: 0.95, minScale: 0.25, maxScale: 0.8, metadata: { defaultScale: 0.62 } };
    assert.equal(isDecorationPlacementValid(createDecorationPlacementDraft(studyDesk), studyDesk), true);
  });

  it('adjusts rotation and scale with child-friendly controls', () => {
    const draft = createDecorationPlacementDraft();
    assert.equal(applyDecorationPlacementControl(draft, 'rotate-left').rotationY, -Math.PI / 8);
    assert.equal(applyDecorationPlacementControl(draft, 'rotate-right').rotationY, Math.PI / 8);
    assert.equal(applyDecorationPlacementControl(draft, 'scale-up', decoration).scale, 1.1);
    assert.equal(applyDecorationPlacementControl({ ...draft, scale: 1.5 }, 'scale-up', decoration).scale, 1.5);
    assert.equal(applyDecorationPlacementControl({ ...draft, scale: 0.1 }, 'scale-down', decoration).scale, 0.1);
  });

  it('converts the 2D placement draft into the existing world transform contract', () => {
    assert.deepEqual(toDecorationPlacementTransform({ x: -2, z: 1.25, rotationY: 0.5, scale: 1.2 }), {
      x: -2,
      y: 0,
      z: 1.25,
      rotationX: 0,
      rotationY: 0.5,
      rotationZ: 0,
      scale: 1.2,
    });
  });

  it('rejects protected, overlapping, and out-of-bounds placement points', () => {
    assert.equal(isDecorationPlacementValid({ x: 2, z: -1.5, rotationY: 0, scale: 1 }, decoration), true);
    assert.equal(isDecorationPlacementValid({ x: 0, z: 0, rotationY: 0, scale: 1 }, decoration), false);
    assert.equal(isDecorationPlacementValid({ x: 4.7, z: -1.5, rotationY: 0, scale: 1 }, decoration), false);
    assert.equal(isDecorationPlacementValid(
      { x: 2, z: -1.5, rotationY: 0, scale: 1 },
      decoration,
      [{ x: 2, z: -1.5, radius: 0.38 }],
    ), false);
  });

  it('accepts the new 0.1 minimum scale and marks blocked grid cells', () => {
    assert.equal(isDecorationPlacementValid({ x: 2, z: -1.5, rotationY: 0, scale: 0.1 }, decoration), true);
    const cells = getPlacementGridCells({ item: decoration, scale: 0.1, cellSize: 1, boundary: 2 });
    assert.ok(cells.some((cell) => cell.x === 0 && cell.z === 0 && !cell.isValid));
    assert.ok(cells.some((cell) => cell.x === -1.5 && cell.z === -1.5 && cell.isValid));
  });
});
