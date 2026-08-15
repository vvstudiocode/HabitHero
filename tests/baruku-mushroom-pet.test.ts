import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);

test('ships Baruku mushroom as a compact animated pet shop asset', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260813040721_add_baruku_mushroom_pet.sql', root), 'utf8');
  const model = new URL('public/assets/pets/baruku-mushroom.glb', root);
  const modelContents = await readFile(model);

  await access(model);
  const modelStats = await stat(model);
  assert.ok(modelStats.size > 100_000);
  assert.ok(modelStats.size < 1 * 1024 * 1024, 'Baruku GLB should stay below 1 MB for mobile delivery');
  assert.equal(modelContents.toString('ascii', 0, 4), 'glTF');
  assert.match(modelContents.toString('latin1'), /Walk_Forward/);
  assert.match(modelContents.toString('latin1'), /Walk_InPlace/);
  assert.match(modelContents.toString('latin1'), /KHR_draco_mesh_compression/);
  assert.match(modelContents.toString('latin1'), /EXT_texture_webp/);
  assert.match(migration, /pet\.baruku-mushroom/);
  assert.match(migration, /巴魯菇/);
  assert.match(migration, /\/assets\/pets\/baruku-mushroom\.glb/);
  assert.match(migration, /\/assets\/pets\/baruku-mushroom-thumbnail\.png/);
});

test('ships a transparent RGBA Baruku mushroom shop thumbnail', async () => {
  const thumbnail = await readFile(new URL('public/assets/pets/baruku-mushroom-thumbnail.png', root));
  assert.equal(thumbnail.subarray(25, 26)[0], 6, 'thumbnail PNG must use RGBA color type');
});
