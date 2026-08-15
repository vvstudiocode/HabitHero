import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migrationsUrl = new URL('../supabase/migrations/', import.meta.url);

test('removes the invalid updated_at trigger from immutable game purchases', async () => {
  const migrationNames = await readdir(migrationsUrl);
  const migrationName = migrationNames.find((name) => name.endsWith('_remove_game_item_purchases_updated_at_trigger.sql'));
  assert.ok(migrationName, 'trigger cleanup migration should exist');

  const migration = await readFile(new URL(migrationName, migrationsUrl), 'utf8');
  assert.match(migration, /drop trigger if exists game_item_purchases_updated_at on public\.game_item_purchases/i);
  assert.doesNotMatch(migration, /add column\s+updated_at/i);
});
