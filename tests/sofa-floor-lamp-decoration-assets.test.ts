import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getLocalGameAsset } from '../src/features/world/game-content-assets';

const root = new URL('../', import.meta.url);
const migration = readFileSync(new URL('supabase/migrations/20260824154500_add_sofa_floor_lamp_decorations.sql', root), 'utf8');

const assets = [
  {
    key: 'decoration.sofa',
    model: 'public/assets/decorations/sofa.glb',
    thumbnail: 'public/assets/decorations/sofa-thumbnail.png',
    maxBytes: 1_000_000,
    groundOffset: '0.5177779794',
    triangleCount: '93866',
  },
  {
    key: 'decoration.floor-lamp',
    model: 'public/assets/decorations/floor-lamp.glb',
    thumbnail: 'public/assets/decorations/floor-lamp-thumbnail.png',
    maxBytes: 600_000,
    groundOffset: '0.9516010284',
    triangleCount: '47338',
  },
] as const;

describe('sofa and floor lamp decoration assets', () => {
  it('ships compact Draco/WebP GLBs with tangents and transparent thumbnails', () => {
    assets.forEach((asset) => {
      const model = new URL(asset.model, root);
      const thumbnail = new URL(asset.thumbnail, root);

      assert.equal(existsSync(model), true, `missing decoration model: ${asset.model}`);
      assert.equal(existsSync(thumbnail), true, `missing decoration thumbnail: ${asset.thumbnail}`);
      assert.ok(statSync(model).size < asset.maxBytes, `${asset.model} should stay compact`);
      const modelContents = readFileSync(model).toString('latin1');
      assert.match(modelContents, /KHR_draco_mesh_compression/);
      assert.match(modelContents, /EXT_texture_webp/);
      assert.match(modelContents, /TANGENT/);

      const thumbnailContents = readFileSync(thumbnail);
      assert.equal(thumbnailContents.toString('ascii', 1, 4), 'PNG');
      assert.equal(thumbnailContents[25], 6, `${asset.thumbnail} must use RGBA`);
    });
  });

  it('registers both items with distinct local assets and grounded placement metadata', () => {
    assert.deepEqual(getLocalGameAsset('decoration', 'decoration.sofa'), {
      modelUrl: '/assets/decorations/sofa.glb',
      thumbnailUrl: '/assets/decorations/sofa-thumbnail.png',
    });
    assert.deepEqual(getLocalGameAsset('decoration', 'decoration.floor-lamp'), {
      modelUrl: '/assets/decorations/floor-lamp.glb',
      thumbnailUrl: '/assets/decorations/floor-lamp-thumbnail.png',
    });
    assets.forEach((asset) => {
      assert.match(migration, new RegExp(asset.key.replace('.', '\\.')));
      assert.match(migration, new RegExp(asset.model.split('/').pop()?.replace('.', '\\.') ?? ''));
      assert.match(migration, new RegExp(asset.thumbnail.split('/').pop()?.replace('.', '\\.') ?? ''));
      assert.match(migration, new RegExp(`'groundOffset', ${asset.groundOffset}`));
      assert.match(migration, new RegExp(`'triangleCount', ${asset.triangleCount}`));
    });
    assert.match(migration, /'decoration\.sofa'[\s\S]*'collisionShape', 'rectangle'/);
    assert.match(migration, /'decoration\.floor-lamp'[\s\S]*'collisionShape', 'circle'/);
  });
});
