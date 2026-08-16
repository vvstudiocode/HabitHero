import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { getPetModelUrl } from '../src/features/world/pet-model-assets';

const root = new URL('../', import.meta.url);

test('ships Orian as a compact animated pet shop asset', async () => {
  const migrationName = (await readdir(new URL('supabase/migrations/', root)))
    .find((name) => name.includes('add_orian_pet') && name.endsWith('.sql'));
  assert.ok(migrationName, 'Orian catalog migration should exist');
  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');
  const model = new URL('public/assets/pets/orian.glb', root);
  const thumbnail = new URL('public/assets/pets/orian-thumbnail.png', root);

  await access(model);
  await access(thumbnail);
  const modelStats = await stat(model);
  const modelContents = await readFile(model);
  const thumbnailContents = await readFile(thumbnail);

  assert.ok(modelStats.size > 100_000, 'Orian GLB should contain the model and animations');
  assert.ok(modelStats.size < 2 * 1024 * 1024, 'Orian GLB should stay compact for mobile delivery');
  assert.equal(modelContents.toString('ascii', 0, 4), 'glTF');
  assert.match(modelContents.toString('latin1'), /Walk_InPlace/);
  assert.match(modelContents.toString('latin1'), /Idle/);
  assert.match(modelContents.toString('latin1'), /KHR_draco_mesh_compression/);
  assert.match(modelContents.toString('latin1'), /EXT_texture_webp/);
  assert.equal(thumbnailContents.toString('ascii', 1, 4), 'PNG');
  assert.equal(thumbnailContents[25], 6, 'Orian thumbnail must use RGBA color type');
  assert.equal(
    getPetModelUrl({ assetKey: 'pet.orian', metadata: {} }),
    '/assets/pets/orian.glb',
  );
  assert.match(migration, /pet\.orian/);
  assert.match(migration, /奧利安/u);
  assert.match(migration, /\/assets\/pets\/orian\.glb/);
  assert.match(migration, /\/assets\/pets\/orian-thumbnail\.png/);
  assert.match(migration, /'animation', 'Walk_InPlace'/);
  assert.match(migration, /'idleAnimation', 'Idle'/);
  assert.match(migration, /'groundOffset', -0\.22/);
  assert.match(migration, /'hideGroundMarker', true/);
  assert.match(migration, /'hideGroundShadow', false/);
  assert.match(migration, /'groundShadowScaleMultiplier', 0\.22/);
  assert.match(migration, /'nameLabelScaleMultiplier', 0\.33/);
  assert.match(migration, /'idlePauseSeconds', 10/);
});
