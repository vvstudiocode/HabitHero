import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getLocalGameAsset } from '../src/features/world/game-content-assets';

const root = new URL('../', import.meta.url);
const migration = readFileSync(new URL('supabase/migrations/20260817000000_add_curtain_wall_decoration.sql', root), 'utf8');
const placementMigration = readFileSync(new URL('supabase/migrations/20260817081546_tune_curtain_wall_placement.sql', root), 'utf8');
const sizeMigration = readFileSync(new URL('supabase/migrations/20260817083653_increase_wall_decoration_sizes.sql', root), 'utf8');
const boundaryMigration = readFileSync(new URL('supabase/migrations/20260817083834_allow_outer_grass_wall_placement.sql', root), 'utf8');

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

  it('ships the supplied plain wall with the same mobile asset treatment', () => {
    const model = new URL('public/assets/decorations/wall.glb', root);
    const thumbnail = new URL('public/assets/decorations/wall-thumbnail.webp', root);

    assert.equal(existsSync(model), true, 'missing plain wall GLB');
    assert.equal(existsSync(thumbnail), true, 'missing plain wall thumbnail');
    assert.equal(readFileSync(model).toString('ascii', 0, 4), 'glTF');
    assert.ok(statSync(model).size < 400_000, 'plain wall GLB should stay below 400 KB');
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
    assert.deepEqual(getLocalGameAsset('decoration', 'decoration.wall'), {
      modelUrl: '/assets/decorations/wall.glb',
      thumbnailUrl: '/assets/decorations/wall-thumbnail.webp',
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

  it('allows a larger wall footprint with a small positive navigation proxy', () => {
    assert.match(placementMigration, /max_scale = case[\s\S]*then 1\.25/);
    assert.match(placementMigration, /collision_radius = case[\s\S]*then 0\.280/);
    assert.match(placementMigration, /navigationRadius.*0\.28/);
    assert.match(placementMigration, /decoration-to-decoration overlap is allowed/i);
    assert.match(placementMigration, /decoration\.curtain-wall/);
  });

  it('registers the plain wall as a decoration-only overlap item', () => {
    assert.match(placementMigration, /decoration\.wall/);
    assert.match(placementMigration, /wall\.glb/);
    assert.match(placementMigration, /wall-thumbnail\.webp/);
    assert.match(placementMigration, /navigationRadius.*0\.28/);
  });

  it('raises the selectable and default size for both wall decorations', () => {
    assert.match(sizeMigration, /max_scale = 1\.5/);
    assert.match(sizeMigration, /decoration\.curtain-wall/);
    assert.match(sizeMigration, /decoration\.wall/);
    assert.match(sizeMigration, /defaultScale', 0\.72/);
  });

  it('keeps the server decoration boundary aligned with the visible meadow', () => {
    assert.match(boundaryMigration, /visible_grass_boundary numeric := 13\.475/);
    assert.match(boundaryMigration, /outside the visible meadow/);
    assert.doesNotMatch(boundaryMigration, /decorations cannot overlap/);
  });
});
