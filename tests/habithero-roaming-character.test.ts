import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  HABITHERO_ROAMING_CHARACTER_ASSET_KEY,
  HABITHERO_ROAMING_CHARACTER_MODEL_URL,
  HABITHERO_ROAMING_CHARACTER_SPEED,
  HABITHERO_ROAMING_CHARACTER_VISUAL_SCALE,
  chooseRoamingTarget,
  getRoamingStep,
  isRoamingPathClear,
} from '../src/features/world/world-roaming';
import { WORLD_BOUNDARY } from '../src/features/world/world-collision';

const runtimeSource = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');
const roamingMigrationSource = readFileSync(new URL('../supabase/migrations/20260812104458_keep_roaming_pets_inside_walkable_area.sql', import.meta.url), 'utf8');

describe('HabitHero roaming character', () => {
  it('ships a local GLB asset for the world NPC', () => {
    assert.equal(HABITHERO_ROAMING_CHARACTER_ASSET_KEY, 'character.habithero-sprout');
    assert.equal(HABITHERO_ROAMING_CHARACTER_MODEL_URL, '/assets/habithero-v16-wanderer.glb');
    const assetPath = new URL(`../public${HABITHERO_ROAMING_CHARACTER_MODEL_URL}`, import.meta.url);
    const asset = readFileSync(assetPath);
    assert.ok(statSync(assetPath).size > 100_000);
    assert.ok(statSync(assetPath).size < 12 * 1024 * 1024);
    assert.equal(asset.toString('ascii', 0, 4), 'glTF');
    assert.match(asset.toString('ascii'), /Walk_InPlace/);
  });

  it('chooses a target inside the walkable boundary and outside obstacles', () => {
    const values = [0.98, 0.98];
    const target = chooseRoamingTarget(
      { x: -2.4, z: 0 },
      0.34,
      [{ x: 1.1, z: -1.65, radius: 1 }],
      () => values.shift() ?? 0.5,
    );
    assert.ok(target);
    assert.ok(Math.abs(target.x) + 0.34 <= WORLD_BOUNDARY);
    assert.ok(Math.abs(target.z) + 0.34 <= WORLD_BOUNDARY);
    assert.ok(Math.hypot(target.x - 1.1, target.z + 1.65) > 1.34);
  });

  it('rejects a straight route that would cut through the central tree', () => {
    const tree = { x: 1.1, z: -1.65, radius: 1 };
    assert.equal(isRoamingPathClear({ x: -2.8, z: -1.65 }, { x: 3.8, z: -1.65 }, 0.34, [tree]), false);
    assert.equal(isRoamingPathClear({ x: -2.8, z: 0.1 }, { x: 3.8, z: 0.1 }, 0.34, [tree]), true);
  });

  it('moves toward a target with collision-safe sliding and reports arrival', () => {
    const first = getRoamingStep(
      { x: -2.4, z: 0 },
      { x: -1.4, z: 0 },
      1,
      0.34,
      0.5,
      [],
    );
    assert.equal(first.arrived, false);
    assert.ok(first.next.x > -2.4);
    assert.equal(first.facing.x, 1);

    const arrived = getRoamingStep(
      { x: -1.4, z: 0 },
      { x: -1.4, z: 0 },
      1,
      0.34,
      0.5,
      [],
    );
    assert.equal(arrived.arrived, true);
    assert.deepEqual(arrived.next, { x: -1.4, z: 0 });
  });

  it('mounts the asset as a separate world actor and respects reduced motion', () => {
    assert.match(runtimeSource, /PROTOTYPE_WORLD_ASSETS\.roamingCharacter/);
    assert.match(runtimeSource, /name = 'habithero-roaming-character'/);
    assert.match(runtimeSource, /roamingRoot\.scale\.setScalar\(\s*\(PROTOTYPE_WORLD_CONFIG\.characterTargetHeight/);
    assert.equal(HABITHERO_ROAMING_CHARACTER_SPEED, 0.3);
    assert.equal(HABITHERO_ROAMING_CHARACTER_VISUAL_SCALE, 0.7);
    assert.match(runtimeSource, /cloneSkinnedObject\(roamingCharacterSource\)/);
    assert.match(runtimeSource, /new THREE\.AnimationMixer\(roamingModel\)/);
    assert.match(runtimeSource, /if \(roamingActor\)/);
    assert.match(runtimeSource, /HABITHERO_ROAMING_CHARACTER_SPEED \* \(prefersReducedMotion \? 0\.45 : 1\)/);
    assert.match(runtimeSource, /roamingMixer\.update\(delta \* \(prefersReducedMotion \? 0\.75 : 1\)\)/);
    assert.match(runtimeSource, /wanderObstacles/);
    assert.match(runtimeSource, /roamingActor\.wanderState/);
    assert.match(runtimeSource, /getWanderStep\(/);
  });

  it('keeps roaming pets out of the tree at spawn and lets them choose collision-safe routes', () => {
    assert.match(roamingMigrationSource, /position_x = -3\.4 \+ \(roaming_slot - 1\) \* 3\.4/);
    assert.match(roamingMigrationSource, /position_z = -3\.2/);
    assert.match(runtimeSource, /getDistributedPetSpawnPosition/);
    assert.match(runtimeSource, /petSpawnObstacles\.push/);
    assert.match(runtimeSource, /createWanderState\(hashWanderSeed\(`pet:/);
    assert.match(runtimeSource, /getWanderStep\([\s\S]*actor\.wanderState/);
    assert.doesNotMatch(runtimeSource, /chooseRoamingTarget\(current, actor\.radius, wanderObstacles\)/);
  });

  it('initializes an independent steering stream for each roaming actor', () => {
    assert.match(runtimeSource, /hashWanderSeed\(`pet:\$\{entity\.id\}:\$\{entity\.inventoryItemId\}`\)/);
    assert.match(runtimeSource, /hashWanderSeed\('habithero-roaming-character'\)/);
    assert.match(runtimeSource, /if \(!step\.walking \|\| step\.blocked\)/);
  });
});
