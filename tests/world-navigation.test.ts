import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createInitialWorldNavigationState,
  resolveWorldNavigationTransition,
} from '../src/features/world/world-navigation';

describe('world navigation memory', () => {
  it('remembers the public world and exact position before entering my world', () => {
    const transition = resolveWorldNavigationTransition({
      currentLocation: 'forest-valley',
      requestedLocation: 'my-world',
      currentPosition: { x: -0.42, z: 3.18 },
      returnTarget: createInitialWorldNavigationState().returnTarget,
    });

    assert.deepEqual(transition, {
      nextLocation: 'my-world',
      entryPosition: undefined,
      returnTarget: {
        location: 'forest-valley',
        position: { x: -0.42, z: 3.18 },
      },
    });
  });

  it('returns from my world to the remembered public world position', () => {
    const transition = resolveWorldNavigationTransition({
      currentLocation: 'my-world',
      requestedLocation: 'sunrise-village',
      returnTarget: {
        location: 'forest-valley',
        position: { x: -0.42, z: 3.18 },
      },
      entryPositions: {
        'sunrise-village': { x: -9.67, z: 5.15 },
      },
    });

    assert.deepEqual(transition, {
      nextLocation: 'forest-valley',
      entryPosition: { x: -0.42, z: 3.18 },
      returnTarget: null,
    });
  });

  it('uses the destination gate entry when no previous public position exists', () => {
    const entryPosition = { x: -9.67, z: 5.15 };
    const transition = resolveWorldNavigationTransition({
      currentLocation: 'my-world',
      requestedLocation: 'sunrise-village',
      returnTarget: null,
      entryPositions: { 'sunrise-village': entryPosition },
    });

    assert.deepEqual(transition, {
      nextLocation: 'sunrise-village',
      entryPosition,
      returnTarget: null,
    });
  });

  it('uses a public destination entry when crossing directly between public worlds', () => {
    const entryPosition = { x: -9.67, z: 5.15 };
    const transition = resolveWorldNavigationTransition({
      currentLocation: 'forest-valley',
      requestedLocation: 'sunrise-village',
      currentPosition: { x: -0.2, z: 3.7 },
      returnTarget: null,
      entryPositions: { 'sunrise-village': entryPosition },
      entryFacings: { 'sunrise-village': Math.PI },
    });

    assert.deepEqual(transition, {
      nextLocation: 'sunrise-village',
      entryPosition,
      entryFacingY: Math.PI,
      returnTarget: null,
    });
  });

  it('returns from Cloud Workshop to the Cloud Workshop entrance in Sunrise Village', () => {
    const cloudWorkshopEntrance = { x: 11, z: -0.85 };
    const transition = resolveWorldNavigationTransition({
      currentLocation: 'cloud-workshop',
      requestedLocation: 'sunrise-village',
      currentPosition: { x: 0, z: 0 },
      returnTarget: null,
      entryPositions: { 'sunrise-village': { x: -8.9, z: 5.5 } },
      entryPositionsBySource: {
        'cloud-workshop': { 'sunrise-village': cloudWorkshopEntrance },
      },
    });

    assert.deepEqual(transition, {
      nextLocation: 'sunrise-village',
      entryPosition: cloudWorkshopEntrance,
      returnTarget: null,
    });
  });

  it('passes the destination-facing direction when entering Forest Valley through the gate', () => {
    const transition = resolveWorldNavigationTransition({
      currentLocation: 'sunrise-village',
      requestedLocation: 'forest-valley',
      currentPosition: { x: -9.67, z: 3.9 },
      returnTarget: null,
      entryFacings: { 'forest-valley': Math.PI },
      entryCameraYaws: { 'forest-valley': 0 },
    });

    assert.deepEqual(transition, {
      nextLocation: 'forest-valley',
      entryPosition: undefined,
      entryFacingY: Math.PI,
      entryCameraYaw: 0,
      returnTarget: null,
    });
  });

  it('enters Cloud Workshop through its authored dock position', () => {
    const transition = resolveWorldNavigationTransition({
      currentLocation: 'sunrise-village',
      requestedLocation: 'cloud-workshop',
      currentPosition: { x: -5.8, z: 7.6 },
      returnTarget: null,
      entryPositions: { 'cloud-workshop': { x: -9.5587374, z: -0.1183422 } },
      entryFacings: { 'cloud-workshop': Math.PI },
      entryCameraYaws: { 'cloud-workshop': 0 },
    });

    assert.deepEqual(transition, {
      nextLocation: 'cloud-workshop',
      entryPosition: { x: -9.5587374, z: -0.1183422 },
      entryFacingY: Math.PI,
      entryCameraYaw: 0,
      returnTarget: null,
    });
  });

  it('does not store invalid player coordinates', () => {
    const transition = resolveWorldNavigationTransition({
      currentLocation: 'sunrise-village',
      requestedLocation: 'my-world',
      currentPosition: { x: Number.NaN, z: 1 },
      returnTarget: null,
    });

    assert.deepEqual(transition, {
      nextLocation: 'my-world',
      entryPosition: undefined,
      returnTarget: null,
    });
  });
});
