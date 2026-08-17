export interface WorldTransform {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale: number;
}

export interface CollisionCircle {
  x: number;
  z: number;
  radius: number;
}

export interface WorldPoint2D {
  x: number;
  z: number;
}

export const WORLD_LAYOUT_VERSION = 1;
export const WORLD_BOUNDARY = 4.8;
// The outer meadow plane is 26.95 units wide (9 walkable tiles plus the
// 8-unit scene padding on each side, with the grass field's 0.98 inset).
// Decorations may use this visible meadow while characters remain inside
// WORLD_BOUNDARY.
export const VISIBLE_GRASS_BOUNDARY = 13.475;
export const CHARACTER_SPAWN = { x: 0, z: 2.2, radius: 0.8 };
// The visual tree is placed from its loaded GLB bounds outside the walkable
// edge. Keep this legacy collision proxy beyond the movement boundary too.
export const CENTRAL_TREE_KEEP_OUT = { x: 1.1, z: -8.9, radius: 2 };
export const WORLD_EPSILON = 0.02;
export const CHARACTER_COLLISION_RADIUS = 0.35;

/**
 * Decorations keep a positive, server-valid catalog radius, but their
 * navigation proxy can be smaller than the full placement footprint. This
 * lets the player approach the visible mesh without walking through it.
 */
export function getDecorationNavigationRadius(
  metadata: Record<string, unknown> | undefined,
  fallbackRadius: number,
): number {
  const configuredRadius = metadata?.navigationRadius;
  if (typeof configuredRadius === 'number' && Number.isFinite(configuredRadius) && configuredRadius > 0) {
    return configuredRadius;
  }
  return Number.isFinite(fallbackRadius) && fallbackRadius > 0 ? fallbackRadius : 0.3;
}

export function clampWorldPosition(value: number, radius: number, boundary = WORLD_BOUNDARY): number {
  return Math.min(boundary - radius, Math.max(-boundary + radius, value));
}

export function circlesOverlap(first: CollisionCircle, second: CollisionCircle, epsilon = WORLD_EPSILON): boolean {
  return Math.hypot(first.x - second.x, first.z - second.z) < first.radius + second.radius + epsilon;
}

export function isTransformWithinWorld(
  transform: WorldTransform,
  collisionRadius: number,
  existing: CollisionCircle[] = [],
  boundary = WORLD_BOUNDARY,
): boolean {
  if (!Number.isFinite(transform.x) || !Number.isFinite(transform.y) || !Number.isFinite(transform.z)) return false;
  if (!Number.isFinite(transform.scale) || transform.scale < 0.1 || transform.scale > 3) return false;
  if ([transform.rotationX, transform.rotationY, transform.rotationZ].some((value) => !Number.isFinite(value))) return false;
  if (!Number.isFinite(collisionRadius) || collisionRadius <= 0) return false;
  if (!Number.isFinite(boundary) || boundary <= 0) return false;
  const radius = collisionRadius * transform.scale;
  const circle = { x: transform.x, z: transform.z, radius };
  if (Math.abs(transform.x) + radius > boundary || Math.abs(transform.z) + radius > boundary) return false;
  if (circlesOverlap(circle, CHARACTER_SPAWN) || circlesOverlap(circle, CENTRAL_TREE_KEEP_OUT)) return false;
  return existing.every((other) => !circlesOverlap(circle, other));
}

export function buildCollisionCircles(
  entities: Array<{ positionX: number; positionZ: number; collisionRadius: number; scale: number }>,
): CollisionCircle[] {
  return entities.filter((entity) => entity.collisionRadius > 0 && entity.scale > 0).map((entity) => ({
    x: entity.positionX,
    z: entity.positionZ,
    radius: entity.collisionRadius * entity.scale,
  }));
}

function positionOverlapsObstacle(position: WorldPoint2D, obstacle: CollisionCircle, radius: number): boolean {
  return circlesOverlap({ ...position, radius }, obstacle);
}

export function moveWorldCharacter(
  current: WorldPoint2D,
  desired: WorldPoint2D,
  radius = CHARACTER_COLLISION_RADIUS,
  decorations: CollisionCircle[] = [],
): WorldPoint2D {
  const obstacles = [
    { x: CENTRAL_TREE_KEEP_OUT.x, z: CENTRAL_TREE_KEEP_OUT.z, radius: CENTRAL_TREE_KEEP_OUT.radius },
    ...decorations.filter((decoration) => decoration.radius > 0),
  ];
  let next = { x: clampWorldPosition(current.x, radius), z: clampWorldPosition(current.z, radius) };
  const xCandidate = { x: clampWorldPosition(desired.x, radius), z: next.z };
  if (!obstacles.some((obstacle) => positionOverlapsObstacle(xCandidate, obstacle, radius))) next.x = xCandidate.x;
  const zCandidate = { x: next.x, z: clampWorldPosition(desired.z, radius) };
  if (!obstacles.some((obstacle) => positionOverlapsObstacle(zCandidate, obstacle, radius))) next.z = zCandidate.z;
  return next;
}
