import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyDecorationPlacementControl,
  applyDecorationPlacementGesture,
  toDecorationPlacementTransform,
  type DecorationPlacementDraft,
} from '../src/features/world/world-placement';
import { toWorldMutationErrorMessage } from '../src/features/world/world-errors';

const draft: DecorationPlacementDraft = { x: 1.8, z: -1.5, rotationY: 0, scale: 1 };

describe('world decoration rotation persistence', () => {
  it('keeps repeated button rotation inside the database rotation range', () => {
    let next = draft;
    for (let index = 0; index < 80; index += 1) next = applyDecorationPlacementControl(next, 'rotate-right');

    const transform = toDecorationPlacementTransform(next);
    assert.ok(transform.rotationY >= -6.284 && transform.rotationY <= 6.284);
  });

  it('keeps a long press-drag rotation inside the database rotation range', () => {
    const next = applyDecorationPlacementGesture(draft, { scaleFactor: 1, rotationDelta: Math.PI * 12 });

    const transform = toDecorationPlacementTransform(next);
    assert.ok(transform.rotationY >= -6.284 && transform.rotationY <= 6.284);
  });
});

describe('world mutation error messages', () => {
  it('translates the rotation constraint error into a child-friendly message', () => {
    const message = toWorldMutationErrorMessage(
      new Error('new row for relation "child_world_entities" violates check constraint "child_world_entities_rotation_y_check"'),
      '家具尚未保存，請再試一次。',
    );

    assert.equal(message, '家具旋轉角度超出範圍，請稍微調整後再試一次。');
  });
});
