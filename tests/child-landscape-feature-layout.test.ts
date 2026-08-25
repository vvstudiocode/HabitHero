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
const modalStyles = readFileSync(
  new URL('../src/styles/modals.css', import.meta.url),
  'utf8',
);
const worldStyles = readFileSync(
  new URL('../src/styles/world.css', import.meta.url),
  'utf8',
);
const growthSummarySource = readFileSync(
  new URL('../src/features/growth/components/GrowthSummaryPanel.tsx', import.meta.url),
  'utf8',
);
const adventureSummarySource = readFileSync(
  new URL('../src/features/adventures/components/TodayAdventureSummary.tsx', import.meta.url),
  'utf8',
);

describe('child landscape feature layout', () => {
  it('gives child feature pages their own compact modal and input-blocking backdrop', () => {
    assert.match(childDashboardSource, /hh-child-feature-backdrop/);
    assert.match(childDashboardSource, /hh-parent-content-modal--child/);
    assert.match(overlayStyles, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-child-feature-backdrop/);
    assert.match(overlayStyles, /\.hh-child-feature-backdrop[\s\S]*?position:\s*fixed[\s\S]*?z-index:\s*63[\s\S]*?inset:\s*0/);
    assert.match(overlayStyles, /\.hh-parent-content-modal--child[\s\S]*?width:\s*min\(760px,\s*calc\(100vw - 48px\)\)[\s\S]*?height:\s*min\(350px,\s*calc\(100dvh - 40px\)\)/);
    assert.match(overlayStyles, /\.hh-parent-content-modal--child \.hh-parent-content-modal-bar--child[\s\S]*?padding:\s*16px 16px 8px/);
  });

  it('keeps the landscape game panel dense without shrinking touch targets below 44px', () => {
    assert.match(worldStyles, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-parent-content-modal--child \.hh-game-panel/);
    assert.match(worldStyles, /\.hh-parent-content-modal--child \.hh-game-panel h2[\s\S]*?font-size:\s*18px/);
    assert.match(worldStyles, /\.hh-parent-content-modal--child \.hh-game-tabs button[\s\S]*?min-height:\s*44px/);
    assert.match(worldStyles, /\.hh-parent-content-modal--child \.hh-game-action-button[\s\S]*?min-height:\s*44px/);
    assert.match(worldStyles, /\.hh-parent-content-modal--child \.hh-game-catalog-grid[\s\S]*?grid-template-columns:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(worldStyles, /\.hh-parent-content-modal--child \.hh-game-catalog-card[\s\S]*?background:\s*rgb\(255 253 248 \/ 58%\)/);
    assert.match(worldStyles, /\.hh-parent-content-modal--child \.hh-game-settings-card[\s\S]*?padding:\s*8px 12px/);
    assert.match(worldStyles, /\.hh-parent-content-modal--child \.hh-game-settings-card--toggle strong[\s\S]*?font-size:\s*14px/);
  });

  it('gives adventure, growth, and reward pages a shared compact landscape content contract', () => {
    assert.match(childDashboardSource, /hh-child-feature-page--wishlist/);
    assert.match(growthSummarySource, /hh-child-feature-page--growth/);
    assert.match(adventureSummarySource, /hh-child-feature-page--adventure/);
    assert.match(modalStyles, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-parent-content-modal--child \.hh-child-feature-page/);
    assert.match(modalStyles, /\.hh-child-feature-page--adventure[\s\S]*?\.hh-child-feature-task[\s\S]*?padding:\s*8px 12px/);
    assert.match(modalStyles, /\.hh-child-feature-page--growth[\s\S]*?\.hh-child-feature-summary-trigger[\s\S]*?min-height:\s*56px/);
    assert.match(modalStyles, /\.hh-child-feature-page--wishlist[\s\S]*?\.hh-child-reward-grid[\s\S]*?grid-template-columns:\s*repeat\(5,/);
  });
});
