import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { getPetModelUrl } from '../src/features/world/pet-model-assets';

const root = new URL('../', import.meta.url);
const expectedAnimationNames = ['Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'];

function readGlbJson(bytes: Buffer): Record<string, unknown> {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim()) as Record<string, unknown>;
}

test('ships Moko as one compact GLB with all five requested actions', async () => {
  const model = new URL('public/assets/pets/moko.glb', root);
  await access(model);
  const modelBytes = await readFile(model);
  const modelStats = await stat(model);
  const glb = readGlbJson(modelBytes);
  const animationNames = (glb.animations as Array<{ name?: string }> | undefined ?? [])
    .map((animation) => animation.name);

  assert.ok(modelStats.size > 100_000, 'Moko GLB should contain model data and animations');
  assert.ok(modelStats.size < 2 * 1024 * 1024, 'Moko GLB should stay below the mobile 2 MB budget');
  assert.deepEqual([...animationNames].sort(), [...expectedAnimationNames].sort());
  assert.equal((glb.meshes as unknown[] | undefined)?.length, 1, 'actions must share one mesh');
  assert.equal((glb.images as unknown[] | undefined)?.length, 1, 'actions must share one texture');
  assert.deepEqual(glb.extensionsUsed, [
    'KHR_draco_mesh_compression',
    'KHR_materials_specular',
    'EXT_texture_webp',
  ]);
});

test('keeps Moko on the canonical local model path', () => {
  assert.equal(
    getPetModelUrl({ assetKey: 'pet.moko', metadata: {} }),
    '/assets/pets/moko.glb',
  );
});

test('records the five-action Moko source contract in the export and catalog migration', async () => {
  const exporter = await readFile(new URL('../tools/export_moko_action_assets.py', import.meta.url), 'utf8');
  const migrationName = (await readdir(new URL('../supabase/migrations/', import.meta.url)))
    .find((name) => name.includes('replace_moko_with_five_actions') && name.endsWith('.sql'));
  assert.ok(migrationName, 'Moko five-action catalog migration should exist');
  const migration = await readFile(new URL(`../supabase/migrations/${migrationName}`, import.meta.url), 'utf8');

  for (const source of [
    '莫可Idle.fbx',
    '莫可坐下.fbx',
    '莫可揮手.fbx',
    '莫可.fbx',
    '莫可跳舞.fbx',
  ]) {
    assert.match(exporter, new RegExp(source, 'u'));
    assert.match(migration, new RegExp(source, 'u'));
  }
  for (const animation of expectedAnimationNames) {
    assert.match(exporter, new RegExp(animation, 'u'));
    assert.match(migration, new RegExp(animation, 'u'));
  }
  assert.match(migration, /asset_key = 'pet\.moko'/);
  assert.match(migration, /\/assets\/pets\/moko\.glb/);
  assert.match(migration, /'rootMotion', 'in-place'/);
  assert.match(migration, /'compression', 'Draco mesh compression \+ 1024px WebP texture'/);
});
