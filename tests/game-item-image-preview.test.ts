import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const previewSource = readFileSync(new URL('../src/features/world/components/GameItemImagePreview.tsx', import.meta.url), 'utf8');
const worldStyles = readFileSync(new URL('../src/styles/world.css', import.meta.url), 'utf8');
const modalStyles = readFileSync(new URL('../src/styles/modals.css', import.meta.url), 'utf8');

test('pet previews no longer apply pixel-only rendering', () => {
  assert.doesNotMatch(previewSource, /hh-game-item-preview--pixel/);
  assert.doesNotMatch(previewSource, /hh-game-item-lightbox-image--pixel/);
  assert.match(worldStyles, /\.hh-game-item-preview[\s\S]*object-fit: contain/);
});

test('item detail preview includes the item description and price contract', () => {
  assert.match(previewSource, /item\.description/);
  assert.match(previewSource, /price/);
  assert.match(previewSource, /ScrollText size=\{17\} strokeWidth=\{2\.5\}/);
  assert.doesNotMatch(previewSource, /Coins size=\{16\}/);
  assert.doesNotMatch(previewSource, /categoryLabel/);
});

test('item detail preview owns the child purchase action', () => {
  assert.match(previewSource, /purchaseDisabled/);
  assert.match(previewSource, /purchaseLabel/);
  assert.match(previewSource, /onPurchase/);
  assert.match(previewSource, /hh-game-item-lightbox-purchase/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-purchase[\s\S]*min-height: 44px/);
});

test('item detail preview accepts inventory actions alongside purchase actions', () => {
  assert.match(previewSource, /actionContent/);
  assert.match(previewSource, /hh-game-item-lightbox-actions/);
});

test('catalog cards keep the image and compact information in one square surface', () => {
  assert.match(worldStyles, /\.hh-game-catalog-card-media[\s\S]*position: relative/);
  assert.match(worldStyles, /\.hh-game-catalog-card-media[\s\S]*height: 100%/);
  assert.match(worldStyles, /\.hh-game-catalog-card-overlay[\s\S]*position: absolute/);
  assert.match(worldStyles, /\.hh-game-catalog-card-overlay[\s\S]*justify-content: space-between/);
  assert.match(worldStyles, /\.hh-game-item-preview[\s\S]*aspect-ratio: 1 \/ 1/);
});

test('catalog cards keep shop and backpack images free of decorative frames', () => {
  assert.match(worldStyles, /\.hh-game-catalog-card \{[^}]*border:\s*0;/);
  assert.match(worldStyles, /\.hh-game-item-thumbnail-button \{[^}]*border:\s*0;/);
});

test('catalog cards keep the image and information free of drop shadows', () => {
  assert.match(worldStyles, /\.hh-game-catalog-card \{[\s\S]*box-shadow: none/);
  assert.match(worldStyles, /\.hh-game-catalog-card \{[^}]*background: transparent;/);
  assert.match(worldStyles, /\.hh-game-catalog-card-media \{[^}]*background: transparent;/);
  assert.match(worldStyles, /\.hh-game-price-editor-thumbnail \{[^}]*background: transparent;/);
  assert.match(worldStyles, /\.hh-game-catalog-card-overlay[\s\S]*background: transparent/);
  assert.match(worldStyles, /\.hh-game-layout-controls \{[\s\S]*position: relative/);
  assert.match(worldStyles, /\.hh-game-layout-trigger[\s\S]*background: transparent/);
  assert.match(worldStyles, /\.hh-game-layout-menu[\s\S]*position: absolute/);
  assert.match(worldStyles, /\.hh-game-layout-menu[\s\S]*grid-template-columns: 44px/);
});

test('lightbox images preserve their transparent asset background', () => {
  assert.match(modalStyles, /\.hh-game-item-lightbox-content img \{[^}]*background: transparent;/);
});

test('item detail close control sits at the top edge of the content', () => {
  assert.match(modalStyles, /\.hh-game-item-lightbox-close[\s\S]*top: 0/);
});

test('pet rename keeps its action row on one line', () => {
  assert.match(modalStyles, /\.hh-game-lightbox-pet-rename-row[\s\S]*grid-template-columns/);
  assert.match(modalStyles, /\.hh-game-lightbox-pet-rename-row[\s\S]*flex-wrap: nowrap/);
});

test('item detail preview preserves the page width while locking the body scroll', () => {
  assert.match(previewSource, /scrollbarWidth/);
  assert.match(previewSource, /paddingRight/);
  assert.match(modalStyles, /\.hh-game-item-lightbox[\s\S]*overflow-x: hidden/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-content[\s\S]*overflow-x: hidden/);
});
