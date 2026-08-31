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

export interface WorldMovementHitCircle {
  center: WorldPoint;
  radius: number;
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
export const JOYSTICK_TOUCH_PADDING = 20;
export const JOYSTICK_TOUCH_RADIUS = JOYSTICK_RADIUS + JOYSTICK_TOUCH_PADDING;
export const JOYSTICK_DEAD_ZONE = 10;
export const WORLD_CONTROL_BAND_RATIO = 0.25;
export const LANDSCAPE_MOVEMENT_BAND_RATIO = 0.34;

export function getWorldInputZone(
  point: WorldPoint,
  viewportHeight: number,
  viewportWidth = 0,
  landscapeMovementCircle?: WorldMovementHitCircle,
): WorldInputZone {
  const isLandscape = viewportWidth > viewportHeight && viewportHeight > 0;
  if (isLandscape && landscapeMovementCircle) {
    const distanceFromJoystick = Math.hypot(
      point.x - landscapeMovementCircle.center.x,
      point.y - landscapeMovementCircle.center.y,
    );
    return distanceFromJoystick <= landscapeMovementCircle.radius ? 'movement' : 'camera';
  }
  const movementBandRatio = isLandscape ? LANDSCAPE_MOVEMENT_BAND_RATIO : WORLD_CONTROL_BAND_RATIO;
  const inMovementBand = point.y >= viewportHeight * (1 - movementBandRatio);
  const inLandscapeLeftBand = viewportWidth > 0 && point.x <= viewportWidth * LANDSCAPE_MOVEMENT_BAND_RATIO;
  return inMovementBand && (!isLandscape || inLandscapeLeftBand)
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
