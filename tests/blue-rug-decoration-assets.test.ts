import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getLocalGameAsset } from '../src/features/world/game-content-assets';
import { getDecorationNavigationRadius } from '../src/features/world/world-collision';

const root = new URL('../', import.meta.url);
const migration = readFileSync(new URL('supabase/migrations/20260824164500_add_blue_rug_decoration.sql', root), 'utf8');
const grassMaskMigration = readFileSync(new URL('supabase/migrations/20260824173000_add_blue_rug_grass_mask.sql', root), 'utf8');

describe('blue rug decoration asset', () => {
  it('ships a compact Draco/WebP GLB with tangents and a transparent thumbnail', () => {
    const model = new URL('public/assets/decorations/blue-rug.glb', root);
    const thumbnail = new URL('public/assets/decorations/blue-rug-thumbnail.png', root);

    assert.equal(existsSync(model), true);
    assert.equal(existsSync(thumbnail), true);
    assert.ok(statSync(model).size < 2_000_000, 'blue rug GLB should stay compact');
    const modelContents = readFileSync(model).toString('latin1');
    assert.match(modelContents, /KHR_draco_mesh_compression/);
    assert.match(modelContents, /EXT_texture_webp/);
    assert.match(modelContents, /TANGENT/);

    const thumbnailContents = readFileSync(thumbnail);
    assert.equal(thumbnailContents.toString('ascii', 1, 4), 'PNG');
    assert.equal(thumbnailContents[25], 6, 'blue rug thumbnail must use RGBA');
  });

  it('registers the local asset and makes the rug fully pass-through', () => {
    assert.deepEqual(getLocalGameAsset('decoration', 'decoration.blue-rug'), {
      modelUrl: '/assets/decorations/blue-rug.glb',
      thumbnailUrl: '/assets/decorations/blue-rug-thumbnail.png',
    });
    assert.equal(getDecorationNavigationRadius({ passThrough: true }, 0.05), 0);
    assert.match(migration, /'decoration\.blue-rug'/);
    assert.match(migration, /blue-rug\.glb/);
    assert.match(migration, /blue-rug-thumbnail\.png/);
    assert.match(migration, /'groundOffset', 0\.0219800007/);
    assert.match(migration, /'passThrough', true/);
    assert.match(migration, /'groundCoverWidth', 1\.96/);
    assert.match(migration, /'groundCoverDepth', 1\.96/);
    assert.match(migration, /'groundCoverEdgeSoftness', 0\.12/);
    assert.match(grassMaskMigration, /groundCoverWidth/);
    assert.match(grassMaskMigration, /groundCoverDepth/);
    assert.match(grassMaskMigration, /groundCoverEdgeSoftness/);
    assert.match(migration, /'triangleCount', 275200/);
  });
});
