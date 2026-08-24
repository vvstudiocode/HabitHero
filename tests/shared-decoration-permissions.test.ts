import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getSharedDecorationActionState } from '../src/features/shared-decorations/permissions';

describe('shared decoration permissions', () => {
  it('uses only server capability flags for actions', () => {
    assert.deepEqual(getSharedDecorationActionState({
      canShareDecorations: true,
      canTransform: false,
      canRemove: true,
    }), {
      canPlace: true,
      canTransform: false,
      canRemove: true,
    });
  });

  it('does not infer edit access from shared ownership metadata', () => {
    assert.deepEqual(getSharedDecorationActionState({
      canShareDecorations: false,
      canTransform: false,
      canRemove: false,
      placementScope: 'shared',
      sharedByMe: true,
    }), {
      canPlace: false,
      canTransform: false,
      canRemove: false,
    });
  });

  it('treats non-boolean or missing capabilities as denied', () => {
    assert.deepEqual(getSharedDecorationActionState({
      canShareDecorations: undefined,
      canTransform: undefined,
      canRemove: undefined,
    }), {
      canPlace: false,
      canTransform: false,
      canRemove: false,
    });
    assert.deepEqual(getSharedDecorationActionState({
      canShareDecorations: 'true' as never,
      canTransform: 1 as never,
      canRemove: {} as never,
    }), {
      canPlace: false,
      canTransform: false,
      canRemove: false,
    });
  });
});
