import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getLocalGameAsset } from '../src/features/world/game-content-assets';

const root = new URL('../', import.meta.url);
const migration = readFileSync(new URL('supabase/migrations/20260824162000_add_gaming_chair_decoration.sql', root), 'utf8');

describe('gaming chair decoration asset', () => {
  it('ships a compact Draco/WebP GLB with tangents and a transparent thumbnail', () => {
    const model = new URL('public/assets/decorations/gaming-chair.glb', root);
    const thumbnail = new URL('public/assets/decorations/gaming-chair-thumbnail.png', root);

    assert.equal(existsSync(model), true);
    assert.equal(existsSync(thumbnail), true);
    assert.ok(statSync(model).size < 1_200_000, 'gaming chair GLB should stay compact');
    const modelContents = readFileSync(model).toString('latin1');
    assert.match(modelContents, /KHR_draco_mesh_compression/);
    assert.match(modelContents, /EXT_texture_webp/);
    assert.match(modelContents, /TANGENT/);

    const thumbnailContents = readFileSync(thumbnail);
    assert.equal(thumbnailContents.toString('ascii', 1, 4), 'PNG');
    assert.equal(thumbnailContents[25], 6, 'gaming chair thumbnail must use RGBA');
  });

  it('registers the local asset and grounded placement metadata', () => {
    assert.deepEqual(getLocalGameAsset('decoration', 'decoration.gaming-chair'), {
      modelUrl: '/assets/decorations/gaming-chair.glb',
      thumbnailUrl: '/assets/decorations/gaming-chair-thumbnail.png',
    });
    assert.match(migration, /'decoration\.gaming-chair'/);
    assert.match(migration, /gaming-chair\.glb/);
    assert.match(migration, /gaming-chair-thumbnail\.png/);
    assert.match(migration, /'groundOffset', 0\.9510509968/);
    assert.match(migration, /'triangleCount', 140906/);
    assert.match(migration, /'collisionShape', 'rectangle'/);
  });
});
