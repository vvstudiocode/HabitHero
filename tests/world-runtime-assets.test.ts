import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PROTOTYPE_WORLD_ASSETS,
  getDecorationCatalogItem,
  getDecorationCollisionInput,
  getDecorationGroundOffset,
  getDecorationModelUrl,
} from '../src/features/world/prototype-world-runtime';
import type { ChildGameData, ChildWorldEntity, GameCatalogItem } from '../src/features/world/contracts';

function catalogItem(overrides: Partial<GameCatalogItem> = {}): GameCatalogItem {
  return {
    id: 'decoration-study-desk',
    itemType: 'decoration',
    name: 'Study desk',
    description: '',
    scrollPrice: 0,
    assetKey: 'decoration.study-desk',
    thumbnailUrl: null,
    isActive: true,
    isStarter: false,
    isStackable: true,
    collisionRadius: 0.38,
    minScale: 0.7,
    maxScale: 1.5,
    sortOrder: 1,
    metadata: {},
    ...overrides,
  };
}

function worldEntity(overrides: Partial<ChildWorldEntity> = {}): ChildWorldEntity {
  return {
    id: 'entity-1',
    inventoryItemId: 'inventory-decoration',
    entityKind: 'decoration',
    worldLayoutVersion: 1,
    x: 1.25,
    y: 0,
    z: -1.5,
    rotationX: 0,
    rotationY: 0.75,
    rotationZ: 0,
    scale: 1.2,
    behaviorMode: 'static',
    roamingSlot: null,
    isActive: true,
    collisionRadius: 0.3,
    ...overrides,
  };
}

function gameData(catalog: GameCatalogItem[], entity: ChildWorldEntity): ChildGameData {
  return {
    walletBalance: 0,
    catalog,
    prices: {},
    inventory: [{ id: entity.inventoryItemId, catalogItemId: catalog[0]?.id ?? 'missing', quantity: 1, acquiredVia: 'purchase', acquiredAt: '' }],
    loadout: null,
    worldEntities: [entity],
    worldRevision: 1,
  };
}

describe('world runtime asset metadata helpers', () => {
  it('keeps prototype world asset urls stable', () => {
    assert.match(PROTOTYPE_WORLD_ASSETS.tree, /big-tree-optimized\.glb$/);
    assert.equal(PROTOTYPE_WORLD_ASSETS.character, '/assets/characters/arthur.glb');
    assert.equal(PROTOTYPE_WORLD_ASSETS.roamingCharacter, '/assets/habithero-v16-wanderer.glb');
    assert.match(PROTOTYPE_WORLD_ASSETS.skybox, /sky-equirectangular-day\.png$/);
  });

  it('resolves decoration catalog items from the entity id before inventory fallback', () => {
    const fallback = catalogItem({ id: 'decoration-fallback', assetKey: 'decoration.bookcase' });
    const explicit = catalogItem({ id: 'decoration-explicit', assetKey: 'decoration.study-chair' });
    const entity = worldEntity({ catalogItemId: explicit.id });

    assert.equal(getDecorationCatalogItem(gameData([fallback, explicit], entity), entity), explicit);
  });

  it('falls back through inventory and ignores non-decoration catalog rows', () => {
    const decoration = catalogItem({ id: 'decoration-bookcase', assetKey: 'decoration.bookcase' });
    const character = catalogItem({ id: 'character-arthur', itemType: 'character', assetKey: 'character.arthur' });
    const entity = worldEntity();

    assert.equal(getDecorationCatalogItem(gameData([decoration], entity), entity), decoration);
    assert.equal(getDecorationCatalogItem(gameData([character], entity), entity), undefined);
  });

  it('returns local model urls only for decoration items', () => {
    assert.equal(getDecorationModelUrl(catalogItem({ assetKey: 'decoration.study-desk' })), '/assets/decorations/study-desk.glb');
    assert.equal(getDecorationModelUrl(catalogItem({ itemType: 'pet', assetKey: 'pet.nibus' })), undefined);
    assert.equal(getDecorationModelUrl(undefined), undefined);
  });

  it('keeps finite ground offsets and defaults invalid metadata to zero', () => {
    assert.equal(getDecorationGroundOffset(catalogItem({ metadata: { groundOffset: 0.5455 } })), 0.5455);
    assert.equal(getDecorationGroundOffset(catalogItem({ metadata: { groundOffset: Number.NaN } })), 0);
    assert.equal(getDecorationGroundOffset(catalogItem({ metadata: { groundOffset: '0.5' } })), 0);
    assert.equal(getDecorationGroundOffset(undefined), 0);
  });

  it('preserves decoration collision input and metadata-derived shape fields', () => {
    const item = catalogItem({
      metadata: {
        collisionShape: 'rectangle',
        collisionWidth: 1.8,
        collisionDepth: 0.75,
        navigationInset: 0.12,
      },
    });
    const entity = worldEntity({ catalogItemId: item.id, collisionRadius: 0.42 });

    assert.deepEqual(getDecorationCollisionInput(gameData([item], entity), entity), {
      positionX: 1.25,
      positionZ: -1.5,
      scale: 1.2,
      rotationY: 0.75,
      collisionRadius: 0.42,
      collisionShape: 'rectangle',
      collisionWidth: 1.8,
      collisionDepth: 0.75,
      navigationInset: 0.12,
    });
  });
});
