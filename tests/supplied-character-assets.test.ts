import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { AnimationClip, VectorKeyframeTrack } from 'three';
import { WORLD_CHARACTER_CATALOG } from '../src/features/characters/world-character-catalog';
import {
  createInPlaceAnimationClip,
  getCharacterAnimationClip,
  getCharacterGroundingCorrection,
  getWalkIdlePoseTime,
  PLAYER_CHARACTER_GROUND_OFFSET,
} from '../src/features/world/prototype-world-runtime';

const root = new URL('../', import.meta.url);
const migrationPath = new URL('supabase/migrations/20260813075119_replace_legacy_characters_with_supplied.sql', root);
const mossMigrationPath = new URL('supabase/migrations/20260813080000_add_moss_character.sql', root);
const colletteMigrationPath = new URL('supabase/migrations/20260813104601_add_collette_character.sql', root);
const violetteMigrationPath = new URL('supabase/migrations/20260813110128_add_violette_character.sql', root);
const suppliedCharacterIdleMigrationPath = new URL('supabase/migrations/20260813120228_add_idle_animations_to_supplied_characters.sql', root);

const suppliedCharacters = [
  { id: 'character.arthur', name: '亞瑟', model: '/assets/characters/arthur.glb', thumbnail: '/assets/characters/arthur-thumbnail.webp' },
  { id: 'character.elina', name: '艾利娜', model: '/assets/characters/elina.glb', thumbnail: '/assets/characters/elina-thumbnail.webp' },
  { id: 'character.sia', name: '希雅', model: '/assets/characters/sia.glb', thumbnail: '/assets/characters/sia-thumbnail.webp' },
  { id: 'character.elio', name: '艾利歐', model: '/assets/characters/elio.glb', thumbnail: '/assets/characters/elio-thumbnail.webp' },
  { id: 'character.moss', name: '莫斯', model: '/assets/characters/moss.glb', thumbnail: '/assets/characters/moss-thumbnail.webp' },
  { id: 'character.noah', name: '諾亞', model: '/assets/characters/noah.glb', thumbnail: '/assets/characters/noah-thumbnail.webp' },
  { id: 'character.collette', name: '柯蕾特', model: '/assets/characters/collette.glb', thumbnail: '/assets/characters/collette-thumbnail.webp' },
  { id: 'character.violette', name: '薇歐莉特', model: '/assets/characters/violette.glb', thumbnail: '/assets/characters/violette-thumbnail.webp' },
] as const;

function readGlbJson(path: URL): Record<string, unknown> {
  const buffer = readFileSync(path);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim()) as Record<string, unknown>;
}

