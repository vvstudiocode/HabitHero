import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('..', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

test('forest guardian pet keeps the supplied GLB and cleanup migration connected', async () => {
  const migration = await read('supabase/migrations/20260812101223_replace_legacy_pets_with_starlight_sprout.sql');
  const renameMigration = await read('supabase/migrations/20260812103059_rename_starlight_sprout_to_forest_guardian.sql');

  await access(new URL('public/assets/starlight-sprout-pet.glb', root));
  await access(new URL('public/assets/forest-guardian-thumbnail.png', root));
  assert.match(migration, /pet\.starlight-sprout/);
  assert.match(migration, /\/assets\/starlight-sprout-pet\.glb/);
  assert.match(migration, /insert into public\.game_catalog_items/);
  assert.match(migration, /delete from public\.game_currency_ledger/);
  assert.match(migration, /delete from public\.game_item_purchases/);
  assert.match(migration, /delete from public\.child_inventory_items/);
  assert.match(migration, /delete from public\.game_catalog_items/);
  assert.doesNotMatch(migration, /pet\.farm-/);
  assert.doesNotMatch(migration, /pet\.plush-/);
  assert.match(renameMigration, /pet\.starlight-sprout/);
  assert.match(renameMigration, /森林守護者/);
  assert.match(renameMigration, /\/assets\/starlight-sprout-pet-thumbnail\.png/);
  assert.match(renameMigration, /thumbnail_url/);
});

test('forest guardian uses the supplied transparent thumbnail for both preview sizes', async () => {
  const migration = await read('supabase/migrations/20260812104044_update_forest_guardian_thumbnail.sql');
  const thumbnail = await readFile(new URL('public/assets/forest-guardian-thumbnail.png', root));

  assert.match(migration, /pet\.starlight-sprout/);
  assert.match(migration, /\/assets\/forest-guardian-thumbnail\.png/);
  assert.equal(thumbnail.subarray(25, 26)[0], 6, 'thumbnail PNG must use RGBA color type');
});
