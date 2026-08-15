import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getActiveDecorationEntities, getWorldRevisionAfterMutation, toDecorationDraft } from '../src/features/world/components/decoration-editing';

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

  it('returns to the 3D world immediately after a successful character switch', () => {
    assert.match(childDashboardSource, /onEquipCharacter=\{async \(inventoryItemId\) => \{[\s\S]*?await equipGameCharacter\(activeChild\.id, inventoryItemId\);[\s\S]*?closeChildFeature\(\);/);
  });

  it('keeps the feature close control in the outer child modal only', () => {
    assert.doesNotMatch(childGamePanelSource, /hh-game-panel-close|aria-label="關閉功能頁面"/);
    assert.match(childDashboardSource, /className="hh-character-icon-button"/);
  });
});
