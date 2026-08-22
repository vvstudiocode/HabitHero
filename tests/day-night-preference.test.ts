import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getDayNightPreference,
  setDayNightPreference,
} from '../src/features/world/day-night-preference';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('day and night display preference', () => {
  it('defaults to enabled and persists independently for each child', () => {
    const storage = createMemoryStorage();
    assert.equal(getDayNightPreference('child-a', storage), true);
    setDayNightPreference('child-a', false, storage);
    assert.equal(getDayNightPreference('child-a', storage), false);
    assert.equal(getDayNightPreference('child-b', storage), true);
  });
});
