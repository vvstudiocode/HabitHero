import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getLocalGameAsset } from '../src/features/world/game-content-assets';

const root = new URL('../', import.meta.url);
const migration = readFileSync(new URL('supabase/migrations/20260817000000_add_curtain_wall_decoration.sql', root), 'utf8');

describe('curtain wall decoration assets', () => {
  it('ships the supplied GLB and transparent catalog thumbnail', () => {
    const model = new URL('public/assets/decorations/curtain-wall.glb', root);
    const thumbnail = new URL('public/assets/decorations/curtain-wall-thumbnail.webp', root);

    assert.equal(existsSync(model), true, 'missing curtain wall GLB');
    assert.equal(existsSync(thumbnail), true, 'missing curtain wall thumbnail');
    assert.equal(readFileSync(model).toString('ascii', 0, 4), 'glTF');
    assert.ok(statSync(model).size < 600_000, 'curtain wall GLB should stay below 600 KB');
    const modelContents = readFileSync(model).toString('latin1');
    assert.match(modelContents, /KHR_draco_mesh_compression/);
    assert.match(modelContents, /EXT_texture_webp/);
    assert.match(readFileSync(thumbnail).toString('latin1'), /WEBP/);
  });

  it('resolves the packaged assets from the decoration catalog key', () => {
    assert.deepEqual(getLocalGameAsset('decoration', 'decoration.curtain-wall'), {
      modelUrl: '/assets/decorations/curtain-wall.glb',
      thumbnailUrl: '/assets/decorations/curtain-wall-thumbnail.webp',
    });
  });

  it('registers the static decoration with placement metadata', () => {
    assert.match(migration, /'decoration\.curtain-wall'/);
    assert.match(migration, /curtain-wall\.glb/);
    assert.match(migration, /curtain-wall-thumbnail\.webp/);
    assert.match(migration, /'renderMode', 'static-glb'/);
    assert.match(migration, /'defaultScale', 0\.58/);
    assert.match(migration, /'groundOffset', 0\.6102/);
  });
});
