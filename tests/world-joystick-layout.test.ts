import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getJoystickOverlayPosition } from '../src/features/world/input/joystick-layout';
import { worldInputReducer } from '../src/features/world/input/world-input-reducer';
import { createInitialWorldInputState } from '../src/features/world/input/world-input-types';

const joystickStyles = readFileSync(
  new URL('../src/styles/world-controls.css', import.meta.url),
  'utf8',
);

const touchDown = (pointerId: number, point: { x: number; y: number }) => ({
  type: 'pointer-down' as const,
  pointerId,
  pointerType: 'touch' as const,
  point,
  zone: 'movement' as const,
});

describe('world joystick overlay', () => {
  it('uses a centered guide while idle and the touch origin while moving', () => {
    const idle = getJoystickOverlayPosition(createInitialWorldInputState());
    assert.deepEqual(idle, { mode: 'center' });

    const active = worldInputReducer(
      createInitialWorldInputState(),
      touchDown(4, { x: 76, y: 628 }),
    );
    assert.deepEqual(getJoystickOverlayPosition(active), {
      mode: 'dynamic',
      x: 76,
      y: 628,
    });
  });

  it('keeps both lower sides assigned to movement input', () => {
    const left = worldInputReducer(createInitialWorldInputState(), touchDown(1, { x: 28, y: 640 }));
    const right = worldInputReducer(createInitialWorldInputState(), touchDown(2, { x: 362, y: 640 }));

    assert.equal(left.mode, 'joystick');
    assert.equal(left.joystickOrigin?.x, 28);
    assert.equal(right.mode, 'joystick');
    assert.equal(right.joystickOrigin?.x, 362);
  });

  it('animates back to the centered guide and respects mobile safe-area controls', () => {
    assert.match(joystickStyles, /--hh-joystick-x/);
    assert.match(joystickStyles, /transition:[^;]*(left|top)/);
    assert.match(joystickStyles, /left:\s*50%/);
    assert.match(joystickStyles, /env\(safe-area-inset-bottom/);
  });
});
