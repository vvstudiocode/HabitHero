import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BUTTERFLY_PALETTE,
  createButterflyLayout,
  getButterflyFlightBounds,
} from '../terrain-prototype/natural-world-creatures.js';
import {
  BOUNDARY_SCENERY_TYPES,
  createBoundarySceneryLayout,
} from '../terrain-prototype/natural-boundary-scenery.js';
import {
  EAST_FAIRYTALE_SCENERY_TYPES,
  EAST_FLOWER_COLORS,
  createEastFairytaleLayout,
  createWindmillBladeLayout,
} from '../terrain-prototype/east-fairytale-scenery.js';
import { getNaturalWorldVisualSettings } from '../terrain-prototype/natural-world-visuals.js';

describe('natural afternoon scenery', () => {
  it('keeps the afternoon pass warm and restrained instead of overexposing the scene', () => {
    const high = getNaturalWorldVisualSettings('high');

    assert.equal(high.sunColor, 0xffd4b2);
    assert.equal(high.sunlightPatchColor, 0xffc4a0);
    assert.equal(high.sunlightPatchOpacity < 0.1, true);
    assert.equal(high.environmentIntensity < 0.3, true);
    assert.equal(high.hemisphereIntensity < 1.8, true);
    assert.equal(high.butterflyCount >= 3 && high.butterflyCount <= 5, true);
  });

  it('creates deterministic, colorful butterflies inside the big-tree flight area', () => {
    const options = {
      count: 5,
      center: { x: 0, z: -0.55 },
      radius: 1.8,
      minHeight: 1.25,
      maxHeight: 2.55,
      seed: 42,
    };
    const first = createButterflyLayout(options);
    const second = createButterflyLayout(options);

    assert.deepEqual(first, second);
    assert.equal(first.length, 5);
    assert.equal(first.every((butterfly) => butterfly.y >= 1.25 && butterfly.y <= 2.55), true);
    assert.equal(first.every((butterfly) => Math.hypot(butterfly.x, butterfly.z + 0.55) <= 1.8), true);
    assert.equal(first.every((butterfly) => BUTTERFLY_PALETTE.includes(butterfly.color)), true);
    assert.equal(first.every((butterfly) => butterfly.wingSpan >= 0.82 && butterfly.wingSpan <= 1.08), true);
    assert.equal(first.every((butterfly) => butterfly.flapRate >= 7 && butterfly.flapRate <= 10), true);
    assert.equal(new Set(first.map((butterfly) => butterfly.color)).size >= 3, true);
  });

  it('keeps the butterfly count while distributing the flight ring around all sides', () => {
    const layout = createButterflyLayout({ count: 5, center: { x: 0, z: 0 }, radius: 3, seed: 42 });
    const quadrants = new Set(layout.map((butterfly) => `${Math.sign(butterfly.x)}:${Math.sign(butterfly.z)}`));

    assert.equal(layout.length, 5);
    assert.equal(quadrants.size, 4);
    assert.equal(layout.every((butterfly) => {
      const distance = Math.hypot(butterfly.x, butterfly.z);
      return distance >= 3 * 0.72 && distance <= 3;
    }), true);
    assert.equal(layout.some((butterfly) => butterfly.x < 0), true);
    assert.equal(layout.some((butterfly) => butterfly.x > 0), true);
    assert.equal(layout.some((butterfly) => butterfly.z < 0), true);
    assert.equal(layout.some((butterfly) => butterfly.z > 0), true);
  });

  it('keeps the expanded butterfly ring around the requested three-unit radius', () => {
    const bounds = getButterflyFlightBounds({ treeFootprintRadius: 3.96, maxRadius: 3 });
    const layout = createButterflyLayout({
      count: 5,
      center: { x: 1.1, z: -8.9 },
      minRadius: bounds.minRadius,
      radius: bounds.maxRadius,
      seed: 42,
    });

    assert.equal(bounds.minRadius, 2.4);
    assert.equal(bounds.maxRadius, 3);
    assert.equal(layout.every((butterfly) => {
      const distance = Math.hypot(butterfly.x - 1.1, butterfly.z + 8.9);
      return distance >= bounds.minRadius && distance <= bounds.maxRadius;
    }), true);
  });

  it('builds a layered boundary transition without turning the air wall into a tree fence', () => {
    const scenery = createBoundarySceneryLayout({ boundary: 4.8, quality: 'high', seed: 24 });
    const types = new Set(scenery.map((item) => item.type));

    assert.deepEqual([...types].sort(), [...BOUNDARY_SCENERY_TYPES].sort());
    assert.equal(scenery.filter((item) => item.type === 'stone').length >= 8, true);
    assert.equal(scenery.filter((item) => item.type === 'shrub').length >= 6, true);
    assert.equal(scenery.filter((item) => item.type === 'log').length >= 2, true);
    assert.equal(scenery.some((item) => ['distant-hill', 'distant-tree', 'showcase-tree'].includes(item.type)), false);
    assert.equal(scenery.every((item) => (
      Math.max(Math.abs(item.x), Math.abs(item.z)) <= 4.8
    )), true);
  });

  it('keeps the first directional horizon pass limited to an east castle, windmill and five-color flower field', () => {
    const first = createEastFairytaleLayout({ quality: 'high', seed: 24 });
    const second = createEastFairytaleLayout({ quality: 'high', seed: 24 });
    const types = new Set(first.map((item) => item.type));
    const flowers = first.filter((item) => item.type === 'flower');

    assert.deepEqual(first, second);
    assert.deepEqual([...types].sort(), [...EAST_FAIRYTALE_SCENERY_TYPES].sort());
    assert.equal(first.filter((item) => item.type === 'castle').length, 1);
    assert.equal(first.filter((item) => item.type === 'windmill').length, 1);
    assert.equal(first.find((item) => item.type === 'castle')?.scale, 2);
    assert.equal(first.find((item) => item.type === 'castle')?.x >= 12.5, true);
    assert.equal(first.find((item) => item.type === 'windmill')?.rotationSpeed > 0, true);
    assert.equal(first.find((item) => item.type === 'windmill')?.z <= -2.8, true);
    assert.equal(flowers.length, 34);
    assert.equal(flowers.every((flower) => flower.x >= 8.35 && flower.x <= 11.5), true);
    assert.equal(flowers.every((flower) => flower.z >= -3.15 && flower.z <= 3.15), true);
    assert.equal(flowers.every((flower) => EAST_FLOWER_COLORS.includes(flower.color)), true);
  });

  it('places four windmill blades radially around the hub instead of stacking them on one point', () => {
    const blades = createWindmillBladeLayout({ count: 4, bladeLength: 1.15, startAngle: 0 });

    assert.equal(blades.length, 4);
    assert.equal(blades.every((blade) => Math.hypot(blade.y, blade.z) === 1.15 / 2), true);
    assert.deepEqual(blades.map((blade) => [Number(blade.y.toFixed(3)), Number(blade.z.toFixed(3))]), [
      [0.575, 0],
      [0, 0.575],
      [-0.575, 0],
      [0, -0.575],
    ]);
  });
});
