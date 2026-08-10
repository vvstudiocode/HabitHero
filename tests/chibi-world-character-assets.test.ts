import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('five ChibiCharacters have local GLB models and selector thumbnails', async () => {
  const { WORLD_CHARACTER_CATALOG } = await import('../src/features/characters/world-character-catalog.ts');
  assert.equal(WORLD_CHARACTER_CATALOG.length, 5);

  for (const character of WORLD_CHARACTER_CATALOG) {
    const modelPath = new URL(`../public${character.modelUrl}`, import.meta.url);
    const thumbnailPath = new URL(`../public${character.thumbnailUrl}`, import.meta.url);
    assert.ok(statSync(modelPath).size > 100_000, character.id);
    assert.ok(statSync(thumbnailPath).size > 1_000, character.id);
    const model = readFileSync(modelPath).toString('latin1');
    assert.match(model, /walk/i, `${character.id} should contain a walk clip`);
    assert.match(model, /run/i, `${character.id} should contain a run clip`);
  }
});

test('ChibiCharacters migration grants the selected model to new children', () => {
  const migrations = read('../supabase/migrations/20260810123955_add_chibi_world_characters.sql');
  for (const key of ['archer', 'knight', 'merchant', 'ninja', 'student']) {
    assert.match(migrations, new RegExp(`character\\.chibi-${key}`));
    assert.match(migrations, new RegExp(`/assets/chibi-characters/${key}\\.glb`));
  }
  assert.match(migrations, /selected_character_id/);
  assert.match(migrations, /newChildSelectable/);
  assert.match(migrations, /equipped_character_inventory_id/);
});

test('plush thumbnails are encoded with an alpha channel', () => {
  for (const key of ['bear', 'bunny', 'cat', 'dog']) {
    const png = readFileSync(new URL(`../public/assets/animal-plushies/${key}-thumbnail.png`, import.meta.url));
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
    assert.equal(png[25], 6, `${key} thumbnail should be RGBA`);
  }
});
