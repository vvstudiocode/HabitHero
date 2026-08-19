import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  getAnimationClipName,
  getPetActorState,
  getWorldQuality,
  chooseWanderTarget,
  WORLD_QUALITY_SETTINGS,
} from '../src/features/world/TerrainWorldLayer';

const terrainWorldLayerSource = readFileSync(
  new URL('../src/features/world/TerrainWorldLayer.tsx', import.meta.url),
  'utf8',
);
const prototypeRuntimeSource = readFileSync(
  new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url),
  'utf8',
);
const runtimeAssetsSource = readFileSync(
  new URL('../src/features/world/world-runtime-assets.ts', import.meta.url),
  'utf8',
);

describe('production terrain asset contract', () => {
  it('loads the optimized big-tree asset and keeps a procedural fallback', () => {
    assert.match(runtimeAssetsSource, /tree: new URL\('\.\.\/\.\.\/\.\.\/terrain-prototype\/assets\/big-tree-optimized\.glb'/);
    assert.match(runtimeAssetsSource, /character: '\/assets\/characters\/arthur\.glb'/);
    assert.match(runtimeAssetsSource, /skybox: new URL\('\.\.\/\.\.\/\.\.\/terrain-prototype\/assets\/sky-equirectangular-day\.png'/);
    assert.match(prototypeRuntimeSource, /loadGltfSafely[^\n]+PROTOTYPE_WORLD_ASSETS\.tree/);
    assert.match(prototypeRuntimeSource, /defineAsset\(THREE, treeSource\)/);
    assert.match(prototypeRuntimeSource, /applyCentralTreeMaterialFallback\(THREE, treeDefinition\.source\)/);
    assert.match(prototypeRuntimeSource, /tree\.scale\.y \*= PROTOTYPE_WORLD_CONFIG\.treeHeightScale/);
    assert.match(prototypeRuntimeSource, /createProceduralGrassField\(THREE/);
    assert.match(prototypeRuntimeSource, /outerDensityMultiplier: qualitySettings\.outerDensityMultiplier/);
    assert.match(prototypeRuntimeSource, /createProceduralFlowerField\(THREE/);
    assert.match(prototypeRuntimeSource, /createProceduralForest\(THREE/);
    assert.doesNotMatch(prototypeRuntimeSource, /updateGrassInteractionState\(/);
    assert.match(prototypeRuntimeSource, /proceduralGrass\.update\(/);
    assert.match(prototypeRuntimeSource, /worldScene\.background = loadedTexture/);
    assert.match(prototypeRuntimeSource, /rendererInstance\.toneMapping = THREE\.ACESFilmicToneMapping/);
    assert.match(prototypeRuntimeSource, /rendererInstance\.shadowMap\.type = THREE\.PCFSoftShadowMap/);
  });

  it('loads the supplied character catalog as animated GLBs', () => {
    assert.match(terrainWorldLayerSource, /getCharacterRenderMode/);
    assert.match(terrainWorldLayerSource, /createProceduralCharacter/);
    assert.match(terrainWorldLayerSource, /assetKey: 'character\.arthur'/);
    assert.match(terrainWorldLayerSource, /getWorldCharacterModelUrl/);
    assert.match(terrainWorldLayerSource, /'world-glb'/);
    assert.match(prototypeRuntimeSource, /characterRenderMode === 'anime-maiden'/);
    assert.match(prototypeRuntimeSource, /characterRenderMode === 'world-glb'/);
    assert.match(prototypeRuntimeSource, /characterModelUrl/);
    assert.match(prototypeRuntimeSource, /characterRenderMode === 'procedural'/);
    assert.match(prototypeRuntimeSource, /createProceduralCharacter\(THREE, options\.equippedCatalogItem\)/);
    assert.match(prototypeRuntimeSource, /const characterUrl = options\.characterModelUrl \?\? PROTOTYPE_WORLD_ASSETS\.character/);
    assert.match(prototypeRuntimeSource, /new THREE\.AnimationMixer\(characterSource\)/);
    assert.match(prototypeRuntimeSource, /mixer\.update\(delta\)/);
    assert.match(prototypeRuntimeSource, /walk|run/);
    assert.match(prototypeRuntimeSource, /idle/);
  });

  it('keeps animation and quality decisions deterministic and safe', () => {
    assert.equal(getAnimationClipName(['Idle', 'Walk'], 'idle'), 'Idle');
    assert.equal(getAnimationClipName(['Armature|Run'], 'walk'), 'Armature|Run');
    assert.equal(getAnimationClipName([], 'idle'), undefined);
    assert.equal(getWorldQuality({ prefersReducedMotion: true, hardwareConcurrency: 8 }), 'low');
    assert.equal(getWorldQuality({ prefersReducedMotion: false, deviceMemory: 2, hardwareConcurrency: 8 }), 'low');
    assert.equal(getWorldQuality({ prefersReducedMotion: false, hardwareConcurrency: 2 }), 'low');
    assert.equal(getWorldQuality({ prefersReducedMotion: false, hardwareConcurrency: 8, deviceMemory: 8 }), 'high');
    assert.ok(WORLD_QUALITY_SETTINGS.high.grassCount > WORLD_QUALITY_SETTINGS.low.grassCount);
    assert.ok(WORLD_QUALITY_SETTINGS.high.flowerCount > WORLD_QUALITY_SETTINGS.low.flowerCount);
  });

  it('uses explicit pet states and selects wander targets inside collision-safe bounds', () => {
    assert.equal(getPetActorState('idle', false), 'idle');
    assert.equal(getPetActorState('static', false), 'idle');
    assert.equal(getPetActorState('wander', false), 'wandering');
    assert.equal(getPetActorState('wander', true), 'following');

    const randomValues = [0.99, 0.99];
    const target = chooseWanderTarget(
      { x: 3, z: 3 },
      0.3,
      [{ x: 0, z: 0, radius: 1.15 }],
      () => randomValues.shift() ?? 0.5,
    );
    assert.ok(target);
    assert.ok(Math.abs(target.x) + 0.3 <= 4.8);
    assert.ok(Math.abs(target.z) + 0.3 <= 4.8);
    assert.ok(Math.hypot(target.x, target.z) > 1.45);
    assert.match(prototypeRuntimeSource, /getWanderStep\(/);
    assert.match(prototypeRuntimeSource, /wanderState/);
    assert.doesNotMatch(prototypeRuntimeSource, /getRoamingStep\(/);
  });

  it('renders a semantic static scene when the 3D runtime fails and hides the canvas', () => {
    assert.match(terrainWorldLayerSource, /hh-terrain-world-static-fallback/);
    assert.match(terrainWorldLayerSource, /hh-terrain-world-static-tree/);
    assert.match(terrainWorldLayerSource, /hh-terrain-world-static-character/);
    assert.match(terrainWorldLayerSource, /hidden=\{showStaticFallback\}/);
    assert.match(terrainWorldLayerSource, /aria-hidden=\{showStaticFallback\}/);
    assert.match(terrainWorldLayerSource, /操作提示/);
    assert.match(terrainWorldLayerSource, /setShowStaticFallback\(false\)/);
    assert.match(terrainWorldLayerSource, /useEffect\(\(\) => \{\s*setShowStaticFallback\(false\);\s*\}, \[childId\]\)/);
    assert.match(terrainWorldLayerSource, /setShowStaticFallback\(false\);\s*setStatus\('ready'\)/);
    assert.match(terrainWorldLayerSource, /setRuntimeAttempt\(\(attempt\) => attempt \+ 1\)/);
    assert.match(terrainWorldLayerSource, /重新嘗試 3D/);
  });
});
