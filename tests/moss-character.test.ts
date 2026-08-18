import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { WORLD_CHARACTER_CATALOG } from '../src/features/characters/world-character-catalog';

const root = new URL('../', import.meta.url);
const migrationPath = new URL('supabase/migrations/20260813080000_add_moss_character.sql', root);

function readGlbJson(path: URL): Record<string, unknown> {
  const buffer = readFileSync(path);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim()) as Record<string, unknown>;
}

test('莫斯 is a compact shop character with five merged action clips', () => {
  const character = WORLD_CHARACTER_CATALOG.find((item) => item.id === 'character.moss');
  assert.deepEqual(
    character && {
      id: character.id,
      name: character.name,
      model: character.modelUrl,
      thumbnail: character.thumbnailUrl,
    },
    {
      id: 'character.moss',
      name: '莫斯',
      model: '/assets/characters/moss.glb',
      thumbnail: '/assets/characters/moss-thumbnail.webp',
    },
  );

  const modelPath = new URL('public/assets/characters/moss.glb', root);
  const thumbnailPath = new URL('public/assets/characters/moss-thumbnail.webp', root);
  assert.ok(statSync(modelPath).size > 100_000, '莫斯 GLB should contain the character mesh');
  assert.ok(statSync(modelPath).size < 2 * 1024 * 1024, '莫斯 GLB should stay small for mobile');
  assert.ok(statSync(thumbnailPath).size < 100 * 1024, '莫斯 thumbnail should stay small');

  const modelJson = readGlbJson(modelPath);
  const animations = modelJson.animations as Array<{ name?: string }>;
  const extensions = modelJson.extensionsUsed as string[];
  assert.deepEqual(
    animations.map((animation) => animation.name),
    ['Dance', 'Idle', 'Sit', 'Walk_InPlace', 'Wave'],
  );
  assert.ok(extensions.includes('KHR_draco_mesh_compression'));
  assert.ok(extensions.includes('EXT_texture_webp'));
  assert.equal(readFileSync(thumbnailPath).toString('ascii', 0, 4), 'RIFF');
  assert.equal(readFileSync(thumbnailPath).toString('ascii', 8, 12), 'WEBP');
});

test('莫斯 records the five-action source contract in catalog metadata', () => {
  const migrationPath = new URL('supabase/migrations/20260818150000_replace_moss_with_five_actions.sql', root);
  const migration = readFileSync(migrationPath, 'utf8');
  assert.match(migration, /character\.moss/);
  assert.match(migration, /莫斯\.fbx \+ 莫斯idle\.fbx \+ 莫斯坐下\.fbx \+ 莫斯揮手\.fbx \+ 莫斯跳舞\.fbx/u);
  assert.match(migration, /'animationClips', jsonb_build_array\('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'\)/);
  assert.match(migration, /'rootMotion', 'in-place'/);
  assert.match(migration, /'modelBytes', 546476/);
});

test('莫斯 is registered in the shop and never remains equipped during a replacement migration', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  assert.match(migration, /'character', '莫斯'/);
  assert.match(migration, /'character\.moss'/g);
  assert.match(migration, /order by random\(\)/i);
  assert.match(migration, /set equipped_character_inventory_id/);
  assert.match(migration, /supplied_character_keys/);
  assert.match(migration, /'character\.moss'/);
});