describe('supplied character assets', () => {
  it('ships the supplied characters with compact animated GLBs', () => {
    assert.deepEqual(
      WORLD_CHARACTER_CATALOG.map((character) => ({ id: character.id, name: character.name, model: character.modelUrl, thumbnail: character.thumbnailUrl })),
      suppliedCharacters,
    );

    for (const character of suppliedCharacters) {
      const modelPath = new URL(`public${character.model}`, root);
      const thumbnailPath = new URL(`public${character.thumbnail}`, root);
      assert.ok(statSync(modelPath).size > 100_000, `${character.name} model should contain geometry`);
      assert.ok(statSync(modelPath).size < 2 * 1024 * 1024, `${character.name} model should stay small for mobile`);
      assert.ok(statSync(thumbnailPath).size < 100 * 1024, `${character.name} thumbnail should stay small`);
      const modelJson = readGlbJson(modelPath);
      const animations = modelJson.animations as Array<{ name?: string }>;
      const extensions = modelJson.extensionsUsed as string[];
      assert.equal(animations.length, 2, `${character.name} should ship its idle and walk animation clips`);
      assert.match(animations.map((animation) => animation.name).join(','), /walk/i);
      assert.match(animations.map((animation) => animation.name).join(','), /idle/i);
      assert.ok(extensions.includes('KHR_draco_mesh_compression'));
      assert.ok(extensions.includes('EXT_texture_webp'));
      assert.equal(readFileSync(thumbnailPath).toString('ascii', 0, 4), 'RIFF');
      assert.equal(readFileSync(thumbnailPath).toString('ascii', 8, 12), 'WEBP');
    }
  });

  it('does not reuse the walk-only clip as idle and grounds the player on the grass line', () => {
    const walkClip = new AnimationClip('Walk_InPlace', 1, []);

    assert.equal(getCharacterAnimationClip([walkClip], 'walk'), walkClip);
    assert.equal(getCharacterAnimationClip([walkClip], 'idle'), undefined);
    assert.equal(getWalkIdlePoseTime(walkClip.duration), 0.04);
    assert.ok(getWalkIdlePoseTime(walkClip.duration) > 0);
    assert.ok(getWalkIdlePoseTime(walkClip.duration) < walkClip.duration);
    assert.equal(getCharacterGroundingCorrection(-0.08), 0.135);
    assert.ok(Math.abs(getCharacterGroundingCorrection(0.06) + 0.005) < 0.000001);
    assert.equal(PLAYER_CHARACTER_GROUND_OFFSET, -0.12);
  });

  it('keeps root-motion tracks in place for Mixamo Hips as well as root bones', () => {
    const clip = new AnimationClip('Walk_InPlace', 1, [
      new VectorKeyframeTrack('mixamorig:Hips.position', [0, 1], [0, 0, 0, 1, 0, 2]),
      new VectorKeyframeTrack('root.position', [0, 1], [0, 0, 0, -1, 0, 1]),
      new VectorKeyframeTrack('mixamorig:Spine.position', [0, 1], [0, 1, 0, 0, 1.1, 0]),
    ]);

    const inPlace = createInPlaceAnimationClip(clip);
    assert.deepEqual(Array.from(inPlace.tracks[0].values), [0, 0, 0, 0, 0, 0]);
    assert.deepEqual(Array.from(inPlace.tracks[1].values), [0, 0, 0, 0, 0, 0]);
    assert.deepEqual(Array.from(inPlace.tracks[2].values).slice(0, 4), [0, 1, 0, 0]);
    assert.ok(Math.abs(inPlace.tracks[2].values[4] - 1.1) < 0.00001);
    assert.equal(inPlace.tracks[2].values[5], 0);
  });

  it('retires every legacy character and re-equips existing children in the migration', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    for (const character of suppliedCharacters.slice(0, 4)) {
      assert.match(migration, new RegExp(character.id.replace('.', '\\.'), 'g'));
      assert.match(migration, new RegExp(character.model.replaceAll('/', '\\/').replace('.', '\\.'), 'g'));
    }
    assert.match(migration, /character\.anime-maiden/);
    assert.match(migration, /character\.starlight-adventurer/);
    assert.match(migration, /character\.chibi-/);
    assert.match(migration, /set equipped_character_inventory_id/);
    assert.match(migration, /drop trigger if exists child_profile_identity_guard/);
    assert.match(migration, /create trigger child_profile_identity_guard/);
    assert.match(migration, /update public\.child_profiles/);
    assert.match(migration, /initialize_child_game_data/);

    const mossMigration = readFileSync(mossMigrationPath, 'utf8');
    assert.match(mossMigration, /character\.moss/);
    assert.match(mossMigration, /moss\.glb/);
    assert.match(mossMigration, /order by random\(\)/i);

    const colletteMigration = readFileSync(colletteMigrationPath, 'utf8');
    assert.match(colletteMigration, /character\.collette/);
    assert.match(colletteMigration, /warm-hand-painted/);

    const violetteMigration = readFileSync(violetteMigrationPath, 'utf8');
    assert.match(violetteMigration, /character\.violette/);
    assert.match(violetteMigration, /warm-hand-painted/);

    const suppliedCharacterIdleMigration = readFileSync(suppliedCharacterIdleMigrationPath, 'utf8');
    for (const character of suppliedCharacters.slice(0, 4)) {
      assert.match(suppliedCharacterIdleMigration, new RegExp(character.id.replace('.', '\\.'), 'g'));
    }
    assert.match(suppliedCharacterIdleMigration, /animationStates/);
    assert.match(suppliedCharacterIdleMigration, /idle/);
    assert.match(suppliedCharacterIdleMigration, /Walk_InPlace/);
    assert.match(suppliedCharacterIdleMigration, /warm-hand-painted/);
  });
});
