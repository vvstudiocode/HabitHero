import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { isTwoFingerTapGesture } from '../src/features/world/clean-screen-mode';

const dashboardSource = readFileSync(
  new URL('../src/components/ChildDashboard.tsx', import.meta.url),
  'utf8',
);
const worldSource = readFileSync(
  new URL('../src/features/world/TerrainWorldLayer.tsx', import.meta.url),
  'utf8',
);
const characterStyles = readFileSync(
  new URL('../src/styles/character.css', import.meta.url),
  'utf8',
);
const worldControlStyles = readFileSync(
  new URL('../src/styles/world-controls.css', import.meta.url),
  'utf8',
);
const loginStyles = readFileSync(
  new URL('../src/styles/login.css', import.meta.url),
  'utf8',
);
const overlayStyles = readFileSync(
  new URL('../src/styles/overlays.css', import.meta.url),
  'utf8',
);

describe('clean screenshot mode', () => {
  it('accepts a short, still two-finger tap', () => {
    assert.equal(isTwoFingerTapGesture({
      maxConcurrentPointers: 2,
      durationMs: 260,
      maxMovementPx: 10,
    }), true);
  });

  it('does not treat a single finger, pinch, drag, or cancelled gesture as restore', () => {
    assert.equal(isTwoFingerTapGesture({ maxConcurrentPointers: 1, durationMs: 200, maxMovementPx: 0 }), false);
    assert.equal(isTwoFingerTapGesture({ maxConcurrentPointers: 2, durationMs: 520, maxMovementPx: 0 }), false);
    assert.equal(isTwoFingerTapGesture({ maxConcurrentPointers: 2, durationMs: 200, maxMovementPx: 24 }), false);
    assert.equal(isTwoFingerTapGesture({ maxConcurrentPointers: 2, durationMs: 200, maxMovementPx: 0, cancelled: true }), false);
  });

  it('wires the camera control, first-use hint, and two-finger restore into the child world', () => {
    assert.match(worldSource, /hh-world-clean-mode-control/);
    assert.match(worldSource, /相機|Camera/);
    assert.match(worldSource, /清爽模式已開啟，再點擊右下角可恢復介面/);
    assert.match(dashboardSource, /isTwoFingerTapGesture/);
    assert.match(dashboardSource, /pointerdown/);
    assert.match(dashboardSource, /pointerup/);
  });

  it('keeps clean mode selectors owned by the existing control style layers', () => {
    assert.match(characterStyles, /is-clean-mode[\s\S]*?hh-character-stats/);
    assert.match(characterStyles, /is-clean-mode[\s\S]*?hh-child-adventure-board/);
    assert.match(worldControlStyles, /is-clean-mode[\s\S]*?hh-world-joystick/);
    assert.match(worldControlStyles, /hh-world-clean-mode-control/);
    assert.match(loginStyles, /is-clean-mode[\s\S]*?hh-bottom-nav/);
    assert.match(overlayStyles, /is-clean-mode[\s\S]*?hh-toast/);
  });
});
