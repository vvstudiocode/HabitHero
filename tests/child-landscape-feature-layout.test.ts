import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const childDashboardSource = readFileSync(
  new URL('../src/components/ChildDashboard.tsx', import.meta.url),
  'utf8',
);
const overlayStyles = readFileSync(
  new URL('../src/styles/overlays.css', import.meta.url),
  'utf8',
);
const worldStyles = readFileSync(
  new URL('../src/styles/world.css', import.meta.url),
  'utf8',
);

describe('child landscape feature layout', () => {
  it('gives child feature pages their own compact modal and input-blocking backdrop', () => {
    assert.match(childDashboardSource, /hh-child-feature-backdrop/);
    assert.match(childDashboardSource, /hh-parent-content-modal--child/);
    assert.match(overlayStyles, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-child-feature-backdrop/);
    assert.match(overlayStyles, /\.hh-child-feature-backdrop[\s\S]*?position:\s*fixed[\s\S]*?z-index:\s*63[\s\S]*?inset:\s*0/);
    assert.match(overlayStyles, /\.hh-parent-content-modal--child[\s\S]*?width:\s*min\([^)]+\)[\s\S]*?height:\s*min\([^)]+\)/);
  });

  it('keeps the landscape game panel dense without shrinking touch targets below 44px', () => {
    assert.match(worldStyles, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-parent-content-modal--child \.hh-game-panel/);
    assert.match(worldStyles, /\.hh-parent-content-modal--child \.hh-game-panel h2[\s\S]*?font-size:/);
    assert.match(worldStyles, /\.hh-parent-content-modal--child \.hh-game-tabs button[\s\S]*?min-height:\s*44px/);
    assert.match(worldStyles, /\.hh-parent-content-modal--child \.hh-game-action-button[\s\S]*?min-height:\s*44px/);
  });
});
