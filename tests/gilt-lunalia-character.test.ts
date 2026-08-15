import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { WORLD_CHARACTER_CATALOG } from '../src/features/characters/world-character-catalog';

const root = new URL('../', import.meta.url);
const migrationPath = new URL('supabase/migrations/20260814133802_add_gilt_lunalia_characters.sql', root);

const suppliedCharacters = [
  { id: 'character.gilt', name: '吉爾特', model: '/assets/characters/gilt.glb', thumbnail: '/assets/characters/gilt-thumbnail.webp' },
  { id: 'character.lunalia', name: '露娜莉亞', model: '/assets/characters/lunalia.glb', thumbnail: '/assets/characters/lunalia-thumbnail.webp' },
] as const;

function readGlbJson(path: URL): Record<string, unknown> {
  const buffer = readFileSync(path);
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim()) as Record<string, unknown>;
}

test('吉爾特 and 露娜莉亞 are compact animated shop/world characters', () => {
  assert.deepEqual(
    WORLD_CHARACTER_CATALOG
      .filter((character) => suppliedCharacters.some((supplied) => supplied.id === character.id))
      .map((character) => ({ id: character.id, name: character.name, model: character.modelUrl, thumbnail: character.thumbnailUrl })),
    suppliedCharacters,
  );

  for (const character of suppliedCharacters) {
    const modelPath = new URL(`public${character.model}`, root);
    const thumbnailPath = new URL(`public${character.thumbnail}`, root);
    assert.ok(statSync(modelPath).size > 100_000, `${character.name} GLB should contain geometry`);
    assert.ok(statSync(modelPath).size < 2 * 1024 * 1024, `${character.name} GLB should stay small for mobile`);
    assert.ok(statSync(thumbnailPath).size < 100 * 1024, `${character.name} thumbnail should stay small`);

    const modelJson = readGlbJson(modelPath);
    const animations = modelJson.animations as Array<{ name?: string }>;
    const extensions = modelJson.extensionsUsed as string[];
    assert.deepEqual(animations.map((animation) => animation.name), ['Idle', 'Walk_InPlace']);
    assert.ok(extensions.includes('KHR_draco_mesh_compression'));
    assert.ok(extensions.includes('EXT_texture_webp'));
    assert.equal(readFileSync(thumbnailPath).toString('ascii', 0, 4), 'RIFF');
    assert.equal(readFileSync(thumbnailPath).toString('ascii', 8, 12), 'WEBP');
  }
});

test('migration registers both characters for the shop and selected new-child loadouts', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  for (const character of suppliedCharacters) {
    assert.match(migration, new RegExp(character.id.replace('.', '\\.'), 'g'));
    assert.match(migration, new RegExp(character.model.replaceAll('/', '\\/').replace('.', '\\.'), 'g'));
    assert.match(migration, new RegExp(character.thumbnail.replaceAll('/', '\\/').replace('.', '\\.'), 'g'));
  }
  assert.match(migration, /'character', '吉爾特'/);
  assert.match(migration, /'character', '露娜莉亞'/);
  assert.match(migration, /supplied_character_keys/);
  assert.match(migration, /order by random\(\)/i);
  assert.match(migration, /set equipped_character_inventory_id/);
  assert.match(migration, /warm-hand-painted/);
});
