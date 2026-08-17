import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  getAvailablePetAnimationActions,
  getPetAnimationActionClipName,
} from '../src/features/world/pet-animation';

const petAnimationSource = readFileSync(
  new URL('../src/features/world/pet-animation.ts', import.meta.url),
  'utf8',
);
const runtimeSource = readFileSync(
  new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url),
  'utf8',
);
const terrainSource = readFileSync(
  new URL('../src/features/world/TerrainWorldLayer.tsx', import.meta.url),
  'utf8',
);

describe('pet animation action buttons', () => {
  it('maps only authored optional clips to action buttons', () => {
    assert.deepEqual(
      getAvailablePetAnimationActions(['Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance']),
      ['sit', 'wave', 'dance'],
    );
    assert.deepEqual(
      getAvailablePetAnimationActions(['Idle', 'Walk_InPlace']),
      [],
    );
    assert.equal(getPetAnimationActionClipName(['Idle', 'Greet'], 'wave'), 'Greet');
    assert.equal(getPetAnimationActionClipName(['Idle', 'Walk_InPlace'], 'dance'), undefined);
  });

  it('derives optional action buttons from the clips available in each GLB', () => {
    assert.match(petAnimationSource, /export type PetAnimationAction = 'sit' \| 'wave' \| 'dance'/);
    assert.match(petAnimationSource, /export function getAvailablePetAnimationActions/);
    assert.match(runtimeSource, /availableActions/);
    assert.match(runtimeSource, /getAvailablePetAnimationActions/);
    assert.match(terrainSource, /selectedPet\.availableActions\.includes\('wave'\)/);
    assert.match(terrainSource, /selectedPet\.availableActions\.includes\('sit'\)/);
    assert.match(terrainSource, /selectedPet\.availableActions\.includes\('dance'\)/);
    assert.match(runtimeSource, /playPetAnimation: \(inventoryItemId, action\) => playPetAnimation\(inventoryItemId, action\)/);
    assert.match(runtimeSource, /stopPetAnimation: \(inventoryItemId\) => stopPetAnimation\(inventoryItemId\)/);
  });

  it('keeps core movement actions independent from optional authored clips', () => {
    assert.match(terrainSource, /commitPetAction\('idle'\)/);
    assert.match(terrainSource, /commitPetAction\('wander'\)/);
    assert.match(terrainSource, /commitPetAction\('follow'\)/);
    assert.match(terrainSource, /stopPetAnimation\(selection\.inventoryItemId\)/);
    assert.match(runtimeSource, /playPetAnimation/);
    assert.match(runtimeSource, /stopPetAnimation/);
    assert.match(runtimeSource, /action\.setLoop\(THREE\.LoopRepeat, Infinity\)/);
    assert.match(runtimeSource, /if \(actor\.petAction\)[\s\S]*?updatePetAnimation\(actor, false/);
  });
});
