import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { getLocalGameAsset } from '../src/features/world/game-content-assets';
import { getPetModelUrl } from '../src/features/world/pet-model-assets';
import { getPetVisualScaleMultiplier } from '../src/features/world/prototype-world-runtime';

const root = new URL('../', import.meta.url);

test('ships 艾莉特 as a compact five-action pet', async () => {
  const migrationName = (await readdir(new URL('supabase/migrations/', root)))
    .find((name) => name.includes('add_ailite_pet') && name.endsWith('.sql'));
  assert.ok(migrationName, 'Ailite catalog migration should exist');

  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');
  const model = new URL('public/assets/pets/ailite.glb', root);
  const thumbnail = new URL('public/assets/pets/ailite-thumbnail.png', root);
  await access(model);
  await access(thumbnail);

  const modelContents = await readFile(model);
  const modelStats = await stat(model);
  const thumbnailContents = await readFile(thumbnail);
  const jsonLength = modelContents.readUInt32LE(12);
  const gltf = JSON.parse(modelContents.subarray(20, 20 + jsonLength).toString('utf8').trim()) as {
    animations?: Array<{ name?: string }>;
  };

  assert.ok(modelStats.size > 100_000, 'Ailite GLB should contain the model and animations');
  assert.ok(modelStats.size < 3 * 1024 * 1024, 'Ailite GLB should stay compact for mobile delivery');
  assert.equal(modelContents.toString('ascii', 0, 4), 'glTF');
  assert.deepEqual(
    (gltf.animations ?? []).map((animation) => animation.name).sort(),
    ['Dance', 'Idle', 'Sit', 'Walk_InPlace', 'Wave'],
  );
  assert.match(modelContents.toString('latin1'), /KHR_draco_mesh_compression/);
  assert.match(modelContents.toString('latin1'), /EXT_texture_webp/);
  assert.equal(thumbnailContents.toString('ascii', 1, 4), 'PNG');
  assert.equal(thumbnailContents[25], 6, 'Ailite thumbnail must use RGBA color type');

  assert.deepEqual(getLocalGameAsset('pet', 'pet.ailite'), {
    modelUrl: '/assets/pets/ailite.glb',
    thumbnailUrl: '/assets/pets/ailite-thumbnail.png',
  });
  assert.equal(
    getPetModelUrl({ assetKey: 'pet.ailite', metadata: {} }),
    '/assets/pets/ailite.glb',
  );
  assert.match(migration, /pet\.ailite/);
  assert.match(migration, /艾莉特/u);
  assert.match(migration, /艾莉特idle\.fbx \+ 艾莉特\.fbx \+ 艾莉特坐下\.fbx \+ 艾莉特揮手\.fbx \+ 艾莉特跳舞\.fbx/u);
  assert.match(migration, /\/assets\/pets\/ailite\.glb/);
  assert.match(migration, /\/assets\/pets\/ailite-thumbnail\.png/);
  assert.match(migration, /'animationClips', jsonb_build_array\('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'\)/);
  assert.match(migration, /'meshSharedAcrossActions', true/);
});

test('uses a 2x world visual scale for 艾莉特', async () => {
  const migrationName = (await readdir(new URL('supabase/migrations/', root)))
    .find((name) => name.includes('tune_ailite_pet_visual_scale') && name.endsWith('.sql'));
  assert.ok(migrationName, 'Ailite world visual-scale migration should exist');

  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');
  assert.match(migration, /asset_key = 'pet\.ailite'/);
  assert.match(migration, /'visualScaleMultiplier', 2/);
  assert.equal(
    getPetVisualScaleMultiplier('pet.ailite', { visualScaleMultiplier: 2 }),
    1.3 * 2,
  );
});
