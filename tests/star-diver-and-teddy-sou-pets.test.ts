import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);

const pets = [
  {
    key: 'star-diver',
    name: '星辰潛者',
    model: 'public/assets/pets/star-diver.glb',
    thumbnail: 'public/assets/pets/star-diver-thumbnail.webp',
  },
  {
    key: 'teddy-sou',
    name: '泰迪酥',
    model: 'public/assets/pets/teddy-sou.glb',
    thumbnail: 'public/assets/pets/teddy-sou-thumbnail.webp',
  },
] as const;

test('ships both supplied pets as compact animated GLBs', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260813063922_add_star_diver_and_teddy_sou_pets.sql', root), 'utf8');

  for (const pet of pets) {
    const model = new URL(pet.model, root);
    await access(model);
    const modelStats = await stat(model);
    assert.ok(modelStats.size > 100_000, `${pet.name} GLB should contain the model and animation`);
    assert.ok(modelStats.size < 1 * 1024 * 1024, `${pet.name} GLB should stay below 1 MB for mobile delivery`);
    const modelContents = (await readFile(model)).toString('latin1');
    assert.equal(modelContents.slice(0, 4), 'glTF');
    assert.match(modelContents, /Armature\|mixamo\.com\|Layer0/);
    assert.match(modelContents, /KHR_draco_mesh_compression/);
    assert.match(modelContents, /EXT_texture_webp/);
    assert.match(migration, new RegExp(`pet\\.${pet.key}`));
    assert.match(migration, new RegExp(pet.name));
    assert.match(migration, new RegExp(`/assets/pets/${pet.key}\\.glb`));
    assert.match(migration, new RegExp(`/assets/pets/${pet.key}-thumbnail\\.webp`));
  }
});

test('ships compact WebP thumbnails for both supplied pets', async () => {
  for (const pet of pets) {
    const thumbnail = new URL(pet.thumbnail, root);
    await access(thumbnail);
    const thumbnailStats = await stat(thumbnail);
    assert.ok(thumbnailStats.size < 100 * 1024, `${pet.name} thumbnail should stay below 100 KB`);
    const thumbnailContents = await readFile(thumbnail);
    assert.equal(thumbnailContents.toString('ascii', 0, 4), 'RIFF');
    assert.equal(thumbnailContents.toString('ascii', 8, 12), 'WEBP');
  }
});
