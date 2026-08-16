import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyDecorationPlacementGesture,
  applyDecorationPlacementControl,
  createDecorationPlacementDraft,
  getPlacementRotationDelta,
  getPlacementGridCells,
  isDecorationPlacementValid,
  shouldMovePlacementDecoration,
  toDecorationPlacementTransform,
} from '../src/features/world/world-placement';
import { CHARACTER_SPAWN, CENTRAL_TREE_KEEP_OUT, VISIBLE_GRASS_BOUNDARY } from '../src/features/world/world-collision';

const decoration = {
  collisionRadius: 0.38,
  minScale: 0.1,
  maxScale: 1.5,
};

describe('decoration placement flow', () => {
  it('accumulates rotation continuously across repeated horizontal drag updates', () => {
    const deltas = [
      getPlacementRotationDelta(100, 130),
      getPlacementRotationDelta(130, 180),
      getPlacementRotationDelta(180, 150),
    ];

    assert.equal(deltas[0] > 0, true);
    assert.equal(deltas[2] < 0, true);
    assert.equal(deltas[0] + deltas[1] + deltas[2], getPlacementRotationDelta(100, 150));
  });

  it('moves only after a drag starts on the decoration itself', () => {
    assert.equal(shouldMovePlacementDecoration(1, true), true);
    assert.equal(shouldMovePlacementDecoration(1, false), false);
    assert.equal(shouldMovePlacementDecoration(2, true), false);
  });

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

  it('applies pinch-and-rotate gesture deltas within the item scale limits', () => {
    const next = applyDecorationPlacementGesture(
      { x: 1.8, z: -1.5, rotationY: 0, scale: 1 },
      { scaleFactor: 1.2, rotationDelta: Math.PI / 4 },
      decoration,
    );
    assert.equal(next.scale, 1.2);
    assert.equal(next.rotationY, Math.PI / 4);

    const clamped = applyDecorationPlacementGesture(
      { x: 1.8, z: -1.5, rotationY: 0.2, scale: 1.5 },
      { scaleFactor: 2, rotationDelta: -Math.PI / 4 },
      decoration,
    );
    assert.equal(clamped.scale, 1.5);
    assert.equal(clamped.rotationY, 0.2 - Math.PI / 4);
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

  it('allows outer meadow placement while keeping spawn, tree, overlap, and meadow-edge rules', () => {
    assert.equal(isDecorationPlacementValid({ x: 2, z: -1.5, rotationY: 0, scale: 1 }, decoration), true);
    assert.equal(isDecorationPlacementValid({ x: 6, z: -1.5, rotationY: 0, scale: 1 }, decoration), true);
    assert.equal(isDecorationPlacementValid({ x: 0, z: 0, rotationY: 0, scale: 1 }, decoration), true);
    assert.equal(isDecorationPlacementValid({ x: CHARACTER_SPAWN.x, z: CHARACTER_SPAWN.z, rotationY: 0, scale: 1 }, decoration), false);
    assert.equal(isDecorationPlacementValid({ x: CENTRAL_TREE_KEEP_OUT.x, z: CENTRAL_TREE_KEEP_OUT.z, rotationY: 0, scale: 1 }, decoration), false);
    assert.equal(isDecorationPlacementValid({ x: VISIBLE_GRASS_BOUNDARY - decoration.collisionRadius / 2, z: -1.5, rotationY: 0, scale: 1 }, decoration), false);
    assert.equal(isDecorationPlacementValid(
      { x: 2, z: -1.5, rotationY: 0, scale: 1 },
      decoration,
      [{ x: 2, z: -1.5, radius: 0.38 }],
    ), false);
  });

  it('accepts the new 0.1 minimum scale and marks blocked grid cells', () => {
    assert.equal(isDecorationPlacementValid({ x: 2, z: -1.5, rotationY: 0, scale: 0.1 }, decoration), true);
    const cells = getPlacementGridCells({
      item: decoration,
      scale: 0.1,
      cellSize: 1,
      boundary: 2,
      existing: [{ x: -0.5, z: -0.5, radius: 0.1 }],
    });
    assert.ok(cells.some((cell) => cell.x === -0.5 && cell.z === -0.5 && !cell.isValid));
    assert.ok(cells.some((cell) => cell.x === -1.5 && cell.z === -1.5 && cell.isValid));
  });
});
