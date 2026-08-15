import type { WorldInputState } from './world-input-types';

export type JoystickOverlayPosition =
  | { mode: 'center' }
  | { mode: 'dynamic'; x: number; y: number };

export function getJoystickOverlayPosition(input: WorldInputState): JoystickOverlayPosition {
  if (input.joystickPointerId !== null && input.joystickOrigin) {
    return {
      mode: 'dynamic',
      x: input.joystickOrigin.x,
      y: input.joystickOrigin.y,
    };
  }
  return { mode: 'center' };
}
