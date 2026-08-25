import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  applyDecorationPlacementControl,
  applyDecorationPlacementGesture,
  toDecorationPlacementTransform,
  type DecorationPlacementDraft,
} from '../src/features/world/world-placement';
import { isWorldRevisionConflict, toWorldMutationErrorMessage } from '../src/features/world/world-errors';

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
  it('recognizes revision conflicts without treating them as retryable writes', () => {
    assert.equal(isWorldRevisionConflict(new Error('world revision conflict')), true);
    assert.equal(isWorldRevisionConflict({ code: 'revision-conflict' }), true);
    assert.equal(isWorldRevisionConflict(new Error('world entity not found')), false);
  });

  it('translates the rotation constraint error into a child-friendly message', () => {
    const message = toWorldMutationErrorMessage(
      new Error('new row for relation "child_world_entities" violates check constraint "child_world_entities_rotation_y_check"'),
      '家具尚未保存，請再試一次。',
    );

    assert.equal(message, '家具旋轉角度超出範圍，請稍微調整後再試一次。');
  });
});

describe('database rotation defense', () => {
  it('normalizes rotations in the database write path too', async () => {
    const migration = await readFile(path.resolve('supabase/migrations/20260815201428_normalize_world_entity_rotations.sql'), 'utf8');

    assert.match(migration, /normalize_world_rotation/);
    assert.match(migration, /before insert or update of rotation_x, rotation_y, rotation_z/i);
    assert.match(migration, /new\.rotation_y\s*:=\s*private\.normalize_world_rotation/i);
  });
});
