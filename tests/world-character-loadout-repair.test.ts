import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration = readFileSync(new URL('../supabase/migrations/20260813082000_repair_world_character_loadouts.sql', import.meta.url), 'utf8');

test('world character repair aligns Moss and Noah profiles with their equipped inventory', () => {
  assert.match(migration, /character\.moss/);
  assert.match(migration, /character\.noah/);
  assert.match(migration, /child_profiles/);
  assert.match(migration, /child_game_loadouts/);
  assert.match(migration, /child_inventory_items/);
  assert.match(migration, /set equipped_character_inventory_id/);
  assert.match(migration, /where child\.character_id = any/);
  assert.match(migration, /initialize_child_game_data/);
});
