import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { AnimationClip, VectorKeyframeTrack } from 'three';
import {
  WORLD_QUALITY_SETTINGS,
  getWorldQuality,
  scaleWorldBudget,
} from '../src/features/world/world-quality';
import { patchEquippedCharacter } from '../src/features/world/game-loadout';
import { emptyChildGameData } from '../src/features/world/contracts';
import {
  getPetModelScale,
  getPetWorldScale,
  getOuterTreePlacement,
  createInPlaceAnimationClip,
  PET_MAX_DIMENSION_RATIO,
  PET_MAX_HEIGHT_RATIO,
  PET_WANDER_SPEED,
  PET_WORLD_SCALE_MULTIPLIER,
} from '../src/features/world/prototype-world-runtime';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const runtimeSource = read('../src/features/world/prototype-world-runtime.ts');
const heroSource = read('../src/components/DashboardCharacterHero.tsx');
const worldLayerSource = read('../src/features/world/TerrainWorldLayer.tsx');
const characterStyles = read('../src/styles/character.css');
const storeSource = read('../src/store.tsx');
const docsSource = read('../docs/game-assets.md');
const grassSceneSource = read('../terrain-prototype/procedural-grass-scene.js');
const treeSceneSource = read('../terrain-prototype/procedural-trees.js');
const atmosphereSource = read('../terrain-prototype/natural-world-atmosphere.js');
const creatureSource = read('../terrain-prototype/natural-world-creatures.js');
const boundaryScenerySource = read('../terrain-prototype/natural-boundary-scenery.js');
const eastFairytaleSource = read('../terrain-prototype/east-fairytale-scenery.js');

