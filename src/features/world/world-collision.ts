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
export const CHARACTER_SPAWN = { x: 0, z: 2.2, radius: 0.8 };
export const CENTRAL_TREE_KEEP_OUT = { x: 0, z: 0, radius: 1.15 };
export const WORLD_EPSILON = 0.02;
export const CHARACTER_COLLISION_RADIUS = 0.35;

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
): boolean {
  if (!Number.isFinite(transform.x) || !Number.isFinite(transform.y) || !Number.isFinite(transform.z)) return false;
  if (!Number.isFinite(transform.scale) || transform.scale < 0.25 || transform.scale > 3) return false;
  if ([transform.rotationX, transform.rotationY, transform.rotationZ].some((value) => !Number.isFinite(value))) return false;
  const radius = collisionRadius * transform.scale;
  const circle = { x: transform.x, z: transform.z, radius };
  if (Math.abs(transform.x) + radius > WORLD_BOUNDARY || Math.abs(transform.z) + radius > WORLD_BOUNDARY) return false;
  if (circlesOverlap(circle, CHARACTER_SPAWN) || circlesOverlap(circle, CENTRAL_TREE_KEEP_OUT)) return false;
  return existing.every((other) => !circlesOverlap(circle, other));
}

export function buildCollisionCircles(
  entities: Array<{ positionX: number; positionZ: number; collisionRadius: number; scale: number }>,
): CollisionCircle[] {
  return entities.map((entity) => ({
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
    ...decorations,
  ];
  let next = { x: clampWorldPosition(current.x, radius), z: clampWorldPosition(current.z, radius) };
  const xCandidate = { x: clampWorldPosition(desired.x, radius), z: next.z };
  if (!obstacles.some((obstacle) => positionOverlapsObstacle(xCandidate, obstacle, radius))) next.x = xCandidate.x;
  const zCandidate = { x: next.x, z: clampWorldPosition(desired.z, radius) };
  if (!obstacles.some((obstacle) => positionOverlapsObstacle(zCandidate, obstacle, radius))) next.z = zCandidate.z;
  return next;
}
