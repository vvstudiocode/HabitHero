import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);

const pets = [
  {
    key: 'star-diver',
    name: '星辰潛者',
    model: 'public/assets/pets/star-diver.glb',
    thumbnail: 'public/assets/pets/star-diver-thumbnail.png',
  },
] as const;

test('ships Star Diver as a compact animated GLB', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260813063922_add_star_diver_and_teddy_sou_pets.sql', root), 'utf8');
  const thumbnailMigration = await readFile(new URL('supabase/migrations/20260815080100_update_star_diver_thumbnail.sql', root), 'utf8');

  for (const pet of pets) {
    const model = new URL(pet.model, root);
    await access(model);
    const modelStats = await stat(model);
    assert.ok(modelStats.size > 100_000, `${pet.name} GLB should contain the model and animation`);
    assert.ok(modelStats.size < 1 * 1024 * 1024, `${pet.name} GLB should stay below 1 MB for mobile delivery`);
    const modelContents = (await readFile(model)).toString('latin1');
    assert.equal(modelContents.slice(0, 4), 'glTF');
    assert.match(modelContents, /Walk_InPlace/);
    assert.match(modelContents, /KHR_draco_mesh_compression/);
    assert.match(modelContents, /EXT_texture_webp/);
    assert.match(migration, new RegExp(`pet\\.${pet.key}`));
    assert.match(migration, new RegExp(pet.name));
    assert.match(migration, new RegExp(`/assets/pets/${pet.key}\\.glb`));
    assert.match(migration, new RegExp(`/assets/pets/${pet.key}-thumbnail\\.webp`));
    assert.match(thumbnailMigration, new RegExp(`/assets/pets/${pet.key}-thumbnail\\.png`));
  }
});

test('ships the supplied transparent PNG thumbnail and removes the old WebP', async () => {
  for (const pet of pets) {
    const thumbnail = new URL(pet.thumbnail, root);
    await access(thumbnail);
    const thumbnailStats = await stat(thumbnail);
    assert.ok(thumbnailStats.size < 300 * 1024, `${pet.name} thumbnail should stay below 300 KB`);
    const thumbnailContents = await readFile(thumbnail);
    assert.ok(thumbnailContents.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
    await assert.rejects(() => access(new URL('public/assets/pets/star-diver-thumbnail.webp', root)));
  }
});
