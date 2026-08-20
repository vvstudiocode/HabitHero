import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { isSingleFingerDoubleTapGesture } from '../src/features/world/clean-screen-mode';

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
const neutralThemeStyles = readFileSync(
  new URL('../src/styles/neutral-theme.css', import.meta.url),
  'utf8',
);

describe('clean screenshot mode', () => {
  it('accepts a short, still single-finger double tap', () => {
    assert.equal(isSingleFingerDoubleTapGesture({
      tapCount: 2,
      intervalMs: 260,
      maxMovementPx: 10,
      maxTapDurationMs: 260,
    }), true);
  });

  it('does not treat a single tap, slow taps, a drag, or a cancelled gesture as restore', () => {
    assert.equal(isSingleFingerDoubleTapGesture({ tapCount: 1, intervalMs: 200, maxMovementPx: 0 }), false);
    assert.equal(isSingleFingerDoubleTapGesture({ tapCount: 2, intervalMs: 520, maxMovementPx: 0 }), false);
    assert.equal(isSingleFingerDoubleTapGesture({ tapCount: 2, intervalMs: 200, maxMovementPx: 24 }), false);
    assert.equal(isSingleFingerDoubleTapGesture({ tapCount: 2, intervalMs: 200, maxMovementPx: 0, cancelled: true }), false);
    assert.equal(isSingleFingerDoubleTapGesture({ tapCount: 2, intervalMs: 200, maxMovementPx: 0, maxTapDurationMs: 520 }), false);
    assert.equal(isSingleFingerDoubleTapGesture({ tapCount: 2, intervalMs: 200, maxMovementPx: 0, maxTapDurationMs: -1 }), false);
  });

  it('wires the camera control, first-use hint, and single-finger double-tap restore into the child world', () => {
    assert.match(worldSource, /hh-world-clean-mode-control/);
    assert.match(worldSource, /相機|Camera/);
    assert.match(worldSource, /<strong id="hh-world-clean-mode-hint-title">清爽模式已開啟<\/strong>/);
    assert.match(worldSource, /<p id="hh-world-clean-mode-hint-description">再點擊右下角或單指點擊兩下可恢復介面<\/p>/);
    assert.match(worldSource, /role="dialog"/);
    assert.match(worldSource, /aria-modal="true"/);
    assert.match(worldSource, /data-clean-mode-hint/);
    assert.match(worldSource, /確定/);
    assert.doesNotMatch(worldSource, /清爽模式已開啟，再點擊右下角可恢復介面/);
    assert.match(dashboardSource, /isSingleFingerDoubleTapGesture/);
    assert.doesNotMatch(dashboardSource, /isTwoFingerTapGesture/);
    assert.doesNotMatch(dashboardSource, /cleanModeHintTimer/);
    assert.match(dashboardSource, /pointerdown/);
    assert.match(dashboardSource, /pointerup/);
  });

  it('keeps clean mode selectors owned by the existing control style layers', () => {
    assert.match(characterStyles, /is-clean-mode[\s\S]*?hh-character-stats/);
    assert.match(characterStyles, /is-clean-mode[\s\S]*?hh-child-adventure-board/);
    assert.match(worldControlStyles, /is-clean-mode[\s\S]*?hh-world-joystick/);
    assert.match(worldControlStyles, /hh-world-clean-mode-control/);
    assert.match(worldControlStyles, /\.hh-world-clean-mode-hint\s*\{[\s\S]*?inset:\s*0/);
    assert.match(worldControlStyles, /\.hh-world-clean-mode-hint-card\s*\{[\s\S]*?animation:/);
    assert.match(worldControlStyles, /\.hh-world-clean-mode-confirm\s*\{[\s\S]*?min-height:\s*44px/);
    assert.match(neutralThemeStyles, /\.hh-world-clean-mode-control,\s*\.hh-world-action-toggle,\s*\.hh-world-action-item\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--hh-neutral-surface\) 68%, transparent\)/);
    assert.match(neutralThemeStyles, /\.hh-world-clean-mode-control,\s*\.hh-world-action-toggle,\s*\.hh-world-action-item\s*\{[\s\S]*?box-shadow:\s*0 8px 22px var\(--hh-neutral-shadow\)/);
    assert.match(neutralThemeStyles, /\.hh-world-clean-mode-hint\s*\{[\s\S]*?background:\s*rgb\(18 57 59 \/ 30%\)/);
    assert.match(neutralThemeStyles, /\.hh-world-clean-mode-hint-card\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--hh-neutral-surface\) 92%, transparent\)/);
    assert.match(loginStyles, /is-clean-mode[\s\S]*?hh-bottom-nav/);
    assert.match(overlayStyles, /is-clean-mode[\s\S]*?hh-toast/);
  });
});
