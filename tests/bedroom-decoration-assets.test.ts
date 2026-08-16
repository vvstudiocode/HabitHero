import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';

const root = new URL('../', import.meta.url);
const catalogMigration = readFileSync(new URL('supabase/migrations/20260816045548_add_bedroom_decorations.sql', root), 'utf8');
const assetMigration = readFileSync(new URL('supabase/migrations/20260816052206_improve_bedroom_decoration_assets.sql', root), 'utf8');

const assets = [
  ['public/assets/decorations/bed.glb', 15505],
  ['public/assets/decorations/nightstand.glb', 8511],
] as const;

describe('bedroom decoration assets', () => {
  it('ships seam-preserving compressed GLBs with tangents and compact transfer size', () => {
    assets.forEach(([asset, triangleCount]) => {
      const file = new URL(asset, root);
      assert.equal(existsSync(file), true, `missing bedroom asset: ${asset}`);
      assert.ok(statSync(file).size < 600_000, `${asset} should stay below 600 KB`);
      const binary = readFileSync(file);
      assert.match(binary.toString('latin1'), /KHR_draco_mesh_compression/);
      assert.match(binary.toString('latin1'), /EXT_texture_webp/);
      assert.match(binary.toString('latin1'), /TANGENT/);
      assert.match(assetMigration, new RegExp(`'triangleCount', ${triangleCount}`));
    });
  });

  it('registers the bed and nightstand with the decoration catalog', () => {
    ['decoration.bed', 'decoration.nightstand'].forEach((assetKey) => {
      assert.match(catalogMigration, new RegExp(assetKey.replace('.', '\\.')));
    });
    ['bed.glb', 'nightstand.glb', 'bed-thumbnail.png', 'nightstand-thumbnail.png'].forEach((asset) => {
      assert.match(catalogMigration, new RegExp(asset.replace('.', '\\.')));
    });
  });
});
