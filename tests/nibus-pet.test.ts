import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);

test('ships Nibus as a compact animated pet shop asset', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260814014640_add_nibus_cloud_pet_and_idle_behavior.sql', root), 'utf8');
  const model = new URL('public/assets/pets/nibus.glb', root);
  const modelContents = await readFile(model);
  const modelStats = await stat(model);

  await access(model);
  assert.ok(modelStats.size > 100_000);
  assert.ok(modelStats.size < 1.6 * 1024 * 1024, 'Nibus GLB should stay compact for mobile delivery');
  assert.equal(modelContents.toString('ascii', 0, 4), 'glTF');
  assert.match(modelContents.toString('latin1'), /Walk_InPlace/);
  assert.match(modelContents.toString('latin1'), /Idle/);
  assert.match(modelContents.toString('latin1'), /KHR_draco_mesh_compression/);
  assert.match(modelContents.toString('latin1'), /EXT_texture_webp/);
  assert.match(migration, /pet\.nibus/);
  assert.match(migration, /尼布斯/);
  assert.match(migration, /\/assets\/pets\/nibus\.glb/);
  assert.match(migration, /\/assets\/pets\/nibus-thumbnail\.png/);
  assert.match(migration, /idleAnimation/);
  assert.match(migration, /animationStates/);
});

test('ships a transparent Nibus shop thumbnail', async () => {
  const thumbnail = await readFile(new URL('public/assets/pets/nibus-thumbnail.png', root));
  assert.equal(thumbnail.toString('ascii', 1, 4), 'PNG');
  assert.equal(thumbnail[25], 6, 'thumbnail PNG must use RGBA color type');
});
