import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  getParentBackgroundMusicPreference,
  setParentBackgroundMusicPreference,
} from '../src/lib/parent-background-music-preference';

const parentDashboardSource = await readFile(
  new URL('../src/components/ParentDashboard.tsx', import.meta.url),
  'utf8',
);
const parentMusicSource = await readFile(
  new URL('../src/components/ParentDashboardBackgroundMusic.tsx', import.meta.url),
  'utf8',
);
const parentMusicLibrarySource = await readFile(
  new URL('../src/lib/parent-background-music.ts', import.meta.url),
  'utf8',
);

test('parent dashboard owns piano background music across parent feature pages', () => {
  assert.match(parentDashboardSource, /ParentDashboardBackgroundMusic/);
  assert.match(parentDashboardSource, /<ParentDashboardBackgroundMusic\s+enabled=\{parentBackgroundMusicEnabled\}\s*\/>/);
  assert.match(parentDashboardSource, /getParentBackgroundMusicPreference/);
  assert.match(parentDashboardSource, /setParentBackgroundMusicPreference/);
  assert.match(parentMusicSource, /PARENT_DASHBOARD_BACKGROUND_MUSIC_SRC/);
  assert.match(parentMusicSource, /startWorldBackgroundMusic/);
  assert.match(parentMusicSource, /stopWorldBackgroundMusic/);
  assert.match(parentMusicLibrarySource, /paulyudin-piano-piano-music-508963\.mp3/);
});

test('parent settings expose a family-scoped music switch', () => {
  assert.match(parentDashboardSource, /背景音樂/);
  assert.match(parentDashboardSource, /checked=\{parentBackgroundMusicEnabled\}/);
  assert.match(parentDashboardSource, /handleParentBackgroundMusicChange/);
});

test('parent background music preference defaults on and persists per family', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  assert.equal(getParentBackgroundMusicPreference('family-a', storage), true);
  setParentBackgroundMusicPreference('family-a', false, storage);
  assert.equal(getParentBackgroundMusicPreference('family-a', storage), false);
  assert.equal(getParentBackgroundMusicPreference('family-b', storage), true);
});
