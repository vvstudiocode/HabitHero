import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { WORLD_CHARACTER_CATALOG } from '../src/features/characters/world-character-catalog';

const root = new URL('../', import.meta.url);
const migrationPath = new URL('supabase/migrations/20260814133802_add_gilt_lunalia_characters.sql', root);
const replacementMigrationPath = new URL('supabase/migrations/20260818230000_replace_gilt_with_five_actions.sql', root);
const lunaliaReplacementMigrationPath = new URL('supabase/migrations/20260818074452_replace_lunalia_with_five_actions.sql', root);
const exporterPath = new URL('../tools/export_gilt_character.py', import.meta.url);
const lunaliaExporterPath = new URL('../tools/export_lunalia_character.py', import.meta.url);

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
    const expectedAnimations = ['Dance', 'Idle', 'Sit', 'Walk_InPlace', 'Wave'];
    assert.deepEqual(animations.map((animation) => animation.name).sort(), expectedAnimations.sort());
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

test('吉爾特 replacement packs all supplied action files into one mobile GLB', () => {
  const migration = readFileSync(replacementMigrationPath, 'utf8');
  assert.match(migration, /character\.gilt/);
  assert.match(migration, /animationClips', jsonb_build_array\('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'\)/);
  assert.match(migration, /animationStates', jsonb_build_array\('idle', 'walk', 'sit', 'wave', 'dance'\)/);
  assert.match(migration, /meshSharedAcrossActions', true/);
  assert.match(migration, /modelBytes', 1244056/);

  const exporter = readFileSync(exporterPath, 'utf8');
  for (const sourceName of ['吉爾特Idle\.fbx', '吉爾特\.fbx', '吉爾特坐下\.fbx', '吉爾特揮手\.fbx', '吉爾特跳舞\.fbx']) {
    assert.match(exporter, new RegExp(sourceName));
  }
  assert.match(exporter, /actions = \[idle\]/);
  assert.match(exporter, /action_name in \(.*Sit.*Wave.*Dance/su);
});

test('露娜莉亞 replacement packs all supplied action files into one mobile GLB', () => {
  const migration = readFileSync(lunaliaReplacementMigrationPath, 'utf8');
  assert.match(migration, /character\.lunalia/);
  assert.match(migration, /animationClips', jsonb_build_array\('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'\)/);
  assert.match(migration, /animationStates', jsonb_build_array\('idle', 'walk', 'sit', 'wave', 'dance'\)/);
  assert.match(migration, /meshSharedAcrossActions', true/);

  const exporter = readFileSync(lunaliaExporterPath, 'utf8');
  for (const sourceName of ['露娜莉亞idle\.fbx', '露娜莉亞\.fbx', '露娜莉亞坐下\.fbx', '露娜莉亞揮手\.fbx', '露娜莉亞跳舞\.fbx']) {
    assert.match(exporter, new RegExp(sourceName));
  }
  assert.match(exporter, /actions = \[idle\]/);
  assert.match(exporter, /action_name in \(.*Sit.*Wave.*Dance/su);
});
