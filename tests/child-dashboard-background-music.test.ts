import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const childDashboardSource = await readFile(
  new URL('../src/components/ChildDashboard.tsx', import.meta.url),
  'utf8',
);
const worldLayerSource = await readFile(
  new URL('../src/features/world/TerrainWorldLayer.tsx', import.meta.url),
  'utf8',
);

test('child dashboard owns background music across all child feature pages', () => {
  assert.match(childDashboardSource, /ChildDashboardBackgroundMusic/);
  assert.match(childDashboardSource, /<ChildDashboardBackgroundMusic\s+enabled=\{backgroundMusicEnabled\}\s+worldLocation=\{worldLocation\}\s*\/>/);
  assert.doesNotMatch(worldLayerSource, /world-background-music/);
  assert.doesNotMatch(worldLayerSource, /WORLD_BACKGROUND_MUSIC_SRC/);
});

test('background music retries from app interactions after autoplay is blocked', async () => {
  const backgroundMusicSource = await readFile(
    new URL('../src/components/ChildDashboardBackgroundMusic.tsx', import.meta.url),
    'utf8',
  );

  assert.match(backgroundMusicSource, /document\.addEventListener\('pointerdown'/);
  assert.match(backgroundMusicSource, /document\.addEventListener\('keydown'/);
  assert.match(backgroundMusicSource, /bindWorldBackgroundMusicVisibility/);
  assert.match(backgroundMusicSource, /visibilityState/);
  assert.match(backgroundMusicSource, /createWorldBackgroundMusicCrossfadePlayer/);
  assert.match(backgroundMusicSource, /getWorldBackgroundMusicConfig/);
  assert.match(backgroundMusicSource, /createWorldBackgroundMusicCrossfadePlayer\(musicConfig\)/);
  assert.match(backgroundMusicSource, /worldLocation/);
  assert.match(backgroundMusicSource, /player\.start\(\)/);
  assert.match(backgroundMusicSource, /player\.stop\(\)/);
});
