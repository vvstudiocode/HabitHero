import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { WORLD_CHARACTER_CATALOG } from '../src/features/characters/world-character-catalog';

const root = new URL('../', import.meta.url);
const migrationPath = new URL('supabase/migrations/20260813081000_add_noah_character.sql', root);

function readGlbJson(path: URL): Record<string, unknown> {
  const buffer = readFileSync(path);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim()) as Record<string, unknown>;
}

test('諾亞 is a compact shop character with merged idle and walk clips', () => {
  const character = WORLD_CHARACTER_CATALOG.find((item) => item.id === 'character.noah');
  assert.deepEqual(
    character && {
      id: character.id,
      name: character.name,
      model: character.modelUrl,
      thumbnail: character.thumbnailUrl,
    },
    {
      id: 'character.noah',
      name: '諾亞',
      model: '/assets/characters/noah.glb',
      thumbnail: '/assets/characters/noah-thumbnail.webp',
    },
  );

  const modelPath = new URL('public/assets/characters/noah.glb', root);
  const thumbnailPath = new URL('public/assets/characters/noah-thumbnail.webp', root);
  assert.ok(statSync(modelPath).size > 100_000, '諾亞 GLB should contain the character mesh');
  assert.ok(statSync(modelPath).size < 2 * 1024 * 1024, '諾亞 GLB should stay small for mobile');
  assert.ok(statSync(thumbnailPath).size < 100 * 1024, '諾亞 thumbnail should stay small');

  const modelJson = readGlbJson(modelPath);
  const animations = modelJson.animations as Array<{ name?: string }>;
  const extensions = modelJson.extensionsUsed as string[];
  assert.deepEqual(animations.map((animation) => animation.name), ['Idle', 'Walk_InPlace']);
  assert.ok(extensions.includes('KHR_draco_mesh_compression'));
  assert.ok(extensions.includes('EXT_texture_webp'));
  assert.equal(readFileSync(thumbnailPath).toString('ascii', 0, 4), 'RIFF');
  assert.equal(readFileSync(thumbnailPath).toString('ascii', 8, 12), 'WEBP');
});

test('諾亞 is registered in the shop and existing users are moved off it', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  assert.match(migration, /'character', '諾亞'/);
  assert.match(migration, /'character\.noah'/g);
  assert.match(migration, /order by random\(\)/i);
  assert.match(migration, /set equipped_character_inventory_id/);
  assert.match(migration, /supplied_character_keys/);
  assert.match(migration, /'character\.noah'/);
});
