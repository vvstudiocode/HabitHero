import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('background notification toggle matches the day-night toggle dimensions', () => {
  const worldStyles = read('../src/styles/world.css');
  const modalStyles = read('../src/styles/modals.css');

  assert.match(worldStyles, /\.hh-game-setting-toggle > span:last-child\s*\{[\s\S]*?width:\s*52px;[\s\S]*?height:\s*30px;/);
  assert.match(worldStyles, /\.hh-game-setting-toggle > span:last-child::after\s*\{[\s\S]*?width:\s*22px;[\s\S]*?height:\s*22px;/);
  assert.match(modalStyles, /\.hh-notification-toggle\s*\{[\s\S]*?width:\s*52px;[\s\S]*?height:\s*44px;/);
  assert.match(modalStyles, /\.hh-notification-toggle-track\s*\{[\s\S]*?width:\s*52px;[\s\S]*?height:\s*30px;/);
  assert.match(modalStyles, /\.hh-notification-toggle-thumb\s*\{[\s\S]*?width:\s*22px;[\s\S]*?height:\s*22px;/);
  assert.match(modalStyles, /\.hh-notification-toggle\.is-on \.hh-notification-toggle-thumb\s*\{[\s\S]*?translateX\(22px\)/);
});

test('general adventure fields place duration with points and start times on the next row', () => {
  const source = read('../src/features/growth/components/GoalProposalForm.tsx');
  const fieldGrid = source.match(/<div className="([^"]*grid[^"]*)">/)?.[1] ?? '';

  assert.match(fieldGrid, /sm:grid-cols-3/);
  assert.ok(source.indexOf('目標分類') < source.indexOf('預估點數'));
  assert.ok(source.indexOf('預估點數') < source.indexOf('想做多久？'));
  assert.ok(source.indexOf('想做多久？') < source.indexOf('開始時間'));
  assert.ok(source.indexOf('開始時間') < source.indexOf('最晚開始時間'));
});

test('general adventure close control is anchored to the right side of its bar', () => {
  const overlays = read('../src/styles/overlays.css');

  assert.match(overlays, /\.hh-goal-proposal-sheet-bar\s*\{[\s\S]*?right:\s*16px;[\s\S]*?left:\s*auto;/);
});
