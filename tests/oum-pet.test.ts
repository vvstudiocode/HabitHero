import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { getPetModelUrl } from '../src/features/world/pet-model-assets';
import { getPetVisualScaleMultiplier } from '../src/features/world/prototype-world-runtime';

const root = new URL('../', import.meta.url);

test('ships Oum as a compact animated pet shop asset', async () => {
  const migrationName = (await readdir(new URL('supabase/migrations/', root)))
    .find((name) => name.includes('add_oum_pet') && name.endsWith('.sql'));
  assert.ok(migrationName, 'Oum catalog migration should exist');
  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');
  const model = new URL('public/assets/pets/oum.glb', root);
  const thumbnail = new URL('public/assets/pets/oum-thumbnail.webp', root);

  await access(model);
  await access(thumbnail);
  const modelStats = await stat(model);
  const modelContents = await readFile(model);
  const thumbnailContents = await readFile(thumbnail);

  assert.ok(modelStats.size > 100_000, 'Oum GLB should contain the model and animations');
  assert.ok(modelStats.size < 2 * 1024 * 1024, 'Oum GLB should stay compact for mobile delivery');
  assert.equal(modelContents.toString('ascii', 0, 4), 'glTF');
  assert.match(modelContents.toString('latin1'), /Walk_InPlace/);
  assert.match(modelContents.toString('latin1'), /Idle/);
  assert.match(modelContents.toString('latin1'), /KHR_draco_mesh_compression/);
  assert.match(modelContents.toString('latin1'), /EXT_texture_webp/);
  assert.equal(thumbnailContents.toString('ascii', 0, 4), 'RIFF');
  assert.equal(thumbnailContents.toString('ascii', 8, 12), 'WEBP');
  assert.equal(
    getPetModelUrl({ assetKey: 'pet.oum', metadata: {} }),
    '/assets/pets/oum.glb',
  );
  assert.equal(getPetVisualScaleMultiplier('pet.oum', {}), 1.3 * 4);
  assert.match(migration, /pet\.oum/);
  assert.match(migration, /歐姆/u);
  assert.match(migration, /\/assets\/pets\/oum\.glb/);
  assert.match(migration, /\/assets\/pets\/oum-thumbnail\.webp/);
  assert.match(migration, /User-provided 歐姆\.fbx \+ 歐姆 Idle\.fbx/u);
  assert.match(migration, /'animation', 'Walk_InPlace'/);
  assert.match(migration, /'idleAnimation', 'Idle'/);
  assert.match(migration, /'idlePauseMinSeconds', 3/);
  assert.match(migration, /'idlePauseMaxSeconds', 5/);
  assert.match(migration, /'visualScaleMultiplier', 4/);
});
