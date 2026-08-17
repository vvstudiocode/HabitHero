import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getLocalGameAsset,
  getLocalGameThumbnailUrl,
  isLocalGameItemInventorySupported,
  isLocalGameItemShopSupported,
} from '../src/features/world/game-content-assets';
import { createChildGameDataMap } from '../src/features/world/game-data';

describe('local game content assets', () => {
  it('resolves packaged assets by item type and asset key', () => {
    assert.deepEqual(getLocalGameAsset('character', 'character.arthur'), {
      modelUrl: '/assets/characters/arthur.glb',
      thumbnailUrl: '/assets/characters/arthur-thumbnail.webp',
    });
    assert.deepEqual(getLocalGameAsset('decoration', 'decoration.study-desk'), {
      modelUrl: '/assets/decorations/study-desk.glb',
      thumbnailUrl: '/assets/decorations/study-desk-thumbnail.png',
    });
    assert.deepEqual(getLocalGameAsset('decoration', 'decoration.fountain'), {
      modelUrl: '/assets/decorations/fountain.glb',
      thumbnailUrl: '/assets/decorations/fountain-thumbnail.png',
    });
  });

  it('does not treat SQL-provided paths as local app assets', () => {
    assert.deepEqual(getLocalGameAsset('pet', 'pet.not-in-this-app'), {
      modelUrl: null,
      thumbnailUrl: null,
    });
    assert.equal(getLocalGameThumbnailUrl({
      itemType: 'pet',
      assetKey: 'pet.not-in-this-app',
    }), null);
    assert.equal(isLocalGameItemShopSupported({
      itemType: 'pet',
      assetKey: 'pet.not-in-this-app',
    }), false);
  });

  it('keeps the procedural starter character while filtering unsupported owned items', () => {
    assert.equal(isLocalGameItemInventorySupported({
      itemType: 'character',
      assetKey: 'character.anime-maiden',
      isStarter: true,
    }), true);
    assert.equal(isLocalGameItemInventorySupported({
      itemType: 'pet',
      assetKey: 'pet.not-in-this-app',
      isStarter: false,
    }), false);
    assert.equal(isLocalGameItemInventorySupported({
      itemType: 'pet',
      assetKey: 'pet.oum',
      isStarter: false,
    }), true);
  });

  it('strips unknown SQL thumbnail paths while keeping the catalog row', () => {
    const data = createChildGameDataMap(
      ['child-a'],
      [{
        id: 'future-pet',
        item_type: 'pet',
        name: '未來寵物',
        description: '',
        scroll_price: 4,
        asset_key: 'pet.future-pet',
        thumbnail_url: '/assets/pets/future-pet-thumbnail.png',
        is_active: true,
        is_starter: false,
        is_stackable: false,
        collision_radius: 0.3,
        min_scale: 0.8,
        max_scale: 1.2,
        sort_order: 1,
        metadata: { model: '/assets/pets/future-pet.glb' },
      }],
      [],
      [],
      [],
      [],
      [],
      [],
    );

    assert.equal(data['child-a'].catalog[0].thumbnailUrl, null);
  });

  it('uses the packaged thumbnail even when SQL points at a different path', () => {
    const data = createChildGameDataMap(
      ['child-a'],
      [{
        id: 'known-pet',
        item_type: 'pet',
        name: '歐姆',
        description: '',
        scroll_price: 4,
        asset_key: 'pet.oum',
        thumbnail_url: '/assets/pets/wrong-thumbnail.png',
        is_active: true,
        is_starter: false,
        is_stackable: false,
        collision_radius: 0.3,
        min_scale: 0.8,
        max_scale: 1.2,
        sort_order: 1,
        metadata: { model: '/assets/pets/wrong-model.glb' },
      }],
      [],
      [],
      [],
      [],
      [],
      [],
    );

    assert.equal(data['child-a'].catalog[0].thumbnailUrl, '/assets/pets/oum-thumbnail.webp');
  });
});
