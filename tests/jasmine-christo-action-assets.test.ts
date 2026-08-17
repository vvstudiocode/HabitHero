import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { getLocalGameAsset } from '../src/features/world/game-content-assets';
import { getPetModelUrl } from '../src/features/world/pet-model-assets';
import {
  getPetGroundOffset,
  getPetVisualScaleMultiplier,
  shouldHidePetGroundMarker,
  shouldHidePetGroundShadow,
} from '../src/features/world/prototype-world-runtime';

const root = new URL('../', import.meta.url);

const petAssets = [
  {
    assetKey: 'pet.jasmine',
    name: '茉莉',
    stem: 'jasmine',
    thumbnail: 'jasmine-thumbnail.png',
    source: '茉莉Idle.fbx + 茉莉walk.fbx + 茉莉坐下.fbx + 茉莉揮手.fbx + 茉莉跳舞.fbx',
    animations: ['Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'],
    maxBytes: 2.5 * 1024 * 1024,
  },
  {
    assetKey: 'pet.christo',
    name: '克里斯多',
    stem: 'christo',
    thumbnail: 'christo-thumbnail.png',
    source: '克里斯多坐下.fbx + 克里斯多揮手.fbx + 克里斯多跳舞.fbx',
    animations: ['Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'],
    maxBytes: 1.8 * 1024 * 1024,
  },
] as const;

function assertWalkRootMotionIsInPlace(modelContents: Buffer, petName: string): void {
  const jsonLength = modelContents.readUInt32LE(12);
  const gltf = JSON.parse(modelContents.subarray(20, 20 + jsonLength).toString('utf8').trim()) as {
    accessors: Array<{ bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }>;
    bufferViews: Array<{ byteOffset?: number; byteStride?: number }>;
    nodes: Array<{ name?: string }>;
    animations?: Array<{
      name?: string;
      channels: Array<{ sampler: number; target?: { node: number; path: string } }>;
      samplers: Array<{ output: number }>;
    }>;
  };
  const binaryOffset = 20 + jsonLength + 8;
  const walk = gltf.animations?.find((animation) => animation.name === 'Walk_InPlace');
  assert.ok(walk, `${petName} should expose Walk_InPlace`);
  const rootTracks = walk.channels
    .filter((channel) => channel.target?.path === 'translation')
    .filter((channel) => /root|armature|hips|pelvis/i.test(gltf.nodes[channel.target!.node]?.name ?? ''));
  assert.ok(rootTracks.length > 0, `${petName} should expose a walk root translation track`);
  for (const channel of rootTracks) {
    const accessor = gltf.accessors[walk.samplers[channel.sampler].output];
    const bufferView = gltf.bufferViews[accessor.bufferView];
    const stride = bufferView.byteStride ?? 12;
    const start = binaryOffset + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const values = Array.from({ length: accessor.count }, (_, index) => [
      modelContents.readFloatLE(start + index * stride),
      modelContents.readFloatLE(start + index * stride + 8),
    ]);
    const xRange = Math.max(...values.map(([x]) => x)) - Math.min(...values.map(([x]) => x));
    const zRange = Math.max(...values.map(([, z]) => z)) - Math.min(...values.map(([, z]) => z));
    assert.ok(xRange <= 0.0005, `${petName} walk root x motion should be in place`);
    assert.ok(zRange <= 0.0005, `${petName} walk root z motion should be in place`);
  }
}

test('ships Jasmine and Christo with their complete compact animation sets', async () => {
  const migrationNames = await readdir(new URL('supabase/migrations/', root));
  const migrationName = migrationNames.find((name) => name.includes('jasmine_and_christo_actions'));
  assert.ok(migrationName, 'Jasmine and Christo action migration should exist');
  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');

  for (const pet of petAssets) {
    const model = new URL(`public/assets/pets/${pet.stem}.glb`, root);
    const thumbnail = new URL(`public/assets/pets/${pet.thumbnail}`, root);
    await access(model);
    await access(thumbnail);

    const modelStats = await stat(model);
    const modelContents = await readFile(model);
    const thumbnailContents = await readFile(thumbnail);
    const jsonLength = modelContents.readUInt32LE(12);
    const gltf = JSON.parse(modelContents.subarray(20, 20 + jsonLength).toString('utf8').trim()) as {
      animations?: Array<{ name?: string }>;
    };
    const animationNames = (gltf.animations ?? []).map((animation) => animation.name);

    assert.ok(modelStats.size > 100_000, `${pet.name} GLB should contain the model and animations`);
    assert.ok(modelStats.size < pet.maxBytes, `${pet.name} GLB should stay compact for mobile delivery`);
    assert.equal(modelContents.toString('ascii', 0, 4), 'glTF');
    assert.match(modelContents.toString('latin1'), /KHR_draco_mesh_compression/);
    assert.match(modelContents.toString('latin1'), /EXT_texture_webp/);
    assert.deepEqual([...animationNames].sort(), [...pet.animations].sort());
    assertWalkRootMotionIsInPlace(modelContents, pet.name);
    for (const animation of pet.animations) {
      assert.match(modelContents.toString('latin1'), new RegExp(animation));
    }

    assert.equal(thumbnailContents.toString('ascii', 1, 4), 'PNG');
    assert.equal(thumbnailContents[25], 6, `${pet.name} thumbnail must use RGBA color type`);
    assert.match(migration, new RegExp(pet.assetKey.replace('.', '\\.'), 'u'));
    assert.match(migration, new RegExp(pet.name, 'u'));
    assert.match(migration, new RegExp(`/assets/pets/${pet.stem}\\.glb`));
    assert.match(migration, new RegExp(pet.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }

  const jasmine = getLocalGameAsset('pet', 'pet.jasmine');
  assert.deepEqual(jasmine, {
    modelUrl: '/assets/pets/jasmine.glb',
    thumbnailUrl: '/assets/pets/jasmine-thumbnail.png',
  });
  assert.equal(getPetModelUrl({ assetKey: 'pet.jasmine', metadata: {} }), '/assets/pets/jasmine.glb');
  assert.deepEqual(getLocalGameAsset('pet', 'pet.christo'), {
    modelUrl: '/assets/pets/christo.glb',
    thumbnailUrl: '/assets/pets/christo-thumbnail.png',
  });
});

test('tunes Jasmine to the requested compact world presentation', async () => {
  const migrationNames = await readdir(new URL('supabase/migrations/', root));
  const tuningMigrationName = migrationNames.find((name) => name.includes('tune_jasmine_pet_presentation'));
  assert.ok(tuningMigrationName, 'Jasmine presentation migration should exist');
  const tuningMigration = await readFile(new URL(`supabase/migrations/${tuningMigrationName}`, root), 'utf8');
  const metadata = {
    visualScaleMultiplier: 2,
    groundOffset: -0.22,
    hideGroundShadow: true,
    hideGroundMarker: true,
  };

  assert.equal(getPetVisualScaleMultiplier('pet.jasmine', metadata), 1.3 * 2);
  assert.equal(getPetGroundOffset('pet.jasmine', metadata), -0.22);
  assert.equal(shouldHidePetGroundShadow(metadata), true);
  assert.equal(shouldHidePetGroundMarker(metadata), true);
  assert.match(tuningMigration, /asset_key = 'pet\.jasmine'/);
  assert.match(tuningMigration, /'visualScaleMultiplier', 2/);
  assert.match(tuningMigration, /'groundOffset', -0\.22/);
  assert.match(tuningMigration, /'hideGroundShadow', true/);
  assert.match(tuningMigration, /'hideGroundMarker', true/);
});
