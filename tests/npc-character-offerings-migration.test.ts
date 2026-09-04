import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('../supabase/migrations/20260904043500_add_npc_character_offerings.sql', import.meta.url), 'utf8');

test('character vendor migration offers each NPC own character item', () => {
  for (const character of ['character.gilt', 'character.moss', 'character.lunalia', 'character.noah', 'character.collette', 'character.violette']) {
    assert.match(migration, new RegExp(`'${character}'`));
  }
  assert.match(migration, /npc\.npc_type = 'character_vendor'/i);
  assert.match(migration, /npc\.catalog_item_id/i);
  assert.match(migration, /sort_order = 1/i);
  assert.match(migration, /is_primary_source = true/i);
  assert.match(migration, /on conflict \(npc_id, catalog_item_id\) do update/i);
  assert.match(migration, /character NPC self-offering seed cardinality is invalid/i);
});
