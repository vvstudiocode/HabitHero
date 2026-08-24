import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getLocalGameAsset } from '../src/features/world/game-content-assets';
import { getDecorationNavigationRadius } from '../src/features/world/world-collision';

const root = new URL('../', import.meta.url);
const migration = [
  readFileSync(new URL('supabase/migrations/20260824180000_add_rug_decorations.sql', root), 'utf8'),
  readFileSync(new URL('supabase/migrations/20260824191000_add_more_rug_decorations.sql', root), 'utf8'),
].join('\n');
const assets = [
  {
    key: 'decoration.patchwork-rug',
    model: 'patchwork-rug.glb',
    thumbnail: 'patchwork-rug-thumbnail.png',
    sizeLimit: 500_000,
    triangleCount: 8862,
  },
  {
    key: 'decoration.pawprint-rug',
    model: 'pawprint-rug.glb',
    thumbnail: 'pawprint-rug-thumbnail.png',
    sizeLimit: 800_000,
    triangleCount: 79462,
  },
  {
    key: 'decoration.lavender-pattern-rug',
    model: 'lavender-pattern-rug.glb',
    thumbnail: 'lavender-pattern-rug-thumbnail.png',
    sizeLimit: 500_000,
    triangleCount: 11928,
  },
  {
    key: 'decoration.royal-crest-rug',
    model: 'royal-crest-rug.glb',
    thumbnail: 'royal-crest-rug-thumbnail.png',
    sizeLimit: 500_000,
    triangleCount: 9488,
  },
] as const;

describe('new rug decoration assets', () => {
  it('ships compact Draco/WebP GLBs and transparent RGBA thumbnails', () => {
    assets.forEach((asset) => {
      const model = new URL(`public/assets/decorations/${asset.model}`, root);
      const thumbnail = new URL(`public/assets/decorations/${asset.thumbnail}`, root);

      assert.equal(existsSync(model), true, `missing ${asset.model}`);
      assert.equal(existsSync(thumbnail), true, `missing ${asset.thumbnail}`);
      assert.ok(statSync(model).size < asset.sizeLimit, `${asset.model} should stay compact`);
      const modelContents = readFileSync(model).toString('latin1');
      assert.match(modelContents, /KHR_draco_mesh_compression/);
      assert.match(modelContents, /EXT_texture_webp/);
      assert.match(modelContents, /TANGENT/);

      const thumbnailContents = readFileSync(thumbnail);
      assert.equal(thumbnailContents.toString('ascii', 1, 4), 'PNG');
      assert.equal(thumbnailContents[25], 6, `${asset.thumbnail} must use RGBA`);
    });
  });

  it('registers all supplied rugs as pass-through floor decorations', () => {
    assets.forEach((asset) => {
      assert.deepEqual(getLocalGameAsset('decoration', asset.key), {
        modelUrl: `/assets/decorations/${asset.model}`,
        thumbnailUrl: `/assets/decorations/${asset.thumbnail}`,
      });
      assert.match(migration, new RegExp(asset.key.replace('.', '\\.')));
      assert.match(migration, new RegExp(asset.model.replace('.', '\\.')));
      assert.match(migration, new RegExp(asset.thumbnail.replace('.', '\\.')));
      assert.match(migration, new RegExp(`'triangleCount', ${asset.triangleCount}`));
    });
    assert.equal(getDecorationNavigationRadius({ passThrough: true }, 0.05), 0);
    assert.equal((migration.match(/'passThrough', true/g) ?? []).length, assets.length);
    assert.equal((migration.match(/'groundCoverWidth', 1\.96/g) ?? []).length, assets.length);
  });
});
