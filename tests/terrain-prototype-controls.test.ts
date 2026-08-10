import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applySinglePointerCameraDrag,
  getPinchCameraDistance,
} from '../terrain-prototype/terrain-controls.js';

describe('terrain prototype camera touch controls', () => {
  it('uses a single finger to change yaw and pitch without changing zoom distance', () => {
    const next = applySinglePointerCameraDrag(
      { yaw: 0.4, pitch: 0.5 },
      { dx: 20, dy: -40 },
      { pitchMin: 0.12, pitchMax: 1.16 },
    );

    assert.ok(Math.abs(next.yaw - 0.24) < Number.EPSILON);
    assert.ok(Math.abs(next.pitch - 0.74) < Number.EPSILON);
    assert.equal('distance' in next, false);
  });

  it('reaches the full 90-degree downward pitch', () => {
    const next = applySinglePointerCameraDrag(
      { yaw: 0, pitch: 1.4 },
      { dx: 0, dy: -1000 },
      { pitchMin: 0.12, pitchMax: Math.PI / 2 },
    );

    assert.equal(next.pitch, Math.PI / 2);
  });

  it('clamps pinch zoom to the supported camera distance range', () => {
    assert.equal(getPinchCameraDistance({
      startDistance: 100,
      startCameraDistance: 4.1,
      currentDistance: 200,
      minDistance: 1.45,
      maxDistance: 6.5,
    }), 2.05);

    assert.equal(getPinchCameraDistance({
      startDistance: 100,
      startCameraDistance: 4.1,
      currentDistance: 1000,
      minDistance: 1.45,
      maxDistance: 6.5,
    }), 1.45);

    assert.equal(getPinchCameraDistance({
      startDistance: 100,
      startCameraDistance: 4.1,
      currentDistance: 10,
      minDistance: 1.45,
      maxDistance: 6.5,
    }), 6.5);
  });
});
