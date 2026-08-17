import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  GRASS_BOUNDARY_BAND_RATIO,
  MAX_GRASS_INTERACTORS,
  createProceduralGrassLayout,
  getProceduralGrassCount,
  updateGrassInteractionState,
} from '../terrain-prototype/procedural-grass-field.js';
import {
  FOREST_BRANCH_COUNT,
  FOREST_CANOPY_LOBE_COUNT,
  FOREST_PALETTE,
  getForestBoundaryTreeSpecs,
} from '../terrain-prototype/procedural-tree-layout.js';
import {
  FLOWER_COLORS,
  createProceduralFlowerLayout,
  getProceduralFlowerCount,
} from '../terrain-prototype/procedural-flower-layout.js';
import {
  GRASS_COLOR_LAYER_THRESHOLDS,
  getGrassColorLayer,
} from '../terrain-prototype/procedural-grass-scene.js';

describe('terrain prototype procedural grass', () => {
  it('uses a several-times denser but device-aware blade budget', () => {
    assert.equal(getProceduralGrassCount({ width: 375, pixelRatio: 3 }), 54000);
    assert.equal(getProceduralGrassCount({ width: 768, pixelRatio: 2 }), 94500);
    assert.equal(getProceduralGrassCount({ width: 1440, pixelRatio: 2 }), 162000);
  });

  it('generates deterministic grass that is finer than the standalone experiment', () => {
    const options = {
      count: 320,
      fieldSize: 18,
      walkableSize: 8,
      baseHeight: 0.02,
      clumpCount: 20,
      seed: 88,
    };
    const first = createProceduralGrassLayout(options);
    const second = createProceduralGrassLayout(options);
    const outerQuintupled = createProceduralGrassLayout({
      ...options,
      outerDensityMultiplier: 5,
    });
    const boundaryBoosted = createProceduralGrassLayout({
      ...options,
      outerDensityMultiplier: 5,
      boundaryDensityMultiplier: 3,
    });

    assert.deepEqual(first, second);
    assert.equal(first.length, 320);
    assert.equal(first.every(blade => Math.abs(blade.x) <= 9 && Math.abs(blade.z) <= 9), true);
    assert.equal(first.every(blade => blade.y === 0.02), true);
    assert.equal(first.every(blade => blade.width >= 0.012 && blade.width <= 0.034), true);
    assert.equal(first.every(blade => blade.height >= 0.07 && blade.height <= 0.19), true);
    assert.equal(first.filter(blade => Math.abs(blade.x) <= 4 && Math.abs(blade.z) <= 4).length >= 220, true);
    assert.equal(first.filter(blade => Math.abs(blade.x) > 4 || Math.abs(blade.z) > 4).length >= 38, true);
    const innerCount = first.filter(blade => Math.abs(blade.x) <= 4 && Math.abs(blade.z) <= 4).length;
    const outerCount = first.length - innerCount;
    assert.equal(outerCount >= Math.floor(first.length * 0.22), true);
    const firstOuterBlades = first.filter(blade => Math.abs(blade.x) > 4 || Math.abs(blade.z) > 4);
    const quintupledInnerCount = outerQuintupled.filter(
      blade => Math.abs(blade.x) <= 4 && Math.abs(blade.z) <= 4,
    ).length;
    const firstStaggeredOuterCopy = outerQuintupled.slice(first.length, first.length + outerCount);
    assert.deepEqual(outerQuintupled.slice(0, first.length), first);
    assert.equal(quintupledInnerCount, innerCount);
    assert.equal(outerQuintupled.length - quintupledInnerCount, outerCount * 5);
    assert.equal(
      firstStaggeredOuterCopy.every((blade, index) => (
        Math.hypot(blade.x - firstOuterBlades[index].x, blade.z - firstOuterBlades[index].z) >= 0.08
      )),
      true,
    );
    assert.equal(
      firstStaggeredOuterCopy.every(blade => Math.abs(blade.x) > 4 || Math.abs(blade.z) > 4),
      true,
    );
    assert.equal(new Set(firstStaggeredOuterCopy.map(blade => `${blade.x}:${blade.z}`)).size, outerCount);

    const walkableBoundary = Math.min(options.walkableSize, options.fieldSize) * 0.5;
    const boundaryBand = Math.min(options.walkableSize * GRASS_BOUNDARY_BAND_RATIO, 1.6);
    const boundaryBlades = first.filter(blade => (
      Math.max(Math.abs(blade.x), Math.abs(blade.z)) > walkableBoundary
      && Math.max(Math.abs(blade.x), Math.abs(blade.z)) <= walkableBoundary + boundaryBand
    ));
    const extraBoundaryBlades = boundaryBoosted.slice(outerQuintupled.length);
    assert.equal(boundaryBlades.length > 0, true);
    assert.deepEqual(boundaryBoosted.slice(0, outerQuintupled.length), outerQuintupled);
    assert.equal(extraBoundaryBlades.length, boundaryBlades.length * 2);
    assert.equal(
      extraBoundaryBlades.every(blade => (
        Math.max(Math.abs(blade.x), Math.abs(blade.z)) > walkableBoundary
        && Math.max(Math.abs(blade.x), Math.abs(blade.z)) <= walkableBoundary + boundaryBand + 0.08
      )),
      true,
    );
    assert.equal(
      extraBoundaryBlades.every(blade => Math.abs(blade.x) > 4 || Math.abs(blade.z) > 4),
      true,
    );
  });

  it('responds immediately to movement and settles continuously after stopping', () => {
    const moving = updateGrassInteractionState({
      previousPosition: { x: 0, z: 0 },
      currentPosition: { x: 0.12, z: 0 },
      previousStrength: 0,
      previousDirection: { x: 0, z: 1 },
      delta: 0.1,
    });
    const settling = updateGrassInteractionState({
      previousPosition: { x: 0.12, z: 0 },
      currentPosition: { x: 0.12, z: 0 },
      previousStrength: moving.strength,
      previousDirection: moving.direction,
      delta: 0.1,
    });

    assert.equal(moving.direction.x > 0.99, true);
    assert.equal(Math.abs(moving.direction.z) < 0.01, true);
    assert.equal(moving.strength > 0.7, true);
    assert.equal(settling.strength < moving.strength, true);
    assert.equal(settling.strength > 0, true);
    assert.deepEqual(settling.direction, moving.direction);
  });

  it('removes global wind while preserving interactor capacity for contact movement', () => {
    assert.equal(MAX_GRASS_INTERACTORS, 2);
    const grassSceneSource = readFileSync(new URL('../terrain-prototype/procedural-grass-scene.js', import.meta.url), 'utf8');
    assert.doesNotMatch(grassSceneSource, /uWindStrength|primaryWave|detailWave|float gust/);
    assert.match(grassSceneSource, /getInteractionOffset/);
  });

  it('maps meadow distance into edge, middle, and distant rendering layers', () => {
    const zone = { walkableHalf: 5, fieldHalf: 13 };

    assert.equal(getGrassColorLayer({ distanceFromCenter: 4.8, ...zone }), 'middle');
    assert.equal(getGrassColorLayer({ distanceFromCenter: 5.7, ...zone }), 'edge');
    assert.equal(getGrassColorLayer({ distanceFromCenter: 7.8, ...zone }), 'middle');
    assert.equal(getGrassColorLayer({ distanceFromCenter: 11.1, ...zone }), 'distant');
    assert.ok(GRASS_COLOR_LAYER_THRESHOLDS.edgeEnd < GRASS_COLOR_LAYER_THRESHOLDS.distantStart);
  });

  it('keeps the air-wall transition at the walkable meadow color', () => {
    const grassSceneSource = readFileSync(new URL('../terrain-prototype/procedural-grass-scene.js', import.meta.url), 'utf8');

    assert.match(grassSceneSource, /vec3 groundEdgeColor = vec3\(0\.16, 0\.43, 0\.12\);/);
    assert.match(grassSceneSource, /vec3 groundMiddleColor = vec3\(0\.16, 0\.43, 0\.12\);/);
    assert.match(grassSceneSource, /vec3 groundDistantColor = vec3\(0\.16, 0\.43, 0\.12\);/);
    assert.match(grassSceneSource, /vec3 edgeLayerColor = vec3\(0\.15, 0\.47, 0\.12\);/);
    assert.match(grassSceneSource, /vec3 middleLayerColor = vec3\(0\.15, 0\.47, 0\.12\);/);
    assert.match(grassSceneSource, /vec3 distantLayerColor = vec3\(0\.15, 0\.47, 0\.12\);/);
    assert.match(grassSceneSource, /diffuseColor\.rgb \*= 1\.08;/);
  });

  it('integrates the procedural meadow scenery into the original prototype', () => {
    const source = readFileSync(new URL('../terrain-prototype/index.html', import.meta.url), 'utf8');
    const grassSceneSource = readFileSync(new URL('../terrain-prototype/procedural-grass-scene.js', import.meta.url), 'utf8');

    assert.match(source, /createProceduralGrassField/);
    assert.match(source, /updateGrassInteractionState/);
    assert.match(source, /proceduralGrass\?\.update/);
    assert.match(source, /proceduralGrass\.ground/);
    assert.match(source, /createProceduralForest/);
    assert.match(source, /createProceduralFlowerField/);
    assert.match(source, /centralTreeHeight \* 0\.5/);
    assert.match(source, /getNaturalWorldVisualSettings\('high'\)/);
    assert.match(source, /new THREE\.Fog\(skyboxHorizon, visualSettings\.fogNear, visualSettings\.fogFar\)/);
    assert.match(source, /new THREE\.DirectionalLight\(visualSettings\.sunColor, visualSettings\.sunIntensity\)/);
    assert.match(source, /scene\.environment = texture/);
    assert.match(source, /createAmbientPollenField/);
    assert.match(source, /outerDensityMultiplier: 36/);
    assert.match(source, /boundaryDensityMultiplier: 10/);
    assert.match(grassSceneSource, /uWalkableHalf/);
    assert.match(grassSceneSource, /vGrassEdgeFactor/);
    assert.match(grassSceneSource, /vGrassDistantFactor/);
    assert.match(grassSceneSource, /deep-edge|distant/);
    assert.doesNotMatch(source, /createCompanionTreeGrove/);
    assert.match(source, /let cameraYaw = Math\.PI/);
    assert.doesNotMatch(source, /wind-strength|wind-toggle|風吹過的草原/);
    assert.doesNotMatch(source, /grass-tile\.glb|grass-meadow-generated\.png|generated-grass-surface/);
    assert.doesNotMatch(source, /kenney-survival|kaykit-forest|forestTrees|addInstancedForest/);
  });

  it('rings the walkable boundary with light, painted broadleaf trees', () => {
    const terrainLimit = 4.862;
    const heightLimit = 3.2;
    const trees = getForestBoundaryTreeSpecs({
      terrainLimit,
      groundHeight: 0,
      layers: 5,
      heightLimit,
    });
    const nearestBoundaryDistance = Math.min(...trees.map(tree => (
      Math.max(Math.abs(tree.position.x), Math.abs(tree.position.z)) - terrainLimit
    )));

    assert.equal(trees.length >= 120, true);
    assert.equal(nearestBoundaryDistance >= 0.08 && nearestBoundaryDistance <= 0.24, true);
    assert.deepEqual(new Set(trees.map(tree => tree.type)), new Set(['broadleaf']));
    assert.equal(trees.every(tree => tree.height <= heightLimit), true);
    assert.equal(Math.max(...trees.map(tree => tree.height)) <= heightLimit, true);
    assert.equal(trees.every(tree => tree.canopyStyle === 'painted-canopy'), true);
    assert.equal(
      trees.every(tree => (
        tree.trunkHeight / tree.height >= 0.46 && tree.trunkHeight / tree.height <= 0.52
      )),
      true,
    );
    assert.equal(
      trees.filter(tree => tree.layer === 0).every(tree => (
        tree.crownWidth / tree.height <= 0.21
      )),
      true,
    );
    assert.equal(trees.every(tree => tree.trunkWidth / tree.height >= 0.038), true);
    assert.equal(
      trees.every(tree => (
        tree.renderedTrunkHeight >= tree.trunkHeight + (tree.height - tree.trunkHeight) * 0.28
      )),
      true,
    );
    assert.equal(FOREST_CANOPY_LOBE_COUNT, 3);
    assert.equal(FOREST_BRANCH_COUNT, 2);
    const foliageColors = FOREST_PALETTE.broadleaf;
    assert.equal(foliageColors.every(color => ((color >> 8) & 0xff) >= 0x78), true);
    assert.throws(() => getForestBoundaryTreeSpecs({ terrainLimit: -1 }), /positive number/);
    assert.throws(
      () => getForestBoundaryTreeSpecs({ terrainLimit, heightLimit: 0 }),
      /positive number/,
    );
  });

  it('scatters a dense mix of short five-color flowers across the walkable area', () => {
    assert.equal(getProceduralFlowerCount({ width: 375 }), 252);
    assert.equal(getProceduralFlowerCount({ width: 1440 }), 468);

    const options = { count: 96, walkableSize: 9.9, baseHeight: 0.006, seed: 24 };
    const first = createProceduralFlowerLayout(options);
    const second = createProceduralFlowerLayout(options);

    assert.deepEqual(first, second);
    assert.equal(first.length, 96);
    assert.deepEqual(new Set(first.map(flower => flower.color)), new Set(FLOWER_COLORS));
    assert.deepEqual(FLOWER_COLORS, ['yellow', 'red', 'white', 'blue', 'purple']);
    assert.equal(first.every(flower => Math.abs(flower.x) <= 4.55), true);
    assert.equal(first.every(flower => Math.abs(flower.z) <= 4.55), true);
    assert.equal(
      first.some(flower => Math.hypot(flower.x, flower.z) < options.walkableSize * 0.12),
      true,
    );
    assert.equal(first.every(flower => flower.height >= 0.052 && flower.height <= 0.105), true);
    assert.equal(first.every(flower => flower.y === 0.006), true);
  });

  it('uses irregular painted canopy shells and visible branches instead of geometric crowns', () => {
    const source = readFileSync(new URL('../terrain-prototype/procedural-trees.js', import.meta.url), 'utf8');

    assert.doesNotMatch(source, /IcosahedronGeometry|SphereGeometry|LatheGeometry|ConeGeometry/);
    assert.doesNotMatch(source, /forest-understory/);
    assert.match(source, /new THREE\.BufferGeometry/);
    assert.match(source, /forest-watercolor-canopies/);
    assert.match(source, /forest-branches/);
    assert.match(source, /spec\.renderedTrunkHeight/);
    assert.match(source, /CylinderGeometry/);
    assert.match(source, /vertexColors: true/);
    assert.match(source, /flatShading: true/);
  });
});
