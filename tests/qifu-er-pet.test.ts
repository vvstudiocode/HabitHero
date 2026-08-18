import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { getLocalGameAsset } from '../src/features/world/game-content-assets';
import { getPetModelUrl } from '../src/features/world/pet-model-assets';
import { getPetVisualScaleMultiplier } from '../src/features/world/prototype-world-runtime';

const root = new URL('../', import.meta.url);

test('replaces the active 艾莉特 shop pet with 齊福爾', async () => {
  const migrationName = (await readdir(new URL('supabase/migrations/', root)))
    .find((name) => name.includes('replace_ailite_with_qifu_er') && name.endsWith('.sql'));
  assert.ok(migrationName, 'Qifuer replacement migration should exist');

  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');
  const exporter = await readFile(new URL('tools/export_qifu_er_action_assets.py', root), 'utf8');
  const model = new URL('public/assets/pets/qifu-er.glb', root);
  const thumbnail = new URL('public/assets/pets/qifu-er-thumbnail.png', root);
  await access(model);
  await access(thumbnail);

  const modelContents = await readFile(model);
  const modelStats = await stat(model);
  const thumbnailContents = await readFile(thumbnail);
  const jsonLength = modelContents.readUInt32LE(12);
  const gltf = JSON.parse(modelContents.subarray(20, 20 + jsonLength).toString('utf8').trim()) as {
    animations?: Array<{
      name?: string;
      channels?: Array<{ target?: { node?: number; path?: string }; sampler?: number }>;
      samplers?: Array<{ output?: number }>;
    }>;
    nodes?: Array<{ name?: string }>;
    accessors?: Array<{
      bufferView?: number;
      byteOffset?: number;
      count?: number;
      type?: string;
    }>;
    bufferViews?: Array<{ byteOffset?: number; byteStride?: number }>;
  };

  assert.ok(modelStats.size > 100_000, 'Qifuer GLB should contain the model and animations');
  assert.ok(modelStats.size < 3 * 1024 * 1024, 'Qifuer GLB should stay compact for mobile delivery');
  assert.equal(modelContents.toString('ascii', 0, 4), 'glTF');
  assert.deepEqual(
    (gltf.animations ?? []).map((animation) => animation.name).sort(),
    ['Dance', 'Idle', 'Sit', 'Walk_InPlace', 'Wave'],
  );
  const walkAnimation = (gltf.animations ?? []).find((animation) => animation.name === 'Walk_InPlace');
  assert.ok(walkAnimation, 'Qifuer should expose Walk_InPlace');
  const walkRootTranslation = (walkAnimation.channels ?? [])
    .filter((channel) => channel.target?.path === 'translation')
    .find((channel) => /hips|root|pelvis|armature/i.test(gltf.nodes?.[channel.target?.node ?? -1]?.name ?? ''));
  assert.ok(walkRootTranslation, 'Qifuer Walk_InPlace should expose a root translation track');
  const rootAccessor = gltf.accessors?.[walkAnimation.samplers?.[walkRootTranslation.sampler ?? -1]?.output ?? -1];
  assert.ok(rootAccessor?.bufferView !== undefined, 'Qifuer root translation should have a buffer view');
  const rootBufferView = gltf.bufferViews?.[rootAccessor?.bufferView ?? -1] as {
    byteOffset?: number;
    byteStride?: number;
  } | undefined;
  const rootStride = rootBufferView?.byteStride ?? 12;
  const rootStart = 20 + jsonLength + 8 + (rootBufferView?.byteOffset ?? 0) + (rootAccessor?.byteOffset ?? 0);
  const rootVectors = Array.from({ length: rootAccessor?.count ?? 0 }, (_, index) => [
    modelContents.readFloatLE(rootStart + index * rootStride),
    modelContents.readFloatLE(rootStart + index * rootStride + 4),
    modelContents.readFloatLE(rootStart + index * rootStride + 8),
  ]);
  const rootRanges = [0, 1, 2].map((axis) => (
    Math.max(...rootVectors.map((vector) => vector[axis])) - Math.min(...rootVectors.map((vector) => vector[axis]))
  ));
  assert.ok(rootRanges.every((range) => range <= 0.0005), `Qifuer Walk_InPlace root motion should be in place (ranges ${rootRanges.join(', ')})`);
  assert.match(modelContents.toString('latin1'), /KHR_draco_mesh_compression/);
  assert.match(modelContents.toString('latin1'), /EXT_texture_webp/);
  assert.equal(thumbnailContents.toString('ascii', 1, 4), 'PNG');
  assert.equal(thumbnailContents[25], 6, 'Qifuer thumbnail must use RGBA color type');

  assert.deepEqual(getLocalGameAsset('pet', 'pet.qifu-er'), {
    modelUrl: '/assets/pets/qifu-er.glb',
    thumbnailUrl: '/assets/pets/qifu-er-thumbnail.png',
  });
  assert.equal(getPetModelUrl({ assetKey: 'pet.qifu-er', metadata: {} }), '/assets/pets/qifu-er.glb');
  assert.equal(getPetVisualScaleMultiplier('pet.qifu-er', { visualScaleMultiplier: 2 }), 1.3 * 2);
  assert.match(migration, /asset_key = 'pet\.ailite'/);
  assert.match(migration, /is_active = false/);
  assert.match(migration, /'齊福爾'/u);
  assert.match(migration, /'pet\.qifu-er'/);
  assert.match(migration, /'visualScaleMultiplier', 2/);
  assert.match(migration, /'animationClips', jsonb_build_array\('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'\)/);
  assert.match(exporter, /normalize_walk_root_motion/);
  assert.match(exporter, /validate_exported_walk_in_place/);
});
