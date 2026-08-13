import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { WORLD_CHARACTER_CATALOG } from '../src/features/characters/world-character-catalog';

const root = new URL('../', import.meta.url);
const migrationPath = new URL('supabase/migrations/20260813110128_add_violette_character.sql', root);

function readGlbJson(path: URL): Record<string, unknown> {
  const buffer = readFileSync(path);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim()) as Record<string, unknown>;
}

test('薇歐莉特 is registered as a compact animated shop/world character', () => {
  const character = WORLD_CHARACTER_CATALOG.find((item) => item.id === 'character.violette');
  assert.deepEqual(
    character && {
      id: character.id,
      name: character.name,
      model: character.modelUrl,
      thumbnail: character.thumbnailUrl,
    },
    {
      id: 'character.violette',
      name: '薇歐莉特',
      model: '/assets/characters/violette.glb',
      thumbnail: '/assets/characters/violette-thumbnail.webp',
    },
  );

  const modelPath = new URL('public/assets/characters/violette.glb', root);
  const thumbnailPath = new URL('public/assets/characters/violette-thumbnail.webp', root);
  assert.ok(statSync(modelPath).size > 100_000, '薇歐莉特 GLB should contain the character mesh');
  assert.ok(statSync(modelPath).size < 2 * 1024 * 1024, '薇歐莉特 GLB should stay small for mobile');
  assert.ok(statSync(thumbnailPath).size < 100 * 1024, '薇歐莉特 thumbnail should stay small');

  const modelJson = readGlbJson(modelPath);
  const animations = modelJson.animations as Array<{ name?: string }>;
  const extensions = modelJson.extensionsUsed as string[];
  assert.deepEqual(animations.map((animation) => animation.name), ['Idle', 'Walk_InPlace']);
  assert.ok(extensions.includes('KHR_draco_mesh_compression'));
  assert.ok(extensions.includes('EXT_texture_webp'));
  const material = (modelJson.materials as Array<{ pbrMetallicRoughness?: { metallicFactor?: number; roughnessFactor?: number } }>)[0];
  assert.equal(material.pbrMetallicRoughness?.metallicFactor, 0);
  assert.ok(Math.abs((material.pbrMetallicRoughness?.roughnessFactor ?? 0) - 0.86) < 0.001);
  assert.equal(readFileSync(thumbnailPath).toString('ascii', 0, 4), 'RIFF');
  assert.equal(readFileSync(thumbnailPath).toString('ascii', 8, 12), 'WEBP');
});

test('薇歐莉特 migration registers the item and supports new-child initialization', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  assert.match(migration, /'character', '薇歐莉特'/);
  assert.match(migration, /'character\.violette'/g);
  assert.match(migration, /order by random\(\)/i);
  assert.match(migration, /set equipped_character_inventory_id/);
  assert.match(migration, /supplied_character_keys/);
  assert.match(migration, /warm-hand-painted/);
});
