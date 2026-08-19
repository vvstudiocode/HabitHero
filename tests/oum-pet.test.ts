import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { getPetModelUrl } from '../src/features/world/pet-model-assets';
import {
  getPetGroundOffset,
  getPetVisualScaleMultiplier,
} from '../src/features/world/prototype-world-runtime';

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

test('ships Oum with all five supplied actions in one compact GLB', async () => {
  const migrationNames = await readdir(new URL('supabase/migrations/', root));
  const migrationName = migrationNames.find((name) => name.includes('replace_oum_with_preserved_walk_source'));
  assert.ok(migrationName, 'Oum five-action migration should exist');
  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');
  const exporter = await readFile(new URL('tools/export_oum_action_assets.py', root), 'utf8');
  const modelContents = await readFile(new URL('public/assets/pets/oum.glb', root));
  const modelStats = await stat(new URL('public/assets/pets/oum.glb', root));
  const jsonLength = modelContents.readUInt32LE(12);
  const gltf = JSON.parse(modelContents.subarray(20, 20 + jsonLength).toString('utf8').trim()) as {
    animations?: Array<{ name?: string }>;
  };

  assert.ok(modelStats.size < 1.6 * 1024 * 1024, 'Oum GLB should stay compact for mobile delivery');
  assert.deepEqual(
    (gltf.animations ?? []).map((animation) => animation.name).sort(),
    ['Dance', 'Idle', 'Sit', 'Walk_InPlace', 'Wave'],
  );
  assert.match(modelContents.toString('latin1'), /KHR_draco_mesh_compression/);
  assert.match(modelContents.toString('latin1'), /EXT_texture_webp/);
  assert.match(migration, /歐姆.fbx \+ 歐姆 Idle.fbx \+ 歐姆坐下.fbx \+ 歐姆揮手.fbx \+ 歐姆跳舞.fbx/u);
  assert.match(migration, /'animationClips', jsonb_build_array\('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'\)/);
  assert.match(migration, /'modelBytes', 1431792/);
  assert.match(migration, /'walkRootVerticalMotion', 'source-preserved'/);
  assert.match(exporter, /歐姆\.fbx.*Walk_InPlace/su);
  assert.doesNotMatch(exporter, /normalize_walk_root_motion/u);
});

test('lowers Oum from the grass tips to the grass-level baseline', async () => {
  const migrationName = (await readdir(new URL('supabase/migrations/', root)))
    .find((name) => name.includes('lower_oum_to_grass') && name.endsWith('.sql'));
  assert.ok(migrationName, 'Oum grass-level migration should exist');
  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');

  assert.match(migration, /asset_key = 'pet\.oum'/);
  assert.match(migration, /'groundOffset', -0\.36/);
  assert.equal(getPetGroundOffset('pet.oum', { groundOffset: -0.36 }), -0.36);
});
