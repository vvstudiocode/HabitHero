import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  findFacingPetTarget,
  getSharedInteractionActions,
  WORLD_INTERACTION_MAX_ANGLE_RADIANS,
  WORLD_INTERACTION_MAX_DISTANCE,
} from '../src/features/world/world-interaction';
import {
  getAvailablePetAnimationActions,
  getPetAnimationActionPlayback,
} from '../src/features/world/pet-animation';

const runtimeSource = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');
const terrainSource = readFileSync(new URL('../src/features/world/TerrainWorldLayer.tsx', import.meta.url), 'utf8');
const neutralThemeSource = readFileSync(new URL('../src/styles/neutral-theme.css', import.meta.url), 'utf8');

const starSproutChild = {
  name: '星芽小孩',
  characterModel: 'public/assets/characters/moss.glb',
};

function readGlbAnimationNames(path: string): string[] {
  const buffer = readFileSync(path);
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim()) as {
    animations?: Array<{ name?: string }>;
  };
  return (json.animations ?? []).flatMap((animation) => animation.name ? [animation.name] : []);
}

describe('world character and pet interaction', () => {
  it('finds the nearest pet in front without requiring a pet click', () => {
    const target = findFacingPetTarget({
      playerPosition: { x: 0, z: 0 },
      playerFacing: { x: 0, z: 1 },
      pets: [
        { inventoryItemId: 'pet-behind', position: { x: 0, z: -0.8 }, availableActions: ['wave'] },
        { inventoryItemId: 'pet-far', position: { x: 0, z: WORLD_INTERACTION_MAX_DISTANCE + 0.1 }, availableActions: ['wave'] },
        { inventoryItemId: 'pet-near', position: { x: 0.1, z: 1.1 }, availableActions: ['wave', 'sit'] },
        { inventoryItemId: 'pet-further', position: { x: -0.1, z: 1.8 }, availableActions: ['wave'] },
      ],
    });

    assert.equal(target?.inventoryItemId, 'pet-near');
    assert.ok((target?.angle ?? Number.POSITIVE_INFINITY) <= WORLD_INTERACTION_MAX_ANGLE_RADIANS);
  });

  it('requires the pet to be inside the forward interaction cone', () => {
    const target = findFacingPetTarget({
      playerPosition: { x: 0, z: 0 },
      playerFacing: { x: 1, z: 0 },
      pets: [{ inventoryItemId: 'pet-side', position: { x: 0, z: 1 }, availableActions: ['dance'] }],
    });

    assert.equal(target, null);
  });

  it('limits shared actions to clips present on both the child and pet', () => {
    assert.equal(starSproutChild.name, '星芽小孩');
    const characterActions = getAvailablePetAnimationActions(readGlbAnimationNames(starSproutChild.characterModel));
    const petActions = getAvailablePetAnimationActions(readGlbAnimationNames('public/assets/pets/arcadia.glb'));

    assert.deepEqual(
      getSharedInteractionActions(characterActions, petActions),
      ['sit', 'wave', 'dance'],
    );
    assert.deepEqual(
      getSharedInteractionActions(characterActions, []),
      [],
    );
  });

  it('keeps the action control available without a pet and resolves pet sync at activation time', () => {
    assert.match(runtimeSource, /findFacingPetTarget/);
    assert.match(runtimeSource, /playInteractionAction/);
    assert.match(terrainSource, /runtimeRef\.current\?\.playInteractionAction\(action\)/);
    const actionMenuStart = terrainSource.indexOf('data-world-action-control');
    const actionMenuEnd = terrainSource.indexOf('data-placement-controls', actionMenuStart);
    const actionMenu = terrainSource.slice(actionMenuStart, actionMenuEnd > actionMenuStart ? actionMenuEnd : undefined);
    assert.doesNotMatch(actionMenu, /disabled=\{!worldInteractionTarget/);
    assert.match(actionMenu, /onPointerDown=\{\(event\) =>/);
    assert.match(runtimeSource, /const characterAction = characterActions\.get\(actionName\);/);
    assert.match(runtimeSource, /playCharacterAction\(actionName\);/);
    assert.match(runtimeSource, /target\?\.availableActions\.includes\(actionName\)/);
    assert.doesNotMatch(terrainSource, /高亮提示/u);
  });

  it('keeps direct pet actions independent from character interaction actions', () => {
    const petAnimationStart = terrainSource.indexOf('const commitPetAnimation');
    const petAnimationEnd = terrainSource.indexOf('const commitWorldInteractionAction', petAnimationStart);
    const petAnimationHandler = terrainSource.slice(petAnimationStart, petAnimationEnd > petAnimationStart ? petAnimationEnd : undefined);

    assert.match(petAnimationHandler, /runtimeRef\.current\?\.playPetAnimation\(selection\.inventoryItemId, action\)/);
    assert.doesNotMatch(petAnimationHandler, /runtimeRef\.current\?\.playInteractionAction\(action\)/);
    assert.match(terrainSource, /data-world-action-control[\s\S]*?runtimeRef\.current\?\.playInteractionAction\(action\)/);
  });

  it('keeps movement input active while a character or pet action is playing', () => {
    assert.match(runtimeSource, /if \(currentInput && !options\.pausedRef\.current && !placementActive\) \{/);
    assert.doesNotMatch(runtimeSource, /if \(currentInput && !options\.pausedRef\.current && !placementActive && !interactionActionState\)/);
    assert.match(runtimeSource, /finishInteractionAction\('walk'\)/);
    assert.doesNotMatch(runtimeSource, /interactionActionState\.remaining/);
  });

  it('keeps action animations active until movement interrupts them', () => {
    assert.equal(getPetAnimationActionPlayback('sit'), 'hold');
    assert.equal(getPetAnimationActionPlayback('wave'), 'repeat');
    assert.equal(getPetAnimationActionPlayback('dance'), 'repeat');
    assert.match(runtimeSource, /getPetAnimationActionPlayback\(actionName\)/);
    assert.match(runtimeSource, /THREE\.LoopRepeat, Infinity/);
    assert.match(runtimeSource, /clampWhenFinished = true/);
  });

  it('crossfades pets back to a grounded base animation without exposing the bind pose', () => {
    const finishActionStart = runtimeSource.indexOf('const finishInteractionAction');
    const finishActionEnd = runtimeSource.indexOf('playInteractionAction =', finishActionStart);
    const finishAction = runtimeSource.slice(finishActionStart, finishActionEnd);

    assert.doesNotMatch(finishAction, /actor\.petActionActions\[state\.action\]\?\.stop\(\)/);
    assert.match(finishAction, /transitionPetAnimation\(actor, actor\.idleAction \?\? actor\.walkAction\)/);
    assert.doesNotMatch(finishAction, /actor\.activeAction = actor\.idleAction/);
    assert.match(runtimeSource, /nextAction\.reset\(\)\.setEffectiveWeight\(1\)\.play\(\)/);
    assert.match(runtimeSource, /nextAction\.crossFadeFrom\(previousAction/);
    assert.doesNotMatch(runtimeSource, /actor\.petActionActions\[actor\.petAction\]\?\.stop\(\)/);
  });

  it('uses a person-shaped action icon and the camera surface treatment', () => {
    const actionControlStart = terrainSource.indexOf('data-world-action-control');
    const actionControlEnd = terrainSource.indexOf('data-clean-mode-hint', actionControlStart);
    const actionControl = terrainSource.slice(actionControlStart, actionControlEnd > actionControlStart ? actionControlEnd : undefined);

    assert.match(actionControl, /<PersonStanding/);
    assert.doesNotMatch(actionControl, /<Sparkles/);
    assert.match(neutralThemeSource, /\.hh-world-clean-mode-control,\s*\.hh-world-action-toggle,\s*\.hh-world-action-item/);
  });
});
