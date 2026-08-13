import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GameCatalogItem } from '../src/features/world/contracts';
import { getPetModelUrl, resolvePetCatalogItem } from '../src/features/world/pet-model-assets';

const fallbackUrl = '/assets/starlight-sprout-pet.glb';

function pet(assetKey: string, model: string): GameCatalogItem {
  return {
    id: assetKey,
    itemType: 'pet',
    name: assetKey,
    description: '',
    scrollPrice: 1,
    assetKey,
    thumbnailUrl: null,
    isActive: true,
    isStarter: false,
    isStackable: false,
    collisionRadius: 0.3,
    minScale: 0.8,
    maxScale: 1.2,
    sortOrder: 1,
    metadata: { model },
  };
}

describe('pet model asset resolution', () => {
  it('keeps the supplied pet identities tied to their canonical model paths', () => {
    const swappedMetadataStar = pet('pet.star-diver', '/assets/pets/teddy-sou.glb');
    const swappedMetadataTeddy = pet('pet.teddy-sou', '/assets/pets/star-diver.glb');

    assert.equal(
      getPetModelUrl(swappedMetadataStar, fallbackUrl),
      '/assets/pets/star-diver.glb',
    );
    assert.equal(
      getPetModelUrl(swappedMetadataTeddy, fallbackUrl),
      '/assets/pets/teddy-sou.glb',
    );
  });

  it('resolves a roaming pet by asset key when its legacy entity has no catalog id', () => {
    const rabbit = pet('pet.magellan-rabbit', '/assets/pets/magellan-rabbit.glb');
    const byId = new Map([[rabbit.id, rabbit]]);
    const byAssetKey = new Map([[rabbit.assetKey, rabbit]]);

    assert.equal(
      resolvePetCatalogItem({ catalogItemId: undefined, assetKey: rabbit.assetKey }, byId, byAssetKey),
      rabbit,
    );
  });

  it('prefers the catalog id and falls back to the asset key', () => {
    const forest = pet('pet.forest-guardian', '/assets/forest-guardian.glb');
    const rabbit = pet('pet.magellan-rabbit', '/assets/pets/magellan-rabbit.glb');
    const byId = new Map([[forest.id, forest]]);
    const byAssetKey = new Map([[rabbit.assetKey, rabbit]]);

    assert.equal(
      resolvePetCatalogItem({ catalogItemId: forest.id, assetKey: rabbit.assetKey }, byId, byAssetKey),
      forest,
    );
    assert.equal(
      getPetModelUrl(rabbit, fallbackUrl),
      '/assets/pets/magellan-rabbit.glb',
    );
  });

  it('uses the safe fallback only when the catalog has no usable model path', () => {
    const invalid = pet('pet.invalid', 'https://example.com/not-local.glb');
    assert.equal(getPetModelUrl(invalid, fallbackUrl), fallbackUrl);
    assert.equal(getPetModelUrl(undefined, fallbackUrl), fallbackUrl);
  });
});
