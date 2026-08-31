import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  createWorldFrameRateState,
  getWorldPixelRatio,
  shouldRenderWorldFrame,
  updateWorldFrameRateState,
} from '../src/features/world/world-performance';

const joystickSource = readFileSync(
  new URL('../src/features/world/components/DynamicJoystick.tsx', import.meta.url),
  'utf8',
);
const joystickStyles = readFileSync(
  new URL('../src/styles/world-controls.css', import.meta.url),
  'utf8',
);

describe('world touch controls and rendering budget', () => {
  it('keeps a fixed touch joystick guide visible without making it interactive', () => {
    assert.match(joystickSource, /hh-world-joystick--fixed/);
    assert.match(joystickStyles, /pointer-events:\s*none/);
    assert.match(joystickStyles, /@media \(hover: none\) and \(pointer: coarse\)/);
    assert.match(joystickStyles, /top: calc\(100% - max\(/);
    assert.match(joystickStyles, /env\(safe-area-inset-bottom/);
  });

  it('caps high-DPR phone rendering before it multiplies the 3D canvas cost', () => {
    assert.equal(getWorldPixelRatio({ devicePixelRatio: 3, viewportWidth: 390, maxPixelRatio: 1.5 }), 1.25);
    assert.equal(getWorldPixelRatio({ devicePixelRatio: 2, viewportWidth: 390, maxPixelRatio: 1.5 }), 1.25);
    assert.equal(getWorldPixelRatio({ devicePixelRatio: 2, viewportWidth: 900, maxPixelRatio: 1.5 }), 1.5);
    assert.equal(getWorldPixelRatio({ devicePixelRatio: 1, viewportWidth: 390, maxPixelRatio: 1.5 }), 1);
  });

  it('limits a 120Hz display to a stable 60fps render cadence', () => {
    assert.equal(shouldRenderWorldFrame({ now: 8, lastRenderedAt: 0, maxFps: 60 }), false);
    assert.equal(shouldRenderWorldFrame({ now: 16.67, lastRenderedAt: 0, maxFps: 60 }), true);
    assert.equal(shouldRenderWorldFrame({ now: 16, lastRenderedAt: 0, maxFps: 60 }), false);
  });

  it('keeps active scenes at 60fps and enters 30fps only after the idle grace period', () => {
    const idleActivity = {
      playerMoving: false,
      petMoving: false,
      cameraMoving: false,
      roamingCharacterMoving: false,
      interactionActive: false,
    };
    let state = createWorldFrameRateState(100);

    state = updateWorldFrameRateState({ now: 500, state, activity: idleActivity });
    assert.equal(state.maxFps, 60);
    state = updateWorldFrameRateState({ now: 849, state, activity: idleActivity });
    assert.equal(state.maxFps, 60);
    state = updateWorldFrameRateState({ now: 850, state, activity: idleActivity });
    assert.equal(state.maxFps, 30);

    state = updateWorldFrameRateState({
      now: 851,
      state,
      activity: { ...idleActivity, petMoving: true },
    });
    assert.equal(state.maxFps, 60);
    assert.equal(state.lastActiveAt, 851);

    state = updateWorldFrameRateState({ now: 1500, state, activity: idleActivity });
    assert.equal(state.maxFps, 60);
    state = updateWorldFrameRateState({ now: 1601, state, activity: idleActivity });
    assert.equal(state.maxFps, 30);
  });
});
