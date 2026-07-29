import assert from 'node:assert/strict';
import test from 'node:test';
import { getChildDays } from '../src/lib/child-days';

test('counts the creation calendar day as day one in Taipei', () => {
  assert.equal(
    getChildDays('2026-07-24T16:00:00.000Z', new Date('2026-07-24T16:30:00.000Z')),
    1,
  );
});

test('increments only when the Taipei calendar date changes', () => {
  assert.equal(
    getChildDays('2026-07-24T15:30:00.000Z', new Date('2026-07-24T15:59:59.999Z')),
    1,
  );
  assert.equal(
    getChildDays('2026-07-24T15:30:00.000Z', new Date('2026-07-24T16:00:00.000Z')),
    2,
  );
});

test('counts multiple Taipei calendar days across month boundaries', () => {
  assert.equal(
    getChildDays('2026-07-31T16:30:00.000Z', new Date('2026-08-02T17:00:00.000Z')),
    3,
  );
});

test('returns null for missing, invalid, future, or invalid current timestamps', () => {
  const now = new Date('2026-07-24T16:30:00.000Z');

  assert.equal(getChildDays(null, now), null);
  assert.equal(getChildDays(undefined, now), null);
  assert.equal(getChildDays('not-a-timestamp', now), null);
  assert.equal(getChildDays(new Date(Number.NaN), now), null);
  assert.equal(getChildDays('2026-07-24T16:31:00.000Z', now), null);
  assert.equal(getChildDays('2026-07-24T16:00:00.000Z', new Date(Number.NaN)), null);
});
