import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { WORLD_CHARACTER_CATALOG } from '../src/features/characters/world-character-catalog';
import {
  PICTUREBOOK_PET_MATERIAL_STYLE,
  WARM_HAND_PAINTED_CHARACTER_STYLE,
  applyWarmHandPaintedCharacterMaterial,
  applyPicturebookPetMaterial,
} from '../src/features/world/character-material-style';

const root = new URL('../', import.meta.url);
const migrationPath = new URL('supabase/migrations/20260813104601_add_collette_character.sql', root);

function readGlbJson(path: URL): Record<string, unknown> {
  const buffer = readFileSync(path);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim()) as Record<string, unknown>;
}

test('柯蕾特 is registered as a compact animated shop/world character', () => {
  const character = WORLD_CHARACTER_CATALOG.find((item) => item.id === 'character.collette');
  assert.deepEqual(
    character && {
      id: character.id,
      name: character.name,
      model: character.modelUrl,
      thumbnail: character.thumbnailUrl,
    },
    {
      id: 'character.collette',
      name: '柯蕾特',
      model: '/assets/characters/collette.glb',
      thumbnail: '/assets/characters/collette-thumbnail.webp',
    },
  );

  const modelPath = new URL('public/assets/characters/collette.glb', root);
  const thumbnailPath = new URL('public/assets/characters/collette-thumbnail.webp', root);
  assert.ok(statSync(modelPath).size > 100_000, '柯蕾特 GLB should contain the character mesh');
  assert.ok(statSync(modelPath).size < 2 * 1024 * 1024, '柯蕾特 GLB should stay small for mobile');
  assert.ok(statSync(thumbnailPath).size < 100 * 1024, '柯蕾特 thumbnail should stay small');

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

test('柯蕾特 migration registers the item and replaces any existing equipped user', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  assert.match(migration, /'character', '柯蕾特'/);
  assert.match(migration, /'character\.collette'/g);
  assert.match(migration, /order by random\(\)/i);
  assert.match(migration, /set equipped_character_inventory_id/);
  assert.match(migration, /supplied_character_keys/);
});

test('warm hand-painted material preset softens reflections without replacing textures', () => {
  const material = {
    roughness: 0.55,
    metalness: 0.4,
    envMapIntensity: 1,
    specularIntensity: 1,
    color: { setRGB: (red: number, green: number, blue: number) => { material.colorValues = [red, green, blue]; } },
    colorValues: [] as number[],
    map: { colorSpace: 'srgb', needsUpdate: false },
    needsUpdate: false,
  };

  applyWarmHandPaintedCharacterMaterial(material);

  assert.equal(material.roughness, WARM_HAND_PAINTED_CHARACTER_STYLE.roughness);
  assert.equal(material.metalness, WARM_HAND_PAINTED_CHARACTER_STYLE.metalness);
  assert.equal(material.envMapIntensity, WARM_HAND_PAINTED_CHARACTER_STYLE.envMapIntensity);
  assert.equal(material.specularIntensity, WARM_HAND_PAINTED_CHARACTER_STYLE.specularIntensity);
  assert.deepEqual(material.colorValues, [1, 0.975, 0.93]);
  assert.equal(material.map.colorSpace, 'srgb');
  assert.equal(material.map.needsUpdate, true);
  assert.equal(material.needsUpdate, true);
});

test('picturebook pet material keeps color textures while removing plastic and metal response', () => {
  const material = {
    roughness: 0.42,
    metalness: 0.65,
    envMapIntensity: 1,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    transmission: 0.4,
    flatShading: false,
    color: { r: 0.5, g: 0.4, b: 0.3, setRGB: () => undefined },
    map: { colorSpace: 'linear', needsUpdate: false },
    normalMap: {},
    roughnessMap: {},
    metalnessMap: {},
    clearcoatMap: {},
    clearcoatNormalMap: {},
    clearcoatRoughnessMap: {},
    needsUpdate: false,
  };

  applyPicturebookPetMaterial(material);

  assert.equal(material.roughness, PICTUREBOOK_PET_MATERIAL_STYLE.roughness);
  assert.equal(material.metalness, PICTUREBOOK_PET_MATERIAL_STYLE.metalness);
  assert.equal(material.envMapIntensity, PICTUREBOOK_PET_MATERIAL_STYLE.envMapIntensity);
  assert.equal(material.specularIntensity, PICTUREBOOK_PET_MATERIAL_STYLE.specularIntensity);
  assert.equal(material.clearcoat, PICTUREBOOK_PET_MATERIAL_STYLE.clearcoat);
  assert.equal(material.transmission, PICTUREBOOK_PET_MATERIAL_STYLE.transmission);
  assert.equal(material.flatShading, PICTUREBOOK_PET_MATERIAL_STYLE.flatShading);
  assert.equal(material.normalMap, null);
  assert.equal(material.roughnessMap, null);
  assert.equal(material.metalnessMap, null);
  assert.equal(material.clearcoatMap, null);
  assert.equal(material.map.colorSpace, 'srgb');
  assert.equal(material.map.needsUpdate, true);
  assert.equal(material.needsUpdate, true);
  assert.ok(material.color.r > 0.5, 'pet base colors should be lifted slightly');
});

test('world applies the shared warm hand-painted style to player and roaming characters', () => {
  const runtime = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');
  assert.match(runtime, /applyWarmHandPaintedCharacterStyle\(characterSource\)/);
  assert.match(runtime, /applyWarmHandPaintedCharacterStyle\(roamingCharacterSource\)/);
  assert.match(runtime, /applyPicturebookPetModelStyle\(petResult\.scene\)/);
});
