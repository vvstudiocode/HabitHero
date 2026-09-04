import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TIDEGLOW_ARCHIPELAGO_MAX_STEP_HEIGHT,
  TIDEGLOW_ARCHIPELAGO_SURFACE_TRANSITION_WIDTHS,
  TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS,
  canTraverseTideglowSurface,
  getTideglowSurfaceAt,
  smoothTideglowElevation,
} from '../src/features/world/tideglow-archipelago-surfaces';

describe('Tideglow Archipelago surface layers', () => {
  it('keeps the four authored surface levels explicit', () => {
    assert.deepEqual(Object.keys(TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS), [
      'stone-street',
      'grass',
      'beach',
      'ocean',
    ]);
    assert.equal(TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS['stone-street'].elevation, 0.12);
    assert.equal(TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS.grass.elevation, 0);
    assert.equal(TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS.ocean.walkable, false);
    assert.equal(TIDEGLOW_ARCHIPELAGO_MAX_STEP_HEIGHT, 0.16);
    assert.deepEqual(TIDEGLOW_ARCHIPELAGO_SURFACE_TRANSITION_WIDTHS, {
      street: 0.42,
      grass: 0.6,
      beach: 0.38,
      water: 0.28,
    });
  });

  it('classifies the authored street, grass, beach, and ocean areas', () => {
    assert.equal(getTideglowSurfaceAt(0, 0).kind, 'stone-street');
    assert.equal(getTideglowSurfaceAt(-1, 2).kind, 'grass');
    assert.equal(getTideglowSurfaceAt(5.8, 0).kind, 'beach');
    assert.equal(getTideglowSurfaceAt(6.35, 0).kind, 'ocean');
    assert.equal(getTideglowSurfaceAt(0.5, -2.2).walkable, false);
    // The boat-side area must stay on its authored beach level; it must not
    // inherit the old invisible stone approach beneath the boat.
    assert.equal(getTideglowSurfaceAt(2.58, 2.5).kind, 'grass');
    const boatApproach = getTideglowSurfaceAt(3.82, 4.56);
    assert.equal(boatApproach.kind, 'beach');
    assert.ok(boatApproach.elevation < TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS['stone-street'].elevation);
  });

  it('ramps elevation across each layer boundary instead of jumping', () => {
    const streetToGrass = getTideglowSurfaceAt(0, 0.75);
    const grassToBeach = getTideglowSurfaceAt(4.1, -0.25);
    const beachToOcean = getTideglowSurfaceAt(6.05, 0);

    assert.equal(streetToGrass.kind, 'grass');
    assert.ok(streetToGrass.elevation > 0);
    assert.ok(streetToGrass.elevation < TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS['stone-street'].elevation);
    assert.equal(grassToBeach.kind, 'grass');
    assert.ok(grassToBeach.elevation < TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS.grass.elevation);
    assert.ok(grassToBeach.elevation > TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS.beach.elevation);
    assert.equal(beachToOcean.kind, 'beach');
    assert.ok(beachToOcean.elevation < TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS.beach.elevation);
    assert.ok(beachToOcean.elevation > TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS.ocean.elevation);
    assert.equal(getTideglowSurfaceAt(8, 0).elevation, TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS.ocean.elevation);
  });

  it('allows adjacent land layers but blocks ocean and oversized height jumps', () => {
    const street = getTideglowSurfaceAt(0, 0);
    const grass = getTideglowSurfaceAt(-1, 2);
    const beach = getTideglowSurfaceAt(5.8, 0);
    const ocean = getTideglowSurfaceAt(6.35, 0);
    const streetToGrass = getTideglowSurfaceAt(0, 0.75);

    assert.equal(canTraverseTideglowSurface(grass, street), true);
    assert.equal(canTraverseTideglowSurface(grass, beach), true);
    assert.equal(canTraverseTideglowSurface(street, streetToGrass), true);
    assert.equal(canTraverseTideglowSurface(street, beach), false);
    assert.equal(canTraverseTideglowSurface(beach, ocean), false);
  });

  it('smooths the character elevation over time', () => {
    const next = smoothTideglowElevation(0.08, 0, 1 / 60);

    assert.ok(next > 0);
    assert.ok(next < 0.08);
    assert.equal(smoothTideglowElevation(0.08, 0, 0), 0.08);
    assert.ok(Math.abs(smoothTideglowElevation(0.08, 0, 1) - 0) < 0.001);
  });
});
