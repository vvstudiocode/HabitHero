import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isLocalGameItem3DPreviewEnabled } from '../src/features/world/game-content-assets';
import type { GameCatalogItem } from '../src/features/world/contracts';
const previewSource = readFileSync(new URL('../src/features/world/components/GameItemImagePreview.tsx', import.meta.url), 'utf8');
const childPanelSource = readFileSync(new URL('../src/features/world/components/ChildGamePanel.tsx', import.meta.url), 'utf8');
const parentPanelSource = readFileSync(new URL('../src/features/world/components/ParentGamePricePanel.tsx', import.meta.url), 'utf8');
const worldStyles = readFileSync(new URL('../src/styles/world.css', import.meta.url), 'utf8');
const modalStyles = readFileSync(new URL('../src/styles/modals.css', import.meta.url), 'utf8');

function previewItem(itemType: GameCatalogItem['itemType'], assetKey: string): Pick<GameCatalogItem, 'itemType' | 'assetKey'> {
  return { itemType, assetKey };
}

test('all local shop characters, pets, and decorations opt into the 3D preview', () => {
  assert.equal(isLocalGameItem3DPreviewEnabled(previewItem('pet', 'pet.arcadia')), true);
  assert.equal(isLocalGameItem3DPreviewEnabled(previewItem('pet', 'pet.oum')), true);
  assert.equal(isLocalGameItem3DPreviewEnabled(previewItem('character', 'character.arthur')), true);
  assert.equal(isLocalGameItem3DPreviewEnabled(previewItem('decoration', 'decoration.study-desk')), true);
  assert.equal(isLocalGameItem3DPreviewEnabled(previewItem('pet', 'pet.not-in-this-app')), false);
  assert.match(childPanelSource, /isLocalGameItem3DPreviewEnabled/);
  assert.match(childPanelSource, /use3DPreview=\{use3DPreview\}/);
  assert.match(parentPanelSource, /isLocalGameItem3DPreviewEnabled/);
  assert.match(parentPanelSource, /use3DPreview=\{use3DPreview\}/);
});

test('the detail modal can render a model preview while keeping the image fallback', () => {
  assert.match(previewSource, /GameItem3DPreview/);
  assert.match(previewSource, /use3DPreview/);
  assert.match(previewSource, /item\.thumbnailUrl/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-3d/);
});

test('the first 3D preview configures the shared Draco decoder for compressed GLBs', () => {
  const modelPreviewSource = readFileSync(new URL('../src/features/world/components/GameItem3DPreview.tsx', import.meta.url), 'utf8');
  assert.match(modelPreviewSource, /DRACOLoader/);
  assert.match(modelPreviewSource, /setDecoderPath\('\/draco\/'\)/);
  assert.match(modelPreviewSource, /setDRACOLoader/);
});

test('3D previews support pinch zoom and horizontal drag rotation only', () => {
  const modelPreviewSource = readFileSync(new URL('../src/features/world/components/GameItem3DPreview.tsx', import.meta.url), 'utf8');
  assert.match(modelPreviewSource, /activePointersRef/);
  assert.match(modelPreviewSource, /pinchDistanceRef/);
  assert.match(modelPreviewSource, /cameraRef\.current\.zoom/);
  assert.match(modelPreviewSource, /setPointerCapture/);
  assert.match(modelPreviewSource, /model\.rotation\.y/);
  assert.doesNotMatch(modelPreviewSource, /MAX_PREVIEW_PITCH/);
  assert.doesNotMatch(modelPreviewSource, /model\.rotation\.x\s*=\s*Math/);
  assert.match(modelPreviewSource, /camera\.position\.set\(0, 1\.27, 4\.6\)/);
  assert.match(modelPreviewSource, /camera\.lookAt\(0, 1\.12, 0\)/);
  assert.match(modelPreviewSource, /可拖曳左右旋轉，雙指縮放/);
  assert.match(modalStyles, /\.hh-game-item-lightbox \{[^}]*place-items: center;/);
  assert.match(modalStyles, /\.hh-game-item-lightbox \{[\s\S]*padding: max\(20px, env\(safe-area-inset-top, 0px\)\) 0 max\(20px, env\(safe-area-inset-bottom, 0px\)\) 0;/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-3d \{[\s\S]*touch-action: none/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-3d \{[\s\S]*width: 100%;/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-3d \{[\s\S]*height: min\(520px, calc\(100dvh/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-content \{[\s\S]*width: 100%;/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-content \{[\s\S]*max-width: 100%;/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-content \{[\s\S]*padding: 0 0 12px/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-close \{[^}]*top: 42px;[^}]*right: 23px;[^}]*z-index: 2/);
});

test('the Arcadia preview matches the world palette without a ground shadow or visible instructions', () => {
  const modelPreviewSource = readFileSync(new URL('../src/features/world/components/GameItem3DPreview.tsx', import.meta.url), 'utf8');
  assert.match(modelPreviewSource, /applyPicturebookPetMaterial/);
  assert.match(modelPreviewSource, /0xffebdf/);
  assert.match(modelPreviewSource, /0x777265/);
  assert.match(modelPreviewSource, /0xffd4b2/);
  assert.match(modelPreviewSource, /toneMappingExposure = 1\.12/);
  assert.match(modelPreviewSource, /HemisphereLight\(0xffebdf, 0x777265, 1\.86\)/);
  assert.match(modelPreviewSource, /DirectionalLight\(0xffd4b2, 3\.3\)/);
  assert.match(modelPreviewSource, /environmentIntensity = 0\.31/);
  assert.match(modelPreviewSource, /PREVIEW_MODEL_DIMENSION = 2\.7625 \* 0\.325/);
  assert.doesNotMatch(modelPreviewSource, /CircleGeometry/);
  assert.doesNotMatch(modelPreviewSource, /hh-game-item-lightbox-3d-status|hh-game-item-lightbox-3d-hint/);
  assert.match(modalStyles, /\.hh-game-item-lightbox-3d \{[\s\S]*background: transparent;/);
  assert.doesNotMatch(modalStyles, /\.hh-game-item-lightbox-3d-status/);
  assert.doesNotMatch(modalStyles, /\.hh-game-item-lightbox-3d-hint/);
});

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

test('item detail close control sits inside the preview frame', () => {
  assert.match(modalStyles, /\.hh-game-item-lightbox-close \{[^}]*top: 42px;[^}]*right: 23px;[^}]*z-index: 2/);
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
