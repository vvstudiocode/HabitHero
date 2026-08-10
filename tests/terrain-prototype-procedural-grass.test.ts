import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  GRASS_WIND_STRENGTH,
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

describe('terrain prototype procedural grass', () => {
  it('uses a several-times denser but device-aware blade budget', () => {
    assert.equal(getProceduralGrassCount({ width: 375, pixelRatio: 3 }), 43200);
    assert.equal(getProceduralGrassCount({ width: 768, pixelRatio: 2 }), 75600);
    assert.equal(getProceduralGrassCount({ width: 1440, pixelRatio: 2 }), 129600);
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

    assert.deepEqual(first, second);
    assert.equal(first.length, 320);
    assert.equal(first.every(blade => Math.abs(blade.x) <= 9 && Math.abs(blade.z) <= 9), true);
    assert.equal(first.every(blade => blade.y === 0.02), true);
    assert.equal(first.every(blade => blade.width >= 0.01 && blade.width <= 0.028), true);
    assert.equal(first.every(blade => blade.height >= 0.065 && blade.height <= 0.175), true);
    assert.equal(first.filter(blade => Math.abs(blade.x) <= 4 && Math.abs(blade.z) <= 4).length >= 260, true);
    assert.equal(first.filter(blade => Math.abs(blade.x) > 4 || Math.abs(blade.z) > 4).length >= 38, true);
    const innerCount = first.filter(blade => Math.abs(blade.x) <= 4 && Math.abs(blade.z) <= 4).length;
    const outerCount = first.length - innerCount;
    const quintupledInnerCount = outerQuintupled.filter(
      blade => Math.abs(blade.x) <= 4 && Math.abs(blade.z) <= 4,
    ).length;
    assert.deepEqual(outerQuintupled.slice(0, first.length), first);
    assert.equal(quintupledInnerCount, innerCount);
    assert.equal(outerQuintupled.length - quintupledInnerCount, outerCount * 5);
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

  it('keeps wind fixed at 100 percent and reserves a second interactor for a pet', () => {
    assert.equal(GRASS_WIND_STRENGTH, 1.4);
    assert.equal(MAX_GRASS_INTERACTORS, 2);
  });

  it('integrates the procedural meadow scenery into the original prototype', () => {
    const source = readFileSync(new URL('../terrain-prototype/index.html', import.meta.url), 'utf8');

    assert.match(source, /createProceduralGrassField/);
    assert.match(source, /updateGrassInteractionState/);
    assert.match(source, /proceduralGrass\?\.update/);
    assert.match(source, /proceduralGrass\.ground/);
    assert.match(source, /createProceduralForest/);
    assert.match(source, /createProceduralFlowerField/);
    assert.match(source, /centralTreeHeight \* 0\.5/);
    assert.match(source, /new THREE\.Fog\(skyboxHorizon, 9, 23\)/);
    assert.match(source, /new THREE\.DirectionalLight\(0xffdda0, 3\.2\)/);
    assert.match(source, /outerDensityMultiplier: 5/);
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

  it('scatters a restrained mix of short yellow, red, white, and blue flowers', () => {
    assert.equal(getProceduralFlowerCount({ width: 375 }), 84);
    assert.equal(getProceduralFlowerCount({ width: 1440 }), 156);

    const options = { count: 96, walkableSize: 9.9, baseHeight: 0.006, seed: 24 };
    const first = createProceduralFlowerLayout(options);
    const second = createProceduralFlowerLayout(options);

    assert.deepEqual(first, second);
    assert.equal(first.length, 96);
    assert.deepEqual(new Set(first.map(flower => flower.color)), new Set(FLOWER_COLORS));
    assert.equal(first.every(flower => Math.abs(flower.x) <= 4.55), true);
    assert.equal(first.every(flower => Math.abs(flower.z) <= 4.55), true);
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
  });
});
