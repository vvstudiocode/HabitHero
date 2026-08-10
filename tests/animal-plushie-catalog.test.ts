import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('..', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

test('animal plushie catalog keeps all four models and thumbnails connected', async () => {
  const migration = await read('supabase/migrations/20260810115905_add_animal_plushie_pets.sql');
  const assets = [
    ['pet.plush-bear', 'Bear.fbx', 'bear-thumbnail.png'],
    ['pet.plush-bunny', 'Bunny.fbx', 'bunny-thumbnail.png'],
    ['pet.plush-cat', 'Cat.fbx', 'cat-thumbnail.png'],
    ['pet.plush-dog', 'Dog.fbx', 'dog-thumbnail.png'],
  ] as const;

  for (const [assetKey, model, thumbnail] of assets) {
    assert.match(migration, new RegExp(`'${assetKey}'`));
    assert.match(migration, new RegExp(model.replace('.', '\\.') ));
    assert.match(migration, new RegExp(thumbnail.replace('.', '\\.') ));
    await access(new URL(`public/assets/animal-plushies/${model}`, root));
    await access(new URL(`public/assets/animal-plushies/${thumbnail}`, root));
  }
});
