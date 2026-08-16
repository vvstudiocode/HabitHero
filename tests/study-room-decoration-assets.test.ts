import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';

const root = new URL('../', import.meta.url);
const migration = readFileSync(new URL('supabase/migrations/20260815160614_add_study_room_decorations.sql', root), 'utf8');
const runtime = readFileSync(new URL('src/features/world/prototype-world-runtime.ts', root), 'utf8');

const assets = [
  'public/assets/decorations/study-desk.glb',
  'public/assets/decorations/bookcase.glb',
  'public/assets/decorations/study-chair.glb',
];

describe('study room decoration assets', () => {
  it('ships compact Draco/WebP GLBs for the three supplied furniture pieces', () => {
    assets.forEach((asset) => {
      const file = new URL(asset, root);
      assert.equal(existsSync(file), true, `missing furniture asset: ${asset}`);
      assert.ok(statSync(file).size < 3_000_000, `${asset} should stay below 3 MB`);
    });
  });

  it('retires the original primitive decorations and registers the supplied furniture', () => {
    ['decoration.flower-lantern', 'decoration.mushroom-stool', 'decoration.adventure-flag'].forEach((assetKey) => {
      assert.match(migration, new RegExp(`${assetKey.replace('.', '\\.')}`));
    });
    assert.match(migration, /set is_active = false[\s\S]*?where item_type = 'decoration'/i);
    ['decoration.study-desk', 'decoration.bookcase', 'decoration.study-chair'].forEach((assetKey) => {
      assert.match(migration, new RegExp(assetKey.replace('.', '\\.') ));
    });
    assert.match(migration, /study-desk\.glb/);
    assert.match(migration, /bookcase\.glb/);
    assert.match(migration, /study-chair\.glb/);
    assert.match(migration, /study-desk-thumbnail\.png/);
    assert.match(migration, /bookcase-thumbnail\.png/);
    assert.match(migration, /study-chair-thumbnail\.png/);
  });

  it('resolves static decoration models from catalog metadata instead of the retired primitives', () => {
    assert.match(runtime, /getDecorationModelUrl/);
    assert.match(runtime, /loadDecorationModelSource/);
    assert.match(runtime, /ensurePlacementModel/);
    assert.match(runtime, /decorationModelSources\.get/);
    assert.doesNotMatch(runtime, /primitive === 'lantern'|primitive === 'mushroom'|primitive === 'flag'/);
  });
});
