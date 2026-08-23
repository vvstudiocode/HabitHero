import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  CHARACTER_GROUND_CONTACT_Y,
  getCharacterGroundingCorrection,
  getCharacterGroundingReferenceY,
  getGroundedRootY,
  getPetGroundOffset,
} from '../src/features/world/prototype-world-runtime';

const root = new URL('../', import.meta.url);

describe('supplied pet grounding and motion', () => {
  it('uses the visible toe bones instead of an unrelated mesh bounding-box minimum', () => {
    assert.equal(CHARACTER_GROUND_CONTACT_Y, 0.055);
    assert.equal(getCharacterGroundingReferenceY(0, [0.144, 0.134, Number.NaN]), 0.134);
    assert.equal(getCharacterGroundingReferenceY(-0.08, []), -0.08);
    assert.ok(Math.abs(getGroundedRootY(-0.12, 0.134) - -0.199) < 1e-9);
    assert.equal(getCharacterGroundingCorrection(Number.NaN), 0);
  });

  it('uses the grass-level offset for Star Diver', () => {
    assert.equal(getPetGroundOffset('pet.star-diver', { groundOffset: -0.22 }), -0.22);
  });

  it('persists the same grass-level offset in Supabase metadata', () => {
    const migration = readFileSync(new URL('supabase/migrations/20260813075702_lower_star_diver_and_teddy_sou_to_grass.sql', root), 'utf8');
    assert.match(migration, /'groundOffset', -0\.12/);
  });

  it('aligns all three supplied pets and hides only their custom ground markers', () => {
    const migrationName = readdirSync(new URL('supabase/migrations/', root))
      .find((name) => name.includes('align_supplied_pets_to_grass') && name.endsWith('.sql'));
    assert.ok(migrationName, 'supplied pet grounding migration should exist');
    const migration = readFileSync(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');
    assert.match(migration, /pet\.star-diver/);
    assert.match(migration, /pet\.nibus/);
    assert.match(migration, /pet\.christo/);
    assert.match(migration, /'groundOffset', -0\.22/);
    assert.match(migration, /'hideGroundMarker', true/);
    assert.match(migration, /'hideGroundShadow', false/);
  });

  it('ships Moko and Kaldo with the same grass, shadow, and in-place presentation defaults', () => {
    const migrationName = readdirSync(new URL('supabase/migrations/', root))
      .find((name) => name.includes('add_moko_kaldo') && name.endsWith('.sql'));
    assert.ok(migrationName, 'Moko and Kaldo catalog migration should exist');
    const migration = readFileSync(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');
    assert.match(migration, /pet\.moko/);
    assert.match(migration, /pet\.kaldo/);
    assert.match(migration, /'animation', 'Walk_InPlace'/);
    assert.match(migration, /'idleAnimation', 'Idle'/);
    assert.match(migration, /'groundOffset', -0\.22/);
    assert.match(migration, /'hideGroundMarker', true/);
    assert.match(migration, /'nameLabelScaleMultiplier', 0\.33/);
  });

  it('normalizes Mixamo Hips root motion before the pet mixer plays a walk clip', () => {
    const runtime = readFileSync(new URL('src/features/world/prototype-world-runtime.ts', root), 'utf8');
    const runtimeAnimation = readFileSync(new URL('src/features/world/world-runtime-animation.ts', root), 'utf8');
    const characterRuntime = readFileSync(new URL('src/features/world/world-character-runtime.ts', root), 'utf8');
    assert.match(runtimeAnimation, /mixamorig:Hips|hips|pelvis/);
    assert.match(runtime, /createInPlaceAnimationClip\(getWalkAnimationClip\(animations\)!\)/);
    assert.match(runtime, /pauseAnimationAtIdlePose\(walkAction, mixer\)/);
    assert.match(runtime, /action\.reset\(\)\.play\(\)/);
    assert.match(runtime, /getWalkIdlePoseTime\(nextAction\.getClip\(\)\.duration\)/);
    assert.match(runtime, /characterActions\.has\('idle'\)/);
    assert.match(runtime, /nextAction\.setEffectiveWeight\(1\)/);
    assert.match(runtime, /groundWorldCharacter\(THREE, \{/);
    assert.match(characterRuntime, /getCharacterGroundingReferenceY\(bounds\.min\.y, footYs\)/);
    assert.match(characterRuntime, /options\.footNodes\.map\(\(node\) => node\.getWorldPosition/);
    assert.match(runtime, /roamingActor\.model\.position\.y = roamingActor\.baseModelY;/);
    assert.match(runtime, /groundRoamingCharacterOnGrass\(\);/);
  });
});
