import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('child adventure rewards use a modal celebration with persistent unseen-state handling', () => {
  const dashboard = read('../src/components/ChildDashboard.tsx');
  const celebration = read('../src/features/adventures/components/AdventureRewardCelebration.tsx');
  const overlays = read('../src/styles/overlays.css');
  const modals = read('../src/styles/modals.css');

  assert.match(dashboard, /AdventureRewardCelebration/);
  assert.match(dashboard, /readAdventureRewardNoticeState/);
  assert.match(dashboard, /createInitialAdventureRewardNoticeState/);
  assert.match(dashboard, /markAdventureRewardTaskSubmitted/);
  assert.match(dashboard, /markAdventureRewardEventsSeen/);
  assert.match(celebration, /mode: 'submitted'|mode === 'approved'/);
  assert.match(celebration, /CelebrationCanvas/);
  assert.match(celebration, /prefers-reduced-motion/);
  assert.match(celebration, /任務捲/);
  assert.match(overlays, /\.hh-adventure-reward-overlay/);
  assert.match(modals, /\.hh-adventure-reward-card/);
});
