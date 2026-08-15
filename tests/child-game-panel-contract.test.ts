import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  degreesToRadians,
  getActiveDecorationEntities,
  getWorldRevisionAfterMutation,
  radiansToDegrees,
  toDecorationDraft,
} from '../src/features/world/components/decoration-editing';

const childGamePanelSource = readFileSync(
  new URL('../src/features/world/components/ChildGamePanel.tsx', import.meta.url),
  'utf8',
);
const childDashboardSource = readFileSync(
  new URL('../src/components/ChildDashboard.tsx', import.meta.url),
  'utf8',
);
const dataAccessSource = readFileSync(
  new URL('../src/lib/data-access.ts', import.meta.url),
  'utf8',
);
const storeSource = readFileSync(
  new URL('../src/store.tsx', import.meta.url),
  'utf8',
);
const terrainWorldLayerSource = readFileSync(
  new URL('../src/features/world/TerrainWorldLayer.tsx', import.meta.url),
  'utf8',
);
const modalSourceForOverflow = readFileSync(
  new URL('../src/styles/modals.css', import.meta.url),
  'utf8',
);

describe('child game panel decoration editing', () => {
  it('uses the shared catalog card for the child shop', () => {
    assert.match(childGamePanelSource, /<GameItemCard/);
    assert.match(childGamePanelSource, /mode="child"/);
    assert.match(childGamePanelSource, /showMeta=\{false\}/);
    assert.match(childGamePanelSource, /onOpenPreview=\{openShopPreview\}/);
    const cardUsage = childGamePanelSource.match(/<GameItemCard[\s\S]*?\/>/)?.[0] ?? '';
    assert.doesNotMatch(cardUsage, /onPurchase=/);
    assert.match(childGamePanelSource, /<GameItemLightbox[\s\S]*?purchaseDisabled=/);
    assert.match(childGamePanelSource, /<GameItemLightbox[\s\S]*?purchaseLabel=/);
    assert.match(childGamePanelSource, /onPurchase=\{kind === 'shop' \? handlePreviewPurchase : undefined\}/);
  });

  it('keeps direct inventory decoration placement inside catalog bounds', () => {
    assert.match(childGamePanelSource, /decorationDrafts\[newDraftKey\] \?\? createDecorationPlacementDraft\(item\)/);
    assert.match(childGamePanelSource, /isDecorationPlacementValid\(draft, item,/);
    assert.match(childGamePanelSource, /const newDraftValid = isDecorationDraftValid\(inventory\.id, newDraft\)/);
  });

  it('closes the shop item lightbox before starting the purchase placement flow', () => {
    const purchaseHandlerStart = childGamePanelSource.indexOf('const handlePreviewPurchase');
    const purchaseHandlerEnd = childGamePanelSource.indexOf('const openInventoryPreview', purchaseHandlerStart);
    const purchaseHandler = childGamePanelSource.slice(purchaseHandlerStart, purchaseHandlerEnd);

    assert.match(purchaseHandler, /setPreviewItem\(null\)/);
    assert.match(purchaseHandler, /setPreviewInventory\(null\)/);
    assert.ok(purchaseHandler.indexOf('setPreviewItem(null)') < purchaseHandler.indexOf('onPurchase('));
  });

  it('uses the shared square cards and action modal for the child inventory', () => {
    const inventorySection = childGamePanelSource.match(/\{kind === 'inventory' && \([\s\S]*?\{kind === 'shop' && \(/)?.[0] ?? '';
    assert.doesNotMatch(inventorySection, /GameCatalogLayoutControls/);
    assert.match(inventorySection, /GameItemCard/);
    assert.match(inventorySection, /hh-game-catalog-grid/);
    assert.match(inventorySection, /openInventoryPreview/);
    assert.match(childGamePanelSource, /actionContent=\{previewInventoryActions\}/);
    assert.match(childGamePanelSource, /onEquipCharacter/);
    assert.match(childGamePanelSource, /onPlaceDecoration/);
  });

  it('keeps child layout controls beside the wallet and uses icon-only category tabs', () => {
    assert.match(childGamePanelSource, /hh-game-wallet-row[\s\S]*GameCatalogLayoutControls/);
    assert.match(childGamePanelSource, /ScrollText size=\{17\} strokeWidth=\{2\.5\}/);
    assert.doesNotMatch(childGamePanelSource, /Coins size=\{20\}/);
    assert.match(childGamePanelSource, /hh-game-tabs hh-game-tabs--icons/);
    assert.match(childGamePanelSource, /aria-label=\{label\}/);
    assert.match(childGamePanelSource, /title=\{label\}/);
    assert.match(childGamePanelSource, /hh-game-lightbox-pet-rename-row/);
    assert.doesNotMatch(childGamePanelSource, /hh-game-inventory-heading/);
    assert.doesNotMatch(childGamePanelSource, /用卷軸交換/);
  });

  it('keeps every active entity for a stackable inventory item addressable by entity id', () => {
    const entities = [
      { id: 'entity-1', inventoryItemId: 'inventory-1', entityKind: 'decoration', isActive: true },
      { id: 'entity-2', inventoryItemId: 'inventory-1', entityKind: 'decoration', isActive: true },
      { id: 'entity-3', inventoryItemId: 'inventory-2', entityKind: 'decoration', isActive: true },
    ] as never[];

    assert.deepEqual(getActiveDecorationEntities(entities, 'inventory-1').map((entity) => entity.id), ['entity-1', 'entity-2']);
  });

  it('uses the returned revision and safely advances when a legacy callback returns no revision', () => {
    assert.equal(getWorldRevisionAfterMutation(4, 9), 9);
    assert.equal(getWorldRevisionAfterMutation(4), 5);
  });

  it('keeps follow and roaming mutations typed and wired as world revision results', () => {
    assert.match(dataAccessSource, /setFollowingPet\(childId: string, inventoryItemId: string \| null\): Promise<WorldMutationResult>/);
    assert.match(dataAccessSource, /setRoamingPets\(childId: string, inventoryItemIds: string\[\]\): Promise<WorldMutationResult>/);
    assert.match(dataAccessSource, /setFollowingPets\(childId: string, inventoryItemIds: string\[\]\): Promise<WorldMutationResult>/);
    assert.match(dataAccessSource, /async setFollowingPets\([\s\S]*?set_following_pets[\s\S]*?return \{ revision: Number\(result\.revision\) \};/);
    assert.match(dataAccessSource, /async setRoamingPets\([\s\S]*?set_roaming_pets[\s\S]*?return \{ revision: Number\(result\.revision\) \};/);
    assert.doesNotMatch(dataAccessSource, /setFollowingPet\(childId: string, inventoryItemId: string \| null\): Promise<void>/);
    assert.doesNotMatch(dataAccessSource, /setRoamingPets\(childId: string, inventoryItemIds: string\[\]\): Promise<void>/);
    assert.match(storeSource, /setFollowingPet: \(childId: string, inventoryItemId: string \| null\) => Promise<WorldMutationResult>/);
    assert.match(storeSource, /setRoamingPets: \(childId: string, inventoryItemIds: string\[\]\) => Promise<WorldMutationResult>/);
    assert.match(childGamePanelSource, /onSetFollowingPets: \(inventoryItemIds: string\[\]\) => Promise<WorldMutationResult>/);
    assert.match(childGamePanelSource, /onSetRoamingPets: \(inventoryItemIds: string\[\]\) => Promise<WorldMutationResult>/);
    assert.match(childGamePanelSource, /commitWorldMutation\(\(\) => onSetFollowingPets\(next\)/);
    assert.match(childGamePanelSource, /commitWorldMutation\(\(\) => onSetRoamingPets\(/);
  });

  it('keeps the server transform as the cancel target, including rotationY', () => {
    assert.deepEqual(toDecorationDraft({ x: 1, z: -2, rotationY: 0.75, scale: 1.2 }), {
      x: 1,
      z: -2,
      rotationY: 0.75,
      scale: 1.2,
    });
  });

  it('converts the child-facing rotation control between degrees and world radians', () => {
    assert.equal(radiansToDegrees(Math.PI), 180);
    assert.equal(degreesToRadians(180), Math.PI);
    assert.match(childGamePanelSource, /radiansToDegrees\(draft\.rotationY\)/);
    assert.match(childGamePanelSource, /degreesToRadians\(Number\(event\.target\.value\)\)/);
  });

  it('exposes explicit transform actions and queues retries with the latest world revision', () => {
    assert.ok(childGamePanelSource.includes('onCollectAllDecorations: (expectedRevision: number) => Promise<WorldMutationResult>'));
    assert.ok(childDashboardSource.includes('collectAllWorldDecorations,'));
    assert.ok(childDashboardSource.includes('onCollectAllDecorations={(expectedRevision) => collectAllWorldDecorations(activeChild.id, expectedRevision)}'));

    for (const label of ['X', 'Z', '旋轉Y', '大小', '套用', '取消', '重試', '全部收回']) {
      assert.ok(childGamePanelSource.includes(label), `missing decoration UI label: ${label}`);
    }

    assert.ok(childGamePanelSource.includes('worldMutationQueueRef.current'));
    assert.ok(childGamePanelSource.includes('worldRevisionRef.current'));
    assert.ok(childGamePanelSource.includes('getWorldRevisionAfterMutation'));
    assert.ok(childGamePanelSource.includes('entityId: entity.id'));
    assert.ok(childGamePanelSource.includes('onUpdateDecoration({'));
    assert.equal(childGamePanelSource.includes('onBlur'), false);
  });

  it('keeps decoration inventory controls available alongside the layout control', () => {
    assert.match(childGamePanelSource, /inventorySection === 'decoration'[\s\S]*?全部收回/);
    assert.match(childGamePanelSource, /onCollectAllDecorations/);
  });

  it('returns to the 3D world immediately while character sync continues in the background', () => {
    assert.match(childDashboardSource, /onEquipCharacter=\{async \(inventoryItemId\) => \{[\s\S]*?closeChildFeature\(\);[\s\S]*?await equipGameCharacter\(activeChild\.id, inventoryItemId\);/);
  });

  it('keeps the feature close control in the outer child modal only', () => {
    assert.doesNotMatch(childGamePanelSource, /hh-game-panel-close|aria-label="關閉功能頁面"/);
    assert.match(childDashboardSource, /className="hh-character-icon-button"/);
  });

  it('offers a post-purchase placement choice and returns to the world placement mode', () => {
    assert.match(childGamePanelSource, /onPurchase: .*Promise<GamePurchaseResult>/);
    assert.match(childDashboardSource, /要現在放置/);
    assert.match(childDashboardSource, /現在放置/);
    assert.match(childDashboardSource, /稍後再放/);
    assert.match(childDashboardSource, /setDecorationPurchasePrompt/);
    assert.match(childDashboardSource, /placement={decorationPlacement/);
    assert.match(childDashboardSource, /onCompletePlacement/);
    assert.match(terrainWorldLayerSource, /裝飾放置工具/);
    assert.match(terrainWorldLayerSource, /拖曳或點一下草地來選位置/);
    assert.match(terrainWorldLayerSource, /完成放置/);
  });

  it('uses the 0.1 minimum size and optimistic placement state', () => {
    assert.match(childGamePanelSource, /<input type="number" min="0\.1" max="3" step="0\.1" value=\{draft\.scale\}/);
    assert.match(storeSource, /patchPlacedWorldEntity/);
    assert.match(childDashboardSource, /const placementSession = decorationPlacement;/);
    assert.match(childDashboardSource, /setDecorationPlacement\(null\);[\s\S]*?placeWorldEntity/);
  });

  it('keeps the furniture lightbox free of a visible page scrollbar', () => {
    assert.match(modalSourceForOverflow, /\.hh-game-item-lightbox-content[\s\S]*?scrollbar-width:\s*none/);
  });
});
