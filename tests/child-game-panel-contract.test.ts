import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  degreesToRadians,
  getActiveDecorationEntities,
  getWorldRevisionAfterMutation,
  getWorldRevisionAfterRefresh,
  radiansToDegrees,
  toDecorationDraft,
} from '../src/features/world/components/decoration-editing';

const childGamePanelSource = readFileSync(
  new URL('../src/features/world/components/ChildGamePanel.tsx', import.meta.url),
  'utf8',
);
const categoryTabsSource = readFileSync(
  new URL('../src/features/world/components/GameCategoryTabs.tsx', import.meta.url),
  'utf8',
);
const childDashboardSource = readFileSync(
  new URL('../src/components/ChildDashboard.tsx', import.meta.url),
  'utf8',
);
const childDecorationActionsSource = readFileSync(
  new URL('../src/features/shared-decorations/child-decoration-actions.ts', import.meta.url),
  'utf8',
);
const npcDialogueSource = readFileSync(
  new URL('../src/features/world/components/WorldNpcDialoguePanel.tsx', import.meta.url),
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
const runtimeSource = readFileSync(
  new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url),
  'utf8',
);
const worldPlacementSource = readFileSync(
  new URL('../src/features/world/world-placement.ts', import.meta.url),
  'utf8',
);
const modalSourceForOverflow = readFileSync(
  new URL('../src/styles/modals.css', import.meta.url),
  'utf8',
);
const worldStylesSource = readFileSync(
  new URL('../src/styles/world.css', import.meta.url),
  'utf8',
);
const characterStylesSource = readFileSync(
  new URL('../src/styles/character.css', import.meta.url),
  'utf8',
);
const worldControlsSource = readFileSync(
  new URL('../src/styles/world-controls.css', import.meta.url),
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

  it('starts every new inventory decoration in the world placement mode', () => {
    assert.match(childGamePanelSource, /isDecorationPlacementValid\(draft, item,/);
    assert.match(childGamePanelSource, /closePreview\(\);\s*onStartDecorationPlacement\(inventory\.id, item\.id\)/);
    assert.doesNotMatch(childGamePanelSource, /void placeDecoration\(inventory\.id, newDraft\)/);
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
    assert.match(childGamePanelSource, /onStartDecorationPlacement/);
    assert.match(childGamePanelSource, /放置\{entities\.length > 0 \? '一份' : ''\}/);
  });

  it('applies the packaged-asset compatibility gate to the child inventory', () => {
    assert.match(childGamePanelSource, /!isLocalGameItemInventorySupported\(item\)/);
  });

  it('moves the wallet balance to the shared child modal bar and keeps layout controls', () => {
    assert.match(childGamePanelSource, /hh-game-panel-title-row[\s\S]*GameCatalogLayoutControls/);
    assert.doesNotMatch(childGamePanelSource, /hh-game-wallet-row--controls-only/);
    assert.doesNotMatch(childGamePanelSource, /aria-label=\{`目前有 \$\{gameData\.walletBalance\} 張卷軸`\}/);
    assert.doesNotMatch(childGamePanelSource, /Coins size=\{20\}/);
    assert.match(childDashboardSource, /heroFeature === 'inventory' \|\| heroFeature === 'shop'/);
    assert.match(childDashboardSource, /目前有 \$\{displayedScrolls\} 張卷軸/);
    assert.match(categoryTabsSource, /hh-game-category-tabs/);
    assert.match(categoryTabsSource, /aria-label=\{label\}/);
    assert.match(categoryTabsSource, /title=\{label\}/);
    assert.match(childGamePanelSource, /hh-game-lightbox-pet-rename-row/);
    assert.doesNotMatch(childGamePanelSource, /hh-game-inventory-heading/);
    assert.doesNotMatch(childGamePanelSource, /用卷軸交換/);
  });

  it('starts the child shop in the four-column layout', () => {
    assert.match(childGamePanelSource, /const \[inventoryColumns, setInventoryColumns\] = useState<GameCatalogLayoutColumns>\(4\)/);
    assert.match(childGamePanelSource, /const \[shopColumns, setShopColumns\] = useState<GameCatalogLayoutColumns>\(4\)/);
    assert.match(childGamePanelSource, /hh-game-catalog-grid hh-game-catalog-grid--\$\{shopColumns\}/);
  });

  it('keeps the backpack layout control on the same title row', () => {
    const titleRow = childGamePanelSource.match(/className="hh-game-panel-title-row"[\s\S]*?<\/div>/)?.[0] ?? '';
    assert.match(titleRow, /<h2 id="hh-game-panel-title">\{title\}<\/h2>/);
    assert.match(titleRow, /GameCatalogLayoutControls columns=\{inventoryColumns\}/);
  });

  it('keeps child category tabs beside the title with compact visuals and 44px targets', () => {
    const titleRow = childGamePanelSource.match(/className="hh-game-panel-title-row"[\s\S]*?<\/div>/)?.[0] ?? '';
    assert.match(titleRow, /<GameCategoryTabs/);
    assert.match(childGamePanelSource, /selected=\{inventorySection\}/);
    assert.match(childGamePanelSource, /selected=\{shopSection\}/);
    assert.match(worldStylesSource, /\.hh-game-category-tabs[\s\S]*?display:\s*inline-flex/);
    assert.match(worldStylesSource, /\.hh-game-category-tabs button[\s\S]*?min-width:\s*44px/);
    assert.match(worldStylesSource, /\.hh-game-category-tabs button[\s\S]*?min-height:\s*44px/);
    assert.match(worldStylesSource, /\.hh-game-category-tabs button svg[\s\S]*?width:\s*16px/);
  });

  it('keeps child catalog cards translucent in the modal', () => {
    assert.match(worldStylesSource, /\.hh-parent-content-modal--child \.hh-game-catalog-card[\s\S]*?background:\s*rgb\(255 253 248 \/ 58%\)/);
  });

  it('removes the redundant adventure-world eyebrow', () => {
    assert.doesNotMatch(childGamePanelSource, /hh-game-panel-eyebrow|冒險世界/);
    assert.doesNotMatch(childGamePanelSource, /Compass/);
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

  it('lets an authoritative refresh replace a stale optimistic revision', () => {
    assert.equal(getWorldRevisionAfterRefresh(860, 859), 859);
    assert.equal(getWorldRevisionAfterRefresh(859, Number.NaN), 859);
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
    assert.match(storeSource, /setRoamingPets: \(childId: string, inventoryItemIds: string\[\], positionOverrides\?/);
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

  it('keeps the shared rotation conversion utilities available for world controls', () => {
    assert.equal(radiansToDegrees(Math.PI), 180);
    assert.equal(degreesToRadians(180), Math.PI);
    assert.match(terrainWorldLayerSource, /onPlacementControl/);
  });

  it('exposes explicit transform actions and queues retries with the latest world revision', () => {
    assert.ok(childGamePanelSource.includes('onCollectAllDecorations: (expectedRevision: number) => Promise<WorldMutationResult>'));
    assert.ok(childDashboardSource.includes('collectAllWorldDecorations,'));
    assert.ok(childDashboardSource.includes('onCollectAllDecorations={(expectedRevision) => collectAllWorldDecorations(activeChild.id, expectedRevision)}'));

    for (const label of ['重新擺放', '收回', '全部收回']) {
      assert.ok(childGamePanelSource.includes(label), `missing decoration UI label: ${label}`);
    }
    assert.doesNotMatch(childGamePanelSource, /<label className="hh-game-lightbox-field">X<input/);
    assert.doesNotMatch(childGamePanelSource, /<label className="hh-game-lightbox-field">Z<input/);

    assert.ok(childGamePanelSource.includes('worldMutationQueueRef.current'));
    assert.ok(childGamePanelSource.includes('worldRevisionRef.current'));
    assert.ok(childGamePanelSource.includes('getWorldRevisionAfterMutation'));
    assert.ok(childGamePanelSource.includes('entityId: entity.id'));
    assert.ok(childGamePanelSource.includes('onUpdateDecoration({'));
    assert.equal(childGamePanelSource.includes('onBlur'), false);
  });

  it('keeps placed decoration actions compact with only reposition and collect buttons', () => {
    const entityActionsStart = childGamePanelSource.indexOf('{entities.map((entity) => {');
    const entityActionsEnd = childGamePanelSource.indexOf('{hasRoom &&', entityActionsStart);
    const entityActions = childGamePanelSource.slice(entityActionsStart, entityActionsEnd);

    assert.ok(entityActionsStart >= 0);
    assert.ok(entityActionsEnd > entityActionsStart);
    assert.doesNotMatch(entityActions, /第 \{entityIndex \+ 1\} 份裝飾/);
    assert.doesNotMatch(entityActions, /回到世界點選家具/);
    assert.doesNotMatch(entityActions, /hh-game-lightbox-action-group/);
    assert.match(entityActions, /重新擺放/);
    assert.match(entityActions, /收回/);
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
    assert.match(terrainWorldLayerSource, /按住裝飾並拖曳來移動位置；雙指捏合可縮放與旋轉/);
    assert.doesNotMatch(terrainWorldLayerSource, /拖曳或點擊草地來選擇裝飾位置/);
    assert.match(terrainWorldLayerSource, /完成放置/);
  });

  it('lets children select an existing furniture item in the world and re-place it', () => {
    assert.match(childDashboardSource, /onStartDecorationPlacement={startExistingDecorationPlacement}/);
    assert.match(childDecorationActionsSource, /draft:\s*\{\s*x:\s*entity\.x/);
    assert.match(terrainWorldLayerSource, /onStartDecorationPlacement/);
    assert.match(terrainWorldLayerSource, /重新擺放/);
    assert.match(runtimeSource, /onDecorationSelect/);
    assert.match(runtimeSource, /decorationRaycaster/);
  });

  it('offers reposition and collect actions for the selected world decoration', () => {
    assert.match(terrainWorldLayerSource, /onCollectDecoration/);
    assert.match(terrainWorldLayerSource, /aria-label=\{`收回\$\{selectedItem\.name\}`\}/);
    assert.match(terrainWorldLayerSource, /hh-world-decoration-actions/);
    const terrainLayerUsage = childDashboardSource.match(/<TerrainWorldLayer[\s\S]*?\/>/)?.[0] ?? '';
    assert.match(terrainLayerUsage, /onCollectDecoration=\{collectSelectedDecoration\}/);
    assert.match(childDashboardSource, /removeWorldEntity\(activeChild\.id/);
  });

  it('dismisses the selected-decoration actions when another control receives input', () => {
    assert.match(terrainWorldLayerSource, /document\.addEventListener\('pointerdown', dismissDecorationSelection\)/);
    assert.match(terrainWorldLayerSource, /document\.addEventListener\('focusin', dismissDecorationSelection\)/);
  });

  it('keeps selected-decoration actions translucent, crisp, and forest-toned', () => {
    assert.match(worldControlsSource, /\.hh-world-decoration-action\s*\{[\s\S]*?color:\s*var\(--hh-primary-dark\)/);
    assert.match(worldControlsSource, /\.hh-world-decoration-action\s*\{[\s\S]*?background:\s*rgb\(255 253 248 \/ 88%\)/);
    assert.match(worldControlsSource, /\.hh-world-decoration-action\s*\{[\s\S]*?backdrop-filter:\s*none/);
    assert.match(worldControlsSource, /\.hh-world-decoration-action:hover,[\s\S]*?background:\s*rgb\(255 253 248 \/ 96%\)/);
  });

  it('uses the 0.1 minimum size and optimistic placement state', () => {
    assert.match(worldPlacementSource, /Math\.max\(0\.1, bounds\?\.minScale \?\? 0\.1\)/);
    assert.match(terrainWorldLayerSource, /縮小/);
    assert.match(storeSource, /patchPlacedWorldEntity/);
    assert.match(childDecorationActionsSource, /const placementSession = decorationPlacement;/);
    assert.match(childDecorationActionsSource, /setDecorationPlacement\(null\);[\s\S]*?placeWorldEntity/);
  });

  it('keeps the furniture lightbox free of a visible page scrollbar', () => {
    assert.match(modalSourceForOverflow, /\.hh-game-item-lightbox-content[\s\S]*?scrollbar-width:\s*none/);
  });

  it('uses an eight-column image grid for NPC offerings in landscape', () => {
    assert.match(modalSourceForOverflow, /@media \(orientation: landscape\)[\s\S]*?\.hh-world-npc-dialogue-panel \.hh-world-npc-offering-list[\s\S]*?grid-template-columns:\s*repeat\(8, minmax\(0, 1fr\)\)/);
    assert.match(modalSourceForOverflow, /\.hh-world-npc-dialogue-panel \.hh-world-npc-offering-card[\s\S]*?aspect-ratio:\s*1 \/ 1[\s\S]*?background:\s*transparent/);
    assert.match(modalSourceForOverflow, /\.hh-world-npc-dialogue-panel \.hh-world-npc-offering-details,[\s\S]*?\.hh-world-npc-dialogue-panel \.hh-world-npc-offering-action[\s\S]*?display:\s*none/);
  });

  it('keeps pet NPC dialogue as a horizontal 3D preview with purchase copy', () => {
    assert.match(npcDialogueSource, /GameItem3DPreview/);
    assert.match(npcDialogueSource, /hh-world-npc-dialogue-panel--pet/);
    assert.match(npcDialogueSource, /hh-world-npc-pet-purchase/);
    assert.match(npcDialogueSource, /handlePetPurchase/);
    assert.match(modalSourceForOverflow, /\.hh-world-npc-dialogue-panel--pet\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.1fr\) minmax\(210px, \.9fr\)/);
    assert.match(modalSourceForOverflow, /\.hh-world-npc-dialogue-panel--pet \.hh-game-item-lightbox-3d[\s\S]*?grid-column:\s*1/);
    assert.match(modalSourceForOverflow, /\.hh-world-npc-dialogue-panel--pet \.hh-game-item-lightbox-copy[\s\S]*?grid-column:\s*2/);
  });

  it('keeps the child world pinned to the viewport after placement controls close', () => {
    assert.match(childDashboardSource, /hh-dashboard-screen--child/);
    assert.match(characterStylesSource, /\.hh-dashboard-screen--child\s*\{[\s\S]*?position:\s*fixed/);
    assert.doesNotMatch(childDashboardSource, /hh-dashboard-screen--child[^\"]*pb-24/);
  });

  it('removes the placement grid while keeping the placement preview', () => {
    assert.match(terrainWorldLayerSource, /裝飾放置工具/);
    assert.match(runtimeSource, /updatePlacementPreview/);
    assert.doesNotMatch(runtimeSource, /getPlacementGridCells|placementGrid|decoration-placement-grid/);
  });

  it('uses compact floating furniture controls with one lower rotate action', () => {
    const placementControlsStart = terrainWorldLayerSource.indexOf('className="hh-world-placement-controls"');
    const placementControlsEnd = terrainWorldLayerSource.indexOf('{status ===', placementControlsStart);
    const placementControls = terrainWorldLayerSource.slice(placementControlsStart, placementControlsEnd);
    const controlOrder = [
      'hh-world-placement-scale-down',
      'hh-world-placement-scale-up',
      'hh-world-placement-rotate-bottom',
      'aria-label="完成放置"',
      'aria-label="取消"',
    ].map((marker) => placementControls.indexOf(marker));

    assert.ok(controlOrder.every((index) => index >= 0));
    assert.ok(controlOrder.every((index, position) => position === 0 || index > controlOrder[position - 1]));
    assert.match(terrainWorldLayerSource, /hh-world-placement-rotate-bottom/);
    assert.doesNotMatch(terrainWorldLayerSource, /hh-world-placement-rotate-top/);
    assert.match(terrainWorldLayerSource, /aria-label="縮小"/);
    assert.match(terrainWorldLayerSource, /aria-label="放大"/);
    assert.match(terrainWorldLayerSource, /aria-label="完成放置"/);
    assert.match(terrainWorldLayerSource, /aria-label="取消"/);
    assert.match(runtimeSource, /onPlacementGestureChange/);
    assert.match(runtimeSource, /placementPointers/);
    assert.match(runtimeSource, /scaleFactor/);
    assert.match(runtimeSource, /rotationDelta/);
    assert.match(worldControlsSource, /.hh-world-placement-controls\s*\{[\s\S]*?position:\s*fixed/);
    assert.match(worldControlsSource, /.hh-world-placement-controls\s*\{[\s\S]*?display:\s*flex/);
    assert.match(worldControlsSource, /.hh-world-placement-rotate-bottom\s*\{[\s\S]*?touch-action:\s*none/);
    assert.doesNotMatch(worldControlsSource, /\.hh-world-placement-copy/);
  });

  it('supports press-and-drag rotation with left and right direction control', () => {
    assert.match(terrainWorldLayerSource, /startPlacementRotationDrag/);
    assert.match(terrainWorldLayerSource, /updatePlacementRotationDrag/);
    assert.match(terrainWorldLayerSource, /finishPlacementRotationDrag/);
    assert.match(terrainWorldLayerSource, /onPointerDown=\{startPlacementRotationDrag\}/);
    assert.match(terrainWorldLayerSource, /onPointerMove=\{updatePlacementRotationDrag\}/);
    assert.match(terrainWorldLayerSource, /onPointerUp=\{finishPlacementRotationDrag\}/);
    assert.match(terrainWorldLayerSource, /clientX/);
    assert.match(terrainWorldLayerSource, /onPlacementGestureChange\?\.\(\{ scaleFactor: 1, rotationDelta/);
  });

  it('clears dashboard chrome and docks placement controls at the bottom', () => {
    assert.match(childDashboardSource, /is-decoration-placement/);
    assert.match(characterStylesSource, /is-decoration-placement[\s\S]*?\.hh-character-stats/);
    assert.match(characterStylesSource, /is-decoration-placement[\s\S]*?\.hh-child-adventure-board/);
    assert.match(worldControlsSource, /is-decoration-placement[\s\S]*?\.hh-world-joystick/);
    assert.match(worldControlsSource, /\.hh-world-placement-controls\s*\{[\s\S]*?bottom:/);
    assert.match(worldControlsSource, /transform:\s*translateX\(-50%\)/);
  });

  it('labels the placement exit as cancel and keeps invalid-position guidance clear', () => {
    assert.match(terrainWorldLayerSource, /aria-label="取消"/);
    assert.doesNotMatch(terrainWorldLayerSource, /先放背包/);
    assert.match(terrainWorldLayerSource, /此位置不能放置，請換一個地方/);
    assert.doesNotMatch(terrainWorldLayerSource, /這裡不能放，換一個草地位置/);
  });
});
