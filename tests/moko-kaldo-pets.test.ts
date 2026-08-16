import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { getPetModelUrl } from '../src/features/world/pet-model-assets';

const root = new URL('../', import.meta.url);
const suppliedPets = [
  { key: 'pet.moko', name: '莫可', stem: 'moko', source: '莫可.fbx + 莫可idle.fbx' },
  { key: 'pet.kaldo', name: '卡爾多', stem: 'kaldo', source: '卡爾多.fbx + 卡爾多Idle.fbx' },
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('ships Moko and Kaldo as compact animated pet shop assets', async () => {
  const migrationName = (await readdir(new URL('supabase/migrations/', root)))
    .find((name) => name.includes('add_moko_kaldo') && name.endsWith('.sql'));
  assert.ok(migrationName, 'Moko and Kaldo catalog migration should exist');
  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');

  for (const pet of suppliedPets) {
    const model = new URL(`public/assets/pets/${pet.stem}.glb`, root);
    await access(model);
    const modelContents = await readFile(model);
    const modelStats = await stat(model);

    assert.ok(modelStats.size > 100_000, `${pet.name} GLB should contain the model and animations`);
    assert.ok(modelStats.size < 2 * 1024 * 1024, `${pet.name} GLB should stay compact for mobile delivery`);
    assert.equal(modelContents.toString('ascii', 0, 4), 'glTF');
    assert.match(modelContents.toString('latin1'), /Walk_InPlace/);
    assert.match(modelContents.toString('latin1'), /Idle/);
    assert.match(modelContents.toString('latin1'), /KHR_draco_mesh_compression/);
    assert.match(modelContents.toString('latin1'), /EXT_texture_webp/);
    assert.match(migration, new RegExp(pet.key.replace('.', '\\.'), 'u'));
    assert.match(migration, new RegExp(pet.name, 'u'));
    assert.match(migration, new RegExp(`/assets/pets/${pet.stem}\\.glb`));
    assert.match(migration, new RegExp(`/assets/pets/${pet.stem}-thumbnail\\.(png|webp)`));
    assert.match(migration, new RegExp(escapeRegExp(pet.source), 'u'));
  }
  assert.match(migration, /'groundOffset', -0\.22/);
  assert.match(migration, /'hideGroundMarker', true/);
  assert.match(migration, /'hideGroundShadow', false/);
  assert.match(migration, /'groundShadowScaleMultiplier', 0\.22/);
  assert.match(migration, /'nameLabelScaleMultiplier', 0\.33/);
  assert.match(migration, /'idlePauseSeconds', 10/);
});

test('uses canonical local model paths for Moko and Kaldo', () => {
  for (const pet of suppliedPets) {
    assert.equal(
      getPetModelUrl({ assetKey: pet.key, metadata: {} }),
      `/assets/pets/${pet.stem}.glb`,
    );
  }
});

test('ships transparent shop thumbnails for Moko and Kaldo', async () => {
  for (const pet of suppliedPets) {
    const thumbnail = await readFile(new URL(`public/assets/pets/${pet.stem}-thumbnail.png`, root));
    assert.equal(thumbnail.toString('ascii', 1, 4), 'PNG');
    assert.equal(thumbnail[25], 6, `${pet.name} thumbnail must use RGBA color type`);
  }
});
