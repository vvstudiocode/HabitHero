import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getLocalGameAsset } from '../src/features/world/game-content-assets';

const root = new URL('../', import.meta.url);
const migration = readFileSync(new URL('supabase/migrations/20260824153000_add_computer_desk_decoration.sql', root), 'utf8');

describe('computer desk decoration assets', () => {
  it('ships a compact Draco/WebP GLB and a transparent RGBA thumbnail', () => {
    const model = new URL('public/assets/decorations/computer-desk.glb', root);
    const thumbnail = new URL('public/assets/decorations/computer-desk-thumbnail.png', root);

    assert.equal(existsSync(model), true, 'missing computer desk GLB');
    assert.equal(existsSync(thumbnail), true, 'missing computer desk thumbnail');
    assert.ok(statSync(model).size < 2_000_000, 'computer desk GLB should stay below 2 MB');
    const modelContents = readFileSync(model).toString('latin1');
    assert.match(modelContents, /KHR_draco_mesh_compression/);
    assert.match(modelContents, /EXT_texture_webp/);
    assert.match(modelContents, /TANGENT/);

    const thumbnailContents = readFileSync(thumbnail);
    assert.equal(thumbnailContents.toString('ascii', 1, 4), 'PNG');
    assert.equal(thumbnailContents[25], 6, 'computer desk thumbnail must use RGBA');
  });

  it('registers the new desk without replacing the existing study desk', () => {
    assert.deepEqual(getLocalGameAsset('decoration', 'decoration.computer-desk'), {
      modelUrl: '/assets/decorations/computer-desk.glb',
      thumbnailUrl: '/assets/decorations/computer-desk-thumbnail.png',
    });
    assert.match(migration, /'decoration\.computer-desk'/);
    assert.match(migration, /computer-desk\.glb/);
    assert.match(migration, /computer-desk-thumbnail\.png/);
    assert.match(migration, /'groundOffset', 0\.8533437848/);
    assert.match(migration, /'collisionShape', 'rectangle'/);
    assert.match(migration, /'collisionWidth', 2\.0/);
    assert.match(migration, /'collisionDepth', 1\.17/);
  });
});
