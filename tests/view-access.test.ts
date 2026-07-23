import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PARENT_IDLE_LOCK_MS, isWithinFamily, isParentModeUnlocked } from '../src/lib/view-access';

describe('view access rules', () => {
  it('locks parent mode after three minutes without activity', () => {
    assert.equal(PARENT_IDLE_LOCK_MS, 3 * 60 * 1000);
    assert.equal(isParentModeUnlocked(1000, 1000 + PARENT_IDLE_LOCK_MS - 1), true);
    assert.equal(isParentModeUnlocked(1000, 1000 + PARENT_IDLE_LOCK_MS), false);
  });

  it('only permits child switching within the loaded family', () => {
    assert.equal(isWithinFamily([{ id: 'child-1', familyId: 'family-1' }], 'family-1', 'child-1'), true);
    assert.equal(isWithinFamily([{ id: 'child-2', familyId: 'family-2' }], 'family-1', 'child-2'), false);
    assert.equal(isWithinFamily([], 'family-1', 'child-1'), false);
  });
});