describe('prototype world runtime contracts', () => {
  it('keeps the original outer grass density budgets while retaining quality scaling', () => {
    assert.equal(getWorldQuality({ prefersReducedMotion: false, deviceMemory: 8, hardwareConcurrency: 8 }), 'high');
    assert.equal(getWorldQuality({ prefersReducedMotion: true, deviceMemory: 8, hardwareConcurrency: 8 }), 'low');
    assert.equal(scaleWorldBudget(1000, 'high', 'grass'), 1000);
    assert.equal(scaleWorldBudget(1000, 'low', 'grass'), 600);
    assert.equal(scaleWorldBudget(1000, 'low', 'flower'), 357);
    assert.ok(WORLD_QUALITY_SETTINGS.low.outerDensityMultiplier < WORLD_QUALITY_SETTINGS.high.outerDensityMultiplier);
    assert.ok(WORLD_QUALITY_SETTINGS.low.boundaryDensityMultiplier < WORLD_QUALITY_SETTINGS.high.boundaryDensityMultiplier);
    assert.equal(WORLD_QUALITY_SETTINGS.low.outerDensityMultiplier, 12);
    assert.equal(WORLD_QUALITY_SETTINGS.high.outerDensityMultiplier, 18);
    assert.equal(WORLD_QUALITY_SETTINGS.low.boundaryDensityMultiplier, 4);
    assert.equal(WORLD_QUALITY_SETTINGS.high.boundaryDensityMultiplier, 6);
    assert.ok(WORLD_QUALITY_SETTINGS.low.forestLayers <= WORLD_QUALITY_SETTINGS.high.forestLayers);
    assert.equal(WORLD_QUALITY_SETTINGS.low.shadows, false);
    assert.equal(WORLD_QUALITY_SETTINGS.high.shadows, true);
  });

  it('wires the selected quality settings into the 3D runtime', () => {
    assert.match(runtimeSource, /getWorldQuality\(/);
    assert.match(runtimeSource, /scaleWorldBudget\(/);
    assert.match(runtimeSource, /outerDensityMultiplier: qualitySettings\.outerDensityMultiplier/);
    assert.match(runtimeSource, /boundaryDensityMultiplier: qualitySettings\.boundaryDensityMultiplier/);
    assert.match(runtimeSource, /layers: qualitySettings\.forestLayers/);
    assert.match(runtimeSource, /shadowMap\.enabled = qualitySettings\.shadows/);
    assert.match(runtimeSource, /getWorldPixelRatio\(/);
    assert.match(runtimeSource, /rendererInstance\.setPixelRatio\(pixelRatio\)/);
    assert.match(runtimeSource, /shouldRenderWorldFrame\(/);
    assert.match(runtimeSource, /sun\.castShadow = qualitySettings\.shadows/);
  });

  it('keeps the natural lighting pass connected to the quality budget', () => {
    assert.match(runtimeSource, /getNaturalWorldVisualSettings\(quality\)/);
    assert.match(runtimeSource, /worldScene\.environment = loadedTexture/);
    assert.match(runtimeSource, /sun\.shadow\.normalBias/);
    assert.match(runtimeSource, /createAmbientPollenField/);
    assert.match(runtimeSource, /createSunlightPatchField/);
    assert.match(runtimeSource, /createButterflyField/);
    assert.match(grassSceneSource, /createNaturalGroundMaterial/);
    assert.match(grassSceneSource, /outerGround\.receiveShadow = true/);
    assert.match(grassSceneSource, /walkableGround\.receiveShadow = true/);
    assert.match(grassSceneSource, /ground\.add\(outerGround, walkableGround\)/);
    assert.match(grassSceneSource, /mesh\.castShadow = false/);
    assert.match(grassSceneSource, /mesh\.receiveShadow = false/);
    assert.match(grassSceneSource, /uSunDirection/);
    assert.match(grassSceneSource, /habitHeroGroundHash/);
    assert.match(treeSceneSource, /vertexColors: true/);
    assert.match(atmosphereSource, /ambient-pollen/);
    assert.match(atmosphereSource, /subtle-afternoon-sunlight-patches/);
    assert.match(creatureSource, /big-tree-butterflies/);
    assert.match(creatureSource, /CanvasTexture/);
    assert.match(creatureSource, /flapRate/);
    assert.doesNotMatch(boundaryScenerySource, /outer-showcase-tree|createProceduralShowcaseTree|distant-tree|distant-hill/);
    assert.match(runtimeSource, /createEastFairytaleScenery/);
    assert.match(read('../terrain-prototype/index.html'), /createEastFairytaleScenery/);
    assert.match(eastFairytaleSource, /east-fairytale-castle/);
    assert.match(eastFairytaleSource, /east-fairytale-windmill/);
    assert.match(eastFairytaleSource, /EAST_FLOWER_COLORS/);
    assert.match(eastFairytaleSource, /update\(time\)/);
    assert.match(eastFairytaleSource, /rotor\.rotation\.x/);
    assert.match(eastFairytaleSource, /rotor\.rotation\.y\s*=\s*Math\.atan2\(-item\.z, item\.x\)/);
    assert.match(eastFairytaleSource, /new THREE\.BoxGeometry\(0\.12, 1\.15, 0\.2\)/);
    assert.match(runtimeSource, /eastFairytaleScenery\.update\(sceneElapsedTime\)/);
    assert.match(read('../terrain-prototype/index.html'), /eastFairytaleScenery\?\.update\(sceneElapsedTime\)/);
    assert.doesNotMatch(treeSceneSource, /createProceduralShowcaseTree/);
    assert.doesNotMatch(runtimeSource, /natural-ground-details|createNaturalGroundDetails/);
    assert.doesNotMatch(read('../terrain-prototype/index.html'), /natural-ground-details|createNaturalGroundDetails/);
  });

  it('removes the decorative stone, shrub, and log perimeter from both scene entry points', () => {
    const standaloneSource = read('../terrain-prototype/index.html');

    assert.doesNotMatch(runtimeSource, /natural-boundary-scenery/);
    assert.doesNotMatch(runtimeSource, /createNaturalBoundaryScenery/);
    assert.doesNotMatch(standaloneSource, /natural-boundary-scenery/);
    assert.doesNotMatch(standaloneSource, /createNaturalBoundaryScenery/);
  });

  it('keeps the butterfly ring around a three-unit radius in both scene entry points', () => {
    const standaloneSource = read('../terrain-prototype/index.html');
    assert.match(runtimeSource, /getButterflyFlightBounds/);
    assert.match(runtimeSource, /treeFootprintRadius:\s*treePlacement\.footprintRadius/);
    assert.match(runtimeSource, /maxRadius:\s*3/);
    assert.match(runtimeSource, /minRadius:\s*butterflyFlightBounds\.minRadius/);
    assert.match(runtimeSource, /radius:\s*butterflyFlightBounds\.maxRadius/);
    assert.match(standaloneSource, /getButterflyFlightBounds/);
    assert.match(standaloneSource, /treeFootprintRadius:\s*treePlacement\.footprintRadius/);
    assert.match(standaloneSource, /maxRadius:\s*3/);
    assert.match(standaloneSource, /minRadius:\s*butterflyFlightBounds\.minRadius/);
    assert.match(standaloneSource, /radius:\s*butterflyFlightBounds\.maxRadius/);
  });

  it('places the imported big tree at the upper outer edge in both scene entry points', () => {
    const standaloneSource = read('../terrain-prototype/index.html');
    assert.match(runtimeSource, /getOuterTreePlacement\(/);
    assert.match(runtimeSource, /treeSize: treeDefinition\.size/);
    assert.match(runtimeSource, /treeSize: treeDefinition\.size/);
    assert.match(runtimeSource, /treePlacement\.scale/);
    assert.match(runtimeSource, /PROTOTYPE_WORLD_CONFIG\.treeAnchorX/);
    assert.match(standaloneSource, /getOuterTreePlacement\(/);
    assert.match(standaloneSource, /treeSize: treeDefinition\.size/);
    assert.match(standaloneSource, /treeSize: treeDefinition\.size/);
    assert.match(standaloneSource, /treePlacement\.scale/);
    assert.match(standaloneSource, /TREE_POSITION\.x/);
  });

  it('keeps the calculated tree footprint completely outside the walkable edge', () => {
    const placement = getOuterTreePlacement({
      treeSize: { x: 1.03942, y: 1.04616, z: 1.03661 },
      terrainLimit: 4.862,
      terrainStep: 1.1,
      treeFitToTile: 7.2,
      x: 1.1,
    });
    assert.ok(placement.z + placement.halfDepth < -4.862);
    assert.ok(placement.z < -4.862);
    assert.ok(placement.footprintRadius > 0);
  });

  it('wires the portrait control band to independent movement, camera, and pinch input', () => {
    assert.match(runtimeSource, /getWorldInputZone\(point, rect\.height\)/);
    assert.match(runtimeSource, /zone: event\.pointerType === 'mouse' \? 'camera' : getWorldInputZone/);
    assert.match(worldLayerSource, /data-world-input-layout="portrait-control-band"/);
    assert.match(worldLayerSource, /下方四分之一拖曳移動，上方單指拖曳調整視角，雙指捏合縮放/);
    assert.match(runtimeSource, /cameraPitchMax:\s*Math\.PI\s*\*\s*\(89\s*\/\s*180\)/);
    assert.match(read('../terrain-prototype/index.html'), /CAMERA_PITCH_MAX = Math\.PI\s*\*\s*\(89\s*\/\s*180\)/);
  });

  it('lets passive statistics pass world pointer events through while keeping menu controls interactive', () => {
    assert.match(characterStyles, /\.hh-character-stats\s*\{[\s\S]*?pointer-events:\s*none;/);
    assert.match(characterStyles, /\.hh-character-menu\s*\{[\s\S]*?pointer-events:\s*none;/);
    assert.match(characterStyles, /\.hh-character-menu:not\(\.has-submenu\)[\s\S]*?pointer-events:\s*auto;/);
    assert.match(characterStyles, /\.hh-character-menu\.is-open \.hh-character-menu-root>\.hh-character-menu-action[\s\S]*?pointer-events:\s*auto;/);
  });

  it('exposes a focusable canvas with keyboard camera alternatives without removing movement keys', () => {
    assert.match(worldLayerSource, /tabIndex=\{0\}/);
    assert.match(worldLayerSource, /聚焦後使用 WASD[／/]方向鍵移動/);
    assert.match(runtimeSource, /getKeyboardCameraInput/);
    assert.match(runtimeSource, /isWorldCameraKey/);
    assert.match(runtimeSource, /getKeyboardMovement/);
    assert.match(runtimeSource, /cameraYaw/);
    assert.match(runtimeSource, /cameraPitch/);
    assert.match(runtimeSource, /cameraDistance/);
  });

  it('cleans async GLTF resources and handles context loss without forcing context loss', () => {
    assert.match(runtimeSource, /resourceRoots/);
    assert.match(runtimeSource, /trackResourceRoot\(treeSource/);
    assert.match(runtimeSource, /trackResourceRoot\(characterSource/);
    assert.match(runtimeSource, /webglcontextlost/);
    assert.doesNotMatch(runtimeSource, /forceContextLoss\s*\(/);
    assert.match(runtimeSource, /AbortError/);
    assert.match(runtimeSource, /alphaMap|normalMap|roughnessMap/);
  });

  it('renders the supplied animated GLB pet and keeps movement animation state explicit', () => {
    assert.match(runtimeSource, /getRequiredWorldPetCatalogItems/);
    assert.match(runtimeSource, /getLocalGameModelUrl/);
    assert.doesNotMatch(runtimeSource, /PET_MODEL_URL/);
    assert.match(runtimeSource, /loadGltfSafely[\s\S]*petModel/);
    assert.match(runtimeSource, /cloneSkinnedObject/);
    assert.match(runtimeSource, /new THREE\.AnimationMixer\(model/);
    assert.match(runtimeSource, /createPetModel/);
    assert.match(runtimeSource, /clipAction\(createInPlaceAnimationClip\(getWalkAnimationClip\(animations\)!\)\)/);
    assert.match(runtimeSource, /createInPlaceAnimationClip\(getWalkAnimationClip\(roamingCharacterAnimations\)!\)/);
    assert.match(runtimeSource, /updatePetAnimation/);
    assert.match(runtimeSource, /getPetWorldScale/);
    assert.match(runtimeSource, /getPetModelScale/);
    assert.match(runtimeSource, /worldEntities\.filter\(\(entity\) => entity\.isActive\)/);
    assert.match(runtimeSource, /followingPet\?\.maxScale/);
    assert.match(runtimeSource, /followingPetInventoryIds\.forEach/);
    assert.match(runtimeSource, /orderedFollowingActors/);
    assert.match(runtimeSource, /WORLD_BOUNDARY/);
    assert.match(runtimeSource, /PET_WANDER_SPEED/);
    assert.match(runtimeSource, /getWanderStep\([\s\S]*PET_WANDER_SPEED/);
    assert.match(runtimeSource, /createWanderState\(/);
    assert.match(runtimeSource, /hashWanderSeed\(/);
    assert.doesNotMatch(runtimeSource, /chooseRoamingTarget\(current, actor\.radius, wanderObstacles\)/);
    assert.doesNotMatch(runtimeSource, /getRoamingStep\([\s\S]*PET_WANDER_SPEED/);
    assert.equal(PET_WORLD_SCALE_MULTIPLIER, 1.3);
    assert.equal(PET_WANDER_SPEED, 0.5);
    assert.match(runtimeSource, /PET_WORLD_SCALE_MULTIPLIER/);
    assert.match(runtimeSource, /target: null, followHistory: \[\], wanderState/);
    assert.match(runtimeSource, /state = 'wandering'/);
    assert.doesNotMatch(runtimeSource, /Math\.abs\(Math\.sin\(actor\.walkPhase\)\)/);
    assert.doesNotMatch(runtimeSource, /PET_SPRITE|farm-animals|pixel-farm-pet/);
    assert.equal(getPetWorldScale({ requestedScale: 10, petHeight: 1, characterHeight: 1 }), PET_MAX_HEIGHT_RATIO);
    assert.equal(getPetWorldScale({ requestedScale: 0.2, petHeight: 1, characterHeight: 1 }), 0.2);
    const baseModelScale = getPetModelScale({ requestedScale: 1, petHeight: 0.5, characterHeight: 1 });
    assert.equal(getPetModelScale({ requestedScale: 0.5, petHeight: 0.5, characterHeight: 1 }), baseModelScale * 0.5);
  });

  it('removes horizontal root motion from patrol clips without changing the source clip', () => {
    const sourceClip = new AnimationClip('Walk_Forward', -1, [
      new VectorKeyframeTrack('root.position', [0, 1], [0, -1, 0, 0, -0.8, 1.8]),
      new VectorKeyframeTrack('pelvis.position', [0, 1], [0, 0, 0, 0, 0.02, 0]),
    ]);

    const inPlaceClip = createInPlaceAnimationClip(sourceClip);
    const rootTrack = inPlaceClip.tracks.find((track) => track.name === 'root.position');
    const sourceRootTrack = sourceClip.tracks.find((track) => track.name === 'root.position');

    assert.ok(rootTrack);
    assert.ok(sourceRootTrack);
    assert.deepEqual(Array.from(rootTrack.values), [0, -1, 0, 0, rootTrack.values[4], 0]);
    assert.deepEqual(Array.from(sourceRootTrack.values), [0, -1, 0, 0, sourceRootTrack.values[4], sourceRootTrack.values[5]]);
    assert.notEqual(inPlaceClip, sourceClip);
  });

  it('caps pet scale by the largest imported model dimension, not only its height', () => {
    assert.equal(
      getPetWorldScale({
        requestedScale: 10,
        petHeight: 1,
        petSize: { x: 4, y: 1, z: 2 },
        characterHeight: 1,
      }),
      PET_MAX_DIMENSION_RATIO / 4,
    );
  });

  it('does not render or query animation work while a feature panel is paused', () => {
    assert.match(runtimeSource, /if \(options\.pausedRef\.current\) \{[\s\S]{0,260}setTimeout/);
    assert.match(runtimeSource, /proceduralGrass\.update\(/);
    assert.equal((runtimeSource.match(/matchMedia\(/g) ?? []).length, 1);
  });

  it('does not preload hero media when a 3D scene owns the hero surface', () => {
    assert.match(heroSource, /const hasSceneLayer = Boolean\(sceneLayer\)/);
    assert.match(heroSource, /\{!hasSceneLayer && \(\s*<picture/);
    assert.match(heroSource, /\{!hasSceneLayer && mobileSceneVideo && \(/);
    assert.match(heroSource, /sceneLayer && <div className="hh-character-scene-layer">/);
  });

  it('patches the equipped character in local game data before the RPC settles', () => {
    const original = emptyChildGameData();
    const patched = patchEquippedCharacter(original, 'inventory-new');
    assert.equal(patched.loadout?.equippedCharacterInventoryId, 'inventory-new');
    assert.equal(patched.loadout?.followingPetInventoryId, null);
    assert.match(storeSource, /equipGameCharacter:[\s\S]*?patchEquippedCharacter/);
  });

  it('updates character and pet actors without remounting the terrain runtime', () => {
    assert.match(runtimeSource, /update: \(next: PrototypeWorldRuntimeUpdate\) => void/);
    assert.match(runtimeSource, /queueCharacterUpdate/);
    assert.match(runtimeSource, /updatePetActors/);
    assert.match(worldLayerSource, /runtimeRef\.current\?\.update\(sceneInput\)/);
    assert.doesNotMatch(worldLayerSource, /\[childId, runtimeAttempt, sceneInput\]\);/);
  });

  it('documents the actual quality strategy without claiming an absent fallback loader', () => {
    assert.match(docsSource, /high.*outer-density multiplier of 36/is);
    assert.match(docsSource, /low.*360.*distant tree silhouettes.*disables renderer shadows/is);
    assert.doesNotMatch(docsSource, /low quality[^\n]*never starts the GLB loader/i);
  });
});
