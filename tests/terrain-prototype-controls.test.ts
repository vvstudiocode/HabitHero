import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applySinglePointerCameraDrag,
  getGroundedCameraTargetHeight,
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

  it('keeps upward drag at 90 degrees and uses downward drag to ground the view', () => {
    const upward = applySinglePointerCameraDrag(
      { yaw: 0, pitch: 1.4, grounding: 0 },
      { dx: 0, dy: -1000 },
      { pitchMin: 0.12, pitchMax: Math.PI / 2 },
    );
    const downward = applySinglePointerCameraDrag(
      { yaw: 0, pitch: Math.PI / 2, grounding: 0 },
      { dx: 0, dy: 1000 },
      { pitchMin: 0.12, pitchMax: Math.PI / 2 },
    );
    const returnUp = applySinglePointerCameraDrag(
      { yaw: 0, pitch: Math.PI / 2, grounding: 1 },
      { dx: 0, dy: -1000 },
      { pitchMin: 0.12, pitchMax: Math.PI / 2 },
    );

    assert.equal(upward.pitch, Math.PI / 2);
    assert.equal(downward.pitch, Math.PI / 2);
    assert.equal(downward.grounding, 1);
    assert.equal(returnUp.pitch, Math.PI / 2);
    assert.equal(returnUp.grounding, 0);
  });

  it('moves the look target toward the ground as the camera reaches its downward limit', () => {
    const targetHeight = getGroundedCameraTargetHeight({
      grounding: 1,
      normalHeight: 0.5,
      groundHeight: 0.04,
    });
    const topTargetHeight = getGroundedCameraTargetHeight({
      grounding: 0,
      normalHeight: 0.5,
      groundHeight: 0.04,
    });

    assert.ok(Math.abs(targetHeight - 0.04) < Number.EPSILON);
    assert.ok(Math.abs(topTargetHeight - 0.5) < Number.EPSILON);
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
