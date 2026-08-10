export type WorldInputMode =
  | 'idle'
  | 'joystick'
  | 'camera-mouse'
  | 'camera-single'
  | 'joystick-camera'
  | 'camera-pinch'
  | 'joystick-camera-pinch'
  | 'await-all-released';

export type WorldInputZone = 'movement' | 'camera';
export type WorldPointerRole = WorldInputZone | 'ignored';

export type WorldPointerType = 'mouse' | 'touch' | 'pen';

export interface WorldPoint {
  x: number;
  y: number;
}

export interface JoystickVector {
  x: number;
  y: number;
  strength: number;
}

export interface WorldInputState {
  mode: WorldInputMode;
  pointers: Record<string, WorldPoint>;
  pointerRoles: Record<string, WorldPointerRole>;
  joystickPointerId: number | null;
  joystickOrigin: WorldPoint | null;
  joystick: JoystickVector;
  cameraPreviousCenter: WorldPoint | null;
  cameraPreviousDistance: number | null;
  cameraDelta: WorldPoint;
  zoomDelta: number;
}

export type WorldInputEvent =
  | { type: 'pointer-down'; pointerId: number; pointerType?: WorldPointerType; point: WorldPoint; zone?: WorldInputZone }
  | { type: 'pointer-move'; pointerId: number; point: WorldPoint }
  | { type: 'pointer-up'; pointerId: number }
  | { type: 'pointer-cancel'; pointerId: number }
  | { type: 'reset' }
  | { type: 'clear-camera-delta' };

export const JOYSTICK_RADIUS = 56;
export const JOYSTICK_DEAD_ZONE = 10;
export const WORLD_CONTROL_BAND_RATIO = 0.25;

export function getWorldInputZone(point: WorldPoint, viewportHeight: number): WorldInputZone {
  return viewportHeight > 0 && point.y >= viewportHeight * (1 - WORLD_CONTROL_BAND_RATIO)
    ? 'movement'
    : 'camera';
}

export const createInitialWorldInputState = (): WorldInputState => ({
  mode: 'idle',
  pointers: {},
  pointerRoles: {},
  joystickPointerId: null,
  joystickOrigin: null,
  joystick: { x: 0, y: 0, strength: 0 },
  cameraPreviousCenter: null,
  cameraPreviousDistance: null,
  cameraDelta: { x: 0, y: 0 },
  zoomDelta: 0,
});
