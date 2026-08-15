import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';

const root = new URL('../', import.meta.url);
const migrationPath = new URL('supabase/migrations/20260813024212_add_buleifu_tiger_and_belilos_fox_pets.sql', root);
const resizeMigrationPath = new URL('supabase/migrations/20260813025620_resize_buleifu_tiger_and_belilos_fox_pets.sql', root);

const pets = [
  {
    assetKey: 'pet.buleifu-tiger',
    model: 'public/assets/pets/buleifu-tiger.glb',
    thumbnail: 'public/assets/pets/buleifu-tiger-thumbnail.webp',
  },
  {
    assetKey: 'pet.belilos-fox',
    model: 'public/assets/pets/belilos-fox.glb',
    thumbnail: 'public/assets/pets/belilos-fox-thumbnail.webp',
  },
] as const;

describe('new animated pet shop assets', () => {
  it('ships compact GLBs and transparent WebP thumbnails for both pets', () => {
    for (const pet of pets) {
      const modelPath = new URL(pet.model, root);
      const thumbnailPath = new URL(pet.thumbnail, root);
      assert.equal(existsSync(modelPath), true, `${pet.model} should be present`);
      assert.equal(existsSync(thumbnailPath), true, `${pet.thumbnail} should be present`);
      assert.ok(statSync(modelPath).size < 2_000_000, `${pet.model} should stay below 2 MB`);
      assert.ok(statSync(thumbnailPath).size < 100_000, `${pet.thumbnail} should stay below 100 KB`);
    }
  });

  it('registers both assets as active pet catalog entries', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    assert.equal((migration.match(/'pet'/g) ?? []).length, 2);
    for (const pet of pets) {
      assert.match(migration, new RegExp(`'${pet.assetKey.replace('.', '\\.')}'`));
      assert.match(migration, new RegExp(`'/${pet.model.replace(/^public\//, '')}'`));
      assert.match(migration, new RegExp(`'/${pet.thumbnail.replace(/^public\//, '')}'`));
    }
    assert.match(migration, /on conflict \(item_type, asset_key\) do update/);
  });

  it('keeps size adjustments in catalog metadata instead of duplicating GLBs', () => {
    const migration = readFileSync(resizeMigrationPath, 'utf8');
    assert.match(migration, /'pet\.buleifu-tiger'.*'visualScaleMultiplier', 3\.0/s);
    assert.match(migration, /'pet\.belilos-fox'.*'visualScaleMultiplier', 2\.0/s);
  });
});
