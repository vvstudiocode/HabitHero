import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panelSource = await readFile(
  new URL('../src/features/world/components/ChildGamePanel.tsx', import.meta.url),
  'utf8',
);
const dashboardSource = await readFile(
  new URL('../src/components/ChildDashboard.tsx', import.meta.url),
  'utf8',
);
const backgroundMusicSource = await readFile(
  new URL('../src/components/ChildDashboardBackgroundMusic.tsx', import.meta.url),
  'utf8',
);
const worldStyles = await readFile(
  new URL('../src/styles/world.css', import.meta.url),
  'utf8',
);

test('child settings expose a persistent background music switch', () => {
  assert.match(panelSource, /backgroundMusicEnabled/);
  assert.match(panelSource, /背景音樂/);
  assert.match(panelSource, /checked=\{backgroundMusicEnabled\}/);
  assert.match(panelSource, /onBackgroundMusicChange/);
  assert.match(dashboardSource, /getBackgroundMusicPreference/);
  assert.match(dashboardSource, /setBackgroundMusicPreference/);
  assert.match(dashboardSource, /onBackgroundMusicChange=\{handleBackgroundMusicChange\}/);
  assert.match(backgroundMusicSource, /enabled/);
});

test('child settings omit helper copy and compact the notification card', () => {
  assert.doesNotMatch(panelSource, /在孩子的冒險頁面持續播放背景音樂。/);
  assert.doesNotMatch(panelSource, /在世界中顯示寵物的白色小字名稱。/);
  assert.match(panelSource, /<PushNotificationSettings settings=\{notificationSettings\} className="hh-game-settings-card" \/>/);
  assert.doesNotMatch(panelSource, /hh-game-settings-card--notification/);
  assert.doesNotMatch(worldStyles, /\.hh-game-settings-card--notification/);
});
