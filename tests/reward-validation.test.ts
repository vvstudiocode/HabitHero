import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateRewardPoints } from '../src/lib/reward-validation';

describe('reward points validation', () => {
  it('accepts positive integers', () => {
    assert.deepEqual(validateRewardPoints(1), { ok: true });
    assert.deepEqual(validateRewardPoints(50), { ok: true });
  });

  it('rejects zero, negative, fractional, and non-finite values', () => {
    for (const points of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.deepEqual(validateRewardPoints(points), {
        ok: false,
        message: '獎勵點數必須是大於 0 的整數。',
      });
    }
  });
});
