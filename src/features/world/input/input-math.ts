import { JOYSTICK_DEAD_ZONE, JOYSTICK_RADIUS, type JoystickVector, type WorldPoint } from './world-input-types';

export function getDistance(first: WorldPoint, second: WorldPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function getCenter(first: WorldPoint, second: WorldPoint): WorldPoint {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

export function getJoystickVector(
  origin: WorldPoint,
  point: WorldPoint,
  radius = JOYSTICK_RADIUS,
  deadZone = JOYSTICK_DEAD_ZONE,
): JoystickVector {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= deadZone) return { x: 0, y: 0, strength: 0 };

  const limitedDistance = Math.min(distance, radius);
  const strength = Math.min(1, (limitedDistance - deadZone) / Math.max(radius - deadZone, 1));
  return {
    x: (dx / Math.max(distance, 1)) * strength,
    y: (dy / Math.max(distance, 1)) * strength,
    strength,
  };
}

export function clampCameraPitch(pitch: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, pitch));
}
