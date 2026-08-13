import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

test('the legacy chibi character bundle is replaced by the eight supplied assets', async () => {
  const { WORLD_CHARACTER_CATALOG } = await import('../src/features/characters/world-character-catalog.ts');
  assert.deepEqual(
    WORLD_CHARACTER_CATALOG.map((character) => character.id),
    ['character.arthur', 'character.elina', 'character.sia', 'character.elio', 'character.moss', 'character.noah', 'character.collette', 'character.violette'],
  );

  for (const character of WORLD_CHARACTER_CATALOG) {
    const modelPath = new URL(`../public${character.modelUrl}`, import.meta.url);
    const thumbnailPath = new URL(`../public${character.thumbnailUrl}`, import.meta.url);
    assert.ok(statSync(modelPath).size < 2 * 1024 * 1024, character.id);
    assert.ok(statSync(thumbnailPath).size < 100 * 1024, character.id);
    assert.match(readFileSync(modelPath).toString('latin1'), /Walk_InPlace/);
  }
});
