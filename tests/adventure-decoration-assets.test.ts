import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';

const root = new URL('../', import.meta.url);
const migration = readFileSync(new URL('supabase/migrations/20260816053842_add_adventure_table_fountain_decorations.sql', root), 'utf8');
const runtime = readFileSync(new URL('src/features/world/prototype-world-runtime.ts', root), 'utf8');

const assets = [
  ['public/assets/decorations/adventure-table.glb', 12697],
  ['public/assets/decorations/fountain.glb', 10991],
] as const;

describe('adventure table and fountain decoration assets', () => {
  it('ships seam-preserving Draco/WebP GLBs with tangents below 600 KB', () => {
    assets.forEach(([asset, triangleCount]) => {
      const file = new URL(asset, root);
      assert.equal(existsSync(file), true, `missing decoration asset: ${asset}`);
      assert.ok(statSync(file).size < 600_000, `${asset} should stay below 600 KB`);
      const binary = readFileSync(file).toString('latin1');
      assert.match(binary, /KHR_draco_mesh_compression/);
      assert.match(binary, /EXT_texture_webp/);
      assert.match(binary, /TANGENT/);
      assert.match(migration, new RegExp(`'triangleCount', ${triangleCount}`));
    });
  });

  it('registers both static GLB decorations with stable catalog keys and placement metadata', () => {
    ['decoration.adventure-table', 'decoration.fountain'].forEach((assetKey) => {
      assert.match(migration, new RegExp(assetKey.replace('.', '\\.')));
    });
    ['adventure-table.glb', 'fountain.glb', 'adventure-table-thumbnail.png', 'fountain-thumbnail.png'].forEach((asset) => {
      assert.match(migration, new RegExp(asset.replace('.', '\\.')));
    });
    assert.match(migration, /'renderMode', 'static-glb'/g);
    assert.match(migration, /'groundOffset', 0\.5455/);
    assert.match(migration, /'groundOffset', 1/);
  });

  it('keeps decoration loading on the DRACO-enabled safe GLTF path with fallback replacement', () => {
    assert.match(runtime, /loadGltfSafely/);
    assert.match(runtime, /GLTFLoader/);
    assert.match(runtime, /DRACOLoader/);
    assert.match(runtime, /setDecoderPath\('\/draco\/'\)/);
    assert.match(runtime, /loadDecorationModelSource/);
    assert.match(runtime, /createDecorationObject\(THREE, catalogItem, 1, decorationModelSource\)/);
    assert.match(runtime, /using a compact fallback/);
  });
});
