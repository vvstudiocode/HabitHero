import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_WORLD_LOCATION,
  getStoredWorldLocation,
  isWorldLocation,
  saveWorldLocation,
} from '../src/features/world/world-location';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('world location', () => {
  it('defaults a child to Sunrise Village', () => {
    assert.equal(getStoredWorldLocation('child-1', createStorage()), DEFAULT_WORLD_LOCATION);
  });

  it('remembers the last world for the child', () => {
    const storage = createStorage();
    saveWorldLocation('child-1', 'my-world', storage);
    assert.equal(getStoredWorldLocation('child-1', storage), 'my-world');
  });

  it('ignores invalid or empty persisted locations', () => {
    const storage = createStorage();
    storage.setItem('habithero:world-location:child-1', 'not-a-world');
    assert.equal(getStoredWorldLocation('child-1', storage), DEFAULT_WORLD_LOCATION);
    assert.equal(isWorldLocation('sunrise-village'), true);
    assert.equal(isWorldLocation('forest-valley'), true);
    assert.equal(isWorldLocation('cloud-workshop'), true);
    assert.equal(isWorldLocation('my-world'), true);
    assert.equal(isWorldLocation('not-a-world'), false);
  });

  it('does not throw when browser storage is unavailable', () => {
    assert.doesNotThrow(() => saveWorldLocation('child-1', 'sunrise-village', undefined));
    assert.equal(getStoredWorldLocation('child-1', undefined), DEFAULT_WORLD_LOCATION);
  });
});
