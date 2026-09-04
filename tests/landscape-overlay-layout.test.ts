import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const characterStyles = readFileSync(
  new URL('../src/styles/character.css', import.meta.url),
  'utf8',
);
const indexHtml = readFileSync(
  new URL('../index.html', import.meta.url),
  'utf8',
);
const modalStyles = readFileSync(
  new URL('../src/styles/modals.css', import.meta.url),
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
const adventureDetail = readFileSync(
  new URL('../src/features/adventures/components/AdventureTaskDetail.tsx', import.meta.url),
  'utf8',
);

test('landscape item lightboxes keep the preview left and detail actions right inside the viewport', () => {
  assert.match(modalStyles, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-game-item-lightbox-content[\s\S]*?width:\s*min\(760px,\s*calc\(100vw - 32px\)\)/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-content[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.1fr\)\s+minmax\(210px,\s*\.9fr\)/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-content[\s\S]*?height:\s*min\(350px,\s*calc\(100dvh - 32px\)\)/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-3d[\s\S]*?grid-column:\s*1/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-copy[\s\S]*?grid-column:\s*2/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-close[\s\S]*?top:\s*12px[\s\S]*?right:\s*12px/);
});

test('landscape adventure board stays inside the safe-area overlay', () => {
  assert.match(characterStyles, /\.hh-child-adventure-board\s*\{[\s\S]*?width:\s*min\(100%,\s*var\(--hh-adventure-board-max-width\)\)/);
  assert.doesNotMatch(characterStyles, /\.hh-adventure-board-detail\s*\{[\s\S]*?border-(?:left|top):/);
  assert.match(adventureDetail, /\{!embedded\s*&&\s*\(/);
  assert.match(adventureDetail, /className="hh-adventure-button hh-adventure-detail-close"/);
  assert.match(characterStyles, /\.hh-character-menu\[data-menu-variant="child"\]\[data-active-menu="backpack"\] \.hh-character-menu-submenu[\s\S]*?right:\s*max\(16px,\s*calc\(env\(safe-area-inset-right,\s*0px\) \+ 16px\)\)/);
  assert.match(characterStyles, /\.hh-character-menu\[data-menu-variant="child"\]\[data-active-menu="backpack"\] \.hh-character-menu-submenu[\s\S]*?max-width:\s*calc\(100vw - env\(safe-area-inset-left,\s*0px\) - env\(safe-area-inset-right,\s*0px\) - 32px\)/);
});

test('landscape adventure board keeps its header fixed and scrolls each column independently', () => {
  assert.match(characterStyles, /\.hh-child-adventure-board\s*\{[\s\S]*?height:\s*min\(86dvh,\s*760px\)[\s\S]*?overflow:\s*hidden;/);
  assert.match(characterStyles, /\.hh-adventure-board-layout\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow:\s*hidden;/);
  assert.match(
    characterStyles,
    /\.hh-adventure-board-categories,\n\.hh-adventure-board-detail\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/,
  );
  assert.match(
    characterStyles,
    /\.hh-adventure-board-categories::-webkit-scrollbar,\n\.hh-adventure-board-detail::-webkit-scrollbar\s*\{[\s\S]*?display:\s*none;/,
  );
  assert.match(
    overlayStyles,
    /\.hh-adventure-board-detail \.hh-adventure-completion-actions\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?bottom:\s*0;/,
  );
});

test('the app opts into the full safe-area viewport so landscape insets are measurable', () => {
  assert.match(indexHtml, /name="viewport" content="width=device-width, initial-scale=1\.0, viewport-fit=cover"/);
});

test('landscape child catalogs use eight compact translucent cards and an 18px panel title', () => {
  assert.match(worldStyles, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-parent-content-modal--child \.hh-game-panel h2[\s\S]*?font-size:\s*18px/);
  assert.match(worldStyles, /\.hh-parent-content-modal--child \.hh-game-catalog-grid[\s\S]*?grid-template-columns:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(worldStyles, /\.hh-parent-content-modal--child \.hh-game-catalog-card[\s\S]*?background:\s*rgb\(255 253 248 \/ 58%\)/);
});
