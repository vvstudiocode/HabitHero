import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBackgroundMusicPreference,
  setBackgroundMusicPreference,
} from '../src/lib/background-music-preference';

class FakeStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test('background music is enabled by default and persists per child', () => {
  const storage = new FakeStorage();

  assert.equal(getBackgroundMusicPreference('child-a', storage), true);
  setBackgroundMusicPreference('child-a', false, storage);
  assert.equal(getBackgroundMusicPreference('child-a', storage), false);
  assert.equal(getBackgroundMusicPreference('child-b', storage), true);
});

test('background music preference safely ignores missing child ids', () => {
  const storage = new FakeStorage();

  assert.equal(getBackgroundMusicPreference('', storage), true);
  setBackgroundMusicPreference('', false, storage);
  assert.equal(getBackgroundMusicPreference('', storage), true);
});
