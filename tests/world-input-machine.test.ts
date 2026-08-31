import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getKeyboardCameraInput, getKeyboardMovement } from '../src/features/world/input/keyboard-input';
import { worldInputReducer } from '../src/features/world/input/world-input-reducer';
import {
  createInitialWorldInputState,
  getWorldInputZone,
  JOYSTICK_TOUCH_RADIUS,
} from '../src/features/world/input/world-input-types';

const touchDown = (pointerId: number, point: { x: number; y: number }, zone: 'movement' | 'camera') => ({
  type: 'pointer-down' as const,
  pointerId,
  pointerType: 'touch' as const,
  point,
  zone,
});

describe('world input state machine', () => {
  it('classifies the lower quarter as movement and the upper area as camera', () => {
    assert.equal(getWorldInputZone({ x: 140, y: 540 }, 720), 'movement');
    assert.equal(getWorldInputZone({ x: 140, y: 540 }, 800), 'camera');
    assert.equal(getWorldInputZone({ x: 140, y: 120 }, 720), 'camera');
  });

  it('keeps landscape movement controls in the lower-left touch band', () => {
    assert.equal(getWorldInputZone({ x: 120, y: 390 }, 480, 800), 'movement');
    assert.equal(getWorldInputZone({ x: 520, y: 390 }, 480, 800), 'camera');
    assert.equal(getWorldInputZone({ x: 120, y: 180 }, 480, 800), 'camera');
  });

  it('keeps the upper edge of the landscape joystick in the movement band', () => {
    assert.equal(getWorldInputZone({ x: 120, y: 330 }, 480, 800), 'movement');
  });

  it('uses the padded landscape joystick circle instead of a broad movement rectangle', () => {
    const movementCircle = { center: { x: 108, y: 340 }, radius: JOYSTICK_TOUCH_RADIUS };
    assert.equal(getWorldInputZone({ x: 108, y: 265 }, 414, 896, movementCircle), 'movement');
    assert.equal(getWorldInputZone({ x: 190, y: 340 }, 414, 896, movementCircle), 'camera');
  });

  it('starts a dynamic joystick in the lower control quarter and stops on release', () => {
    let state = worldInputReducer(createInitialWorldInputState(), touchDown(4, { x: 140, y: 620 }, 'movement'));
    assert.equal(state.mode, 'joystick');
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 4, point: { x: 196, y: 620 } });
    assert.equal(state.joystick.strength, 1);
    assert.equal(state.joystick.x, 1);
    state = worldInputReducer(state, { type: 'pointer-up', pointerId: 4 });
    assert.equal(state.mode, 'idle');
    assert.deepEqual(state.joystick, { x: 0, y: 0, strength: 0 });
  });

  it('uses one upper-area finger for camera movement without clearing movement', () => {
    let state = worldInputReducer(createInitialWorldInputState(), touchDown(1, { x: 80, y: 620 }, 'movement'));
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 1, point: { x: 110, y: 620 } });
    assert.ok(state.joystick.strength > 0);
    state = worldInputReducer(state, touchDown(2, { x: 280, y: 240 }, 'camera'));
    assert.equal(state.mode, 'joystick-camera');
    assert.ok(state.joystick.strength > 0);
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 2, point: { x: 310, y: 220 } });
    assert.deepEqual(state.cameraDelta, { x: 30, y: -20 });
    assert.ok(state.joystick.strength > 0);
  });

  it('accumulates consecutive camera moves until the camera delta is consumed', () => {
    let state = worldInputReducer(createInitialWorldInputState(), touchDown(1, { x: 100, y: 100 }, 'camera'));
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 1, point: { x: 112, y: 92 } });
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 1, point: { x: 130, y: 80 } });

    assert.deepEqual(state.cameraDelta, { x: 30, y: -20 });

    state = worldInputReducer(state, { type: 'clear-camera-delta' });
    assert.deepEqual(state.cameraDelta, { x: 0, y: 0 });
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 1, point: { x: 135, y: 75 } });
    assert.deepEqual(state.cameraDelta, { x: 5, y: -5 });
  });

  it('uses two upper-area fingers for pinch zoom without rotating the camera', () => {
    let state = worldInputReducer(createInitialWorldInputState(), touchDown(1, { x: 160, y: 220 }, 'camera'));
    state = worldInputReducer(state, touchDown(2, { x: 240, y: 220 }, 'camera'));
    assert.equal(state.mode, 'camera-pinch');
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 2, point: { x: 260, y: 220 } });
    assert.deepEqual(state.cameraDelta, { x: 0, y: 0 });
    assert.equal(state.zoomDelta, 20);
  });

  it('accumulates consecutive pinch moves until zoom is consumed', () => {
    let state = worldInputReducer(createInitialWorldInputState(), touchDown(1, { x: 160, y: 220 }, 'camera'));
    state = worldInputReducer(state, touchDown(2, { x: 240, y: 220 }, 'camera'));
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 2, point: { x: 260, y: 220 } });
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 2, point: { x: 280, y: 220 } });

    assert.equal(state.zoomDelta, 40);

    state = worldInputReducer(state, { type: 'clear-camera-delta' });
    assert.equal(state.zoomDelta, 0);
  });

  it('supports walking while zooming with two upper-area fingers', () => {
    let state = worldInputReducer(createInitialWorldInputState(), touchDown(1, { x: 80, y: 620 }, 'movement'));
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 1, point: { x: 110, y: 620 } });
    state = worldInputReducer(state, touchDown(2, { x: 160, y: 220 }, 'camera'));
    state = worldInputReducer(state, touchDown(3, { x: 240, y: 220 }, 'camera'));
    assert.equal(state.mode, 'joystick-camera-pinch');
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 3, point: { x: 260, y: 220 } });
    assert.equal(state.zoomDelta, 20);
    assert.ok(state.joystick.strength > 0);
  });

  it('keeps walking when the camera finger is released', () => {
    let state = worldInputReducer(createInitialWorldInputState(), touchDown(1, { x: 80, y: 620 }, 'movement'));
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 1, point: { x: 110, y: 620 } });
    state = worldInputReducer(state, touchDown(2, { x: 280, y: 240 }, 'camera'));
    state = worldInputReducer(state, { type: 'pointer-up', pointerId: 2 });
    assert.equal(state.mode, 'joystick');
    assert.ok(state.joystick.strength > 0);
  });

  it('ignores an end event for a pointer that is not part of the active gesture', () => {
    let state = worldInputReducer(createInitialWorldInputState(), touchDown(1, { x: 80, y: 620 }, 'movement'));
    state = worldInputReducer(state, touchDown(2, { x: 280, y: 240 }, 'camera'));
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 2, point: { x: 300, y: 220 } });
    const next = worldInputReducer(state, { type: 'pointer-up', pointerId: 99 });
    assert.deepEqual(next, state);
  });

  it('keeps the remaining camera finger as camera input after a pinch ends', () => {
    let state = worldInputReducer(createInitialWorldInputState(), touchDown(1, { x: 160, y: 220 }, 'camera'));
    state = worldInputReducer(state, touchDown(2, { x: 240, y: 220 }, 'camera'));
    state = worldInputReducer(state, { type: 'pointer-up', pointerId: 1 });
    assert.equal(state.mode, 'camera-single');
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 2, point: { x: 200, y: 180 } });
    assert.deepEqual(state.cameraDelta, { x: -40, y: -40 });
    assert.equal(state.joystick.strength, 0);
    state = worldInputReducer(state, { type: 'pointer-up', pointerId: 2 });
    assert.equal(state.mode, 'idle');
  });

  it('enters the safe wait state when an unsupported fourth finger appears', () => {
    let state = createInitialWorldInputState();
    state = worldInputReducer(state, touchDown(1, { x: 80, y: 620 }, 'movement'));
    state = worldInputReducer(state, touchDown(2, { x: 160, y: 220 }, 'camera'));
    state = worldInputReducer(state, touchDown(3, { x: 240, y: 220 }, 'camera'));
    state = worldInputReducer(state, touchDown(4, { x: 320, y: 220 }, 'camera'));
    assert.equal(state.mode, 'await-all-released');
    assert.deepEqual(state.joystick, { x: 0, y: 0, strength: 0 });
  });

  it('uses a desktop mouse drag for camera movement instead of a joystick', () => {
    let state = worldInputReducer(createInitialWorldInputState(), { type: 'pointer-down', pointerId: 9, pointerType: 'mouse', point: { x: 100, y: 100 }, zone: 'camera' });
    assert.equal(state.mode, 'camera-mouse');
    state = worldInputReducer(state, { type: 'pointer-move', pointerId: 9, point: { x: 130, y: 80 } });
    assert.deepEqual(state.cameraDelta, { x: 30, y: -20 });
    assert.deepEqual(state.joystick, { x: 0, y: 0, strength: 0 });
    state = worldInputReducer(state, { type: 'pointer-up', pointerId: 9 });
    assert.equal(state.mode, 'idle');
  });

  it('keeps the existing movement bindings while exposing camera keyboard bindings', () => {
    const movement = getKeyboardMovement(new Set(['w', 'arrowright']));
    assert.ok(Math.abs(movement.x - Math.SQRT1_2) < Number.EPSILON);
    assert.ok(Math.abs(movement.y - Math.SQRT1_2) < Number.EPSILON);
    assert.deepEqual(getKeyboardCameraInput(new Set(['j', 'k', '+'])), { yaw: 1, pitch: 1, zoom: 1 });
    assert.deepEqual(getKeyboardCameraInput(new Set(['l', 'i', '-'])), { yaw: -1, pitch: -1, zoom: -1 });
  });
});
