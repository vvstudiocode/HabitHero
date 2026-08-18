import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);

function readGlbJsonAndBinary(path: URL): { json: Record<string, any>; bytes: Buffer; binaryOffset: number } {
  const bytes = readFileSync(path);
  const jsonLength = bytes.readUInt32LE(12);
  const jsonStart = 20;
  return {
    json: JSON.parse(bytes.subarray(jsonStart, jsonStart + jsonLength).toString('utf8').trim()),
    bytes,
    binaryOffset: jsonStart + jsonLength + 8,
  };
}

function getWalkRootTranslationRanges(path: URL): number[][] {
  const glb = readGlbJsonAndBinary(path);
  const ranges: number[][] = [];
  for (const animation of glb.json.animations ?? []) {
    if (animation.name !== 'Walk_InPlace') continue;
    for (const channel of animation.channels ?? []) {
      if (channel.target?.path !== 'translation') continue;
      const nodeName = glb.json.nodes?.[channel.target.node]?.name ?? '';
      if (!/root|armature|hips|pelvis/i.test(nodeName)) continue;
      const accessor = glb.json.accessors[animation.samplers[channel.sampler].output];
      const bufferView = glb.json.bufferViews[accessor.bufferView];
      const stride = bufferView.byteStride ?? 12;
      const start = glb.binaryOffset + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      const vectors = Array.from({ length: accessor.count }, (_, index) => [
        glb.bytes.readFloatLE(start + index * stride),
        glb.bytes.readFloatLE(start + index * stride + 4),
        glb.bytes.readFloatLE(start + index * stride + 8),
      ]);
      ranges.push([0, 1, 2].map((axis) => (
        Math.max(...vectors.map((vector) => vector[axis])) - Math.min(...vectors.map((vector) => vector[axis]))
      )));
    }
  }
  return ranges;
}

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

test('ships Nibus with all five supplied actions in one compact GLB', async () => {
  const migrationNames = await readdir(new URL('supabase/migrations/', root));
  const migrationName = migrationNames.find((name) => name.includes('replace_nibus_with_preserved_walk_source'));
  assert.ok(migrationName, 'Nibus five-action migration should exist');
  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');
  const exporter = await readFile(new URL('tools/export_nibus_action_assets.py', root), 'utf8');
  const modelContents = await readFile(new URL('public/assets/pets/nibus.glb', root));
  const modelStats = await stat(new URL('public/assets/pets/nibus.glb', root));
  const jsonLength = modelContents.readUInt32LE(12);
  const gltf = JSON.parse(modelContents.subarray(20, 20 + jsonLength).toString('utf8').trim()) as {
    animations?: Array<{ name?: string }>;
  };

  assert.ok(modelStats.size < 1.6 * 1024 * 1024, 'Nibus GLB should stay compact for mobile delivery');
  assert.deepEqual(
    (gltf.animations ?? []).map((animation) => animation.name).sort(),
    ['Dance', 'Idle', 'Sit', 'Walk_InPlace', 'Wave'],
  );
  assert.match(modelContents.toString('latin1'), /KHR_draco_mesh_compression/);
  assert.match(modelContents.toString('latin1'), /EXT_texture_webp/);
  assert.match(migration, /尼布斯\.fbx \+ 尼布斯Sad Idle\.fbx \+ 尼布斯坐下\.fbx \+ 尼布斯揮手\.fbx \+ 尼布斯跳舞\.fbx/u);
  assert.match(migration, /'animationClips', jsonb_build_array\('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'\)/);
  assert.match(migration, /'modelBytes', 1327240/);
  assert.match(migration, /'rootMotion', 'in-place'/);
  assert.doesNotMatch(migration, /walkRootVerticalMotion|source-preserved/);
  const rootRanges = getWalkRootTranslationRanges(new URL('public/assets/pets/nibus.glb', root));
  assert.ok(rootRanges.length > 0, 'Nibus Walk_InPlace should expose a root translation track');
  for (const ranges of rootRanges) {
    assert.ok(ranges.every((range) => range <= 0.0005), `Nibus Walk_InPlace root motion should be in place (ranges ${ranges.join(', ')})`);
  }
  assert.match(exporter, /尼布斯\.fbx.*Walk_InPlace/su);
  assert.match(exporter, /normalize_walk_root_motion/u);
  assert.match(exporter, /normalize_exported_walk_root_motion/u);
});
