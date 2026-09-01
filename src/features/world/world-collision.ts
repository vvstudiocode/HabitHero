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
  shape?: CollisionShape;
  rotationY?: number;
  halfWidth?: number;
  halfDepth?: number;
  halfLength?: number;
  capRadius?: number;
  axis?: CollisionAxis;
  navigationInset?: number;
}

export type CollisionShape = 'circle' | 'rectangle' | 'capsule';
export type CollisionAxis = 'x' | 'z';

export interface DecorationCollisionSpec {
  collisionRadius: number;
  collisionShape?: CollisionShape;
  collisionWidth?: number;
  collisionDepth?: number;
  collisionLength?: number;
  collisionAxis?: CollisionAxis;
  navigationInset?: number;
}

export interface CollisionCircleInput {
  positionX: number;
  positionZ: number;
  collisionRadius: number;
  scale: number;
  collisionShape?: CollisionShape;
  collisionWidth?: number;
  collisionDepth?: number;
  collisionLength?: number;
  collisionAxis?: CollisionAxis;
  rotationY?: number;
  navigationInset?: number;
}

export interface WorldPoint2D {
  x: number;
  z: number;
}

export interface RadialWorldBoundary {
  center: WorldPoint2D;
  radii: readonly number[];
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
// Let the character's visual body approach furniture without disabling the
// shape boundary. The center still cannot cross the decoration collider.
export const DEFAULT_DECORATION_NAVIGATION_INSET = 0.25;

/**
 * passThrough decorations keep a positive server radius for placement but
 * add no navigation obstacle; other decorations can use smaller proxies.
 */
export function getDecorationNavigationRadius(
  metadata: Record<string, unknown> | undefined,
  fallbackRadius: number,
): number {
  if (metadata?.passThrough === true) return 0;
  const configuredRadius = metadata?.navigationRadius;
  if (typeof configuredRadius === 'number' && Number.isFinite(configuredRadius) && configuredRadius > 0) {
    return configuredRadius;
  }
  return Number.isFinite(fallbackRadius) && fallbackRadius > 0 ? fallbackRadius : 0.3;
}

function finitePositive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function getDecorationCollisionSpec(
  metadata: Record<string, unknown> | undefined,
  fallbackRadius: number,
): DecorationCollisionSpec {
  const collisionRadius = getDecorationNavigationRadius(metadata, fallbackRadius);
  const navigationInset = finiteNonNegative(metadata?.navigationInset) ?? DEFAULT_DECORATION_NAVIGATION_INSET;
  const shape = metadata?.collisionShape;
  if (shape === 'rectangle') {
    const width = finitePositive(metadata.collisionWidth);
    const depth = finitePositive(metadata.collisionDepth);
    if (width && depth) return { collisionRadius, collisionShape: shape, collisionWidth: width, collisionDepth: depth, navigationInset };
  }
  if (shape === 'capsule') {
    const length = finitePositive(metadata.collisionLength);
    if (length) {
      const axis = metadata.collisionAxis === 'x' || metadata.collisionAxis === 'z' ? metadata.collisionAxis : 'x';
      return { collisionRadius, collisionShape: shape, collisionLength: length, collisionAxis: axis, navigationInset };
    }
  }
  return { collisionRadius, navigationInset };
}

export function clampWorldPosition(value: number, radius: number, boundary = WORLD_BOUNDARY): number {
  return Math.min(boundary - radius, Math.max(-boundary + radius, value));
}

function getRadialBoundaryRadius(boundary: RadialWorldBoundary, angle: number): number {
  const count = boundary.radii.length;
  if (count === 0) return 0;
  const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const sample = normalizedAngle / (Math.PI * 2) * count;
  const lowerIndex = Math.floor(sample) % count;
  const upperIndex = (lowerIndex + 1) % count;
  const fraction = sample - Math.floor(sample);
  const lower = Number.isFinite(boundary.radii[lowerIndex]) ? boundary.radii[lowerIndex] : 0;
  const upper = Number.isFinite(boundary.radii[upperIndex]) ? boundary.radii[upperIndex] : lower;
  return lower + (upper - lower) * fraction;
}

export function clampWorldPointToRadialBoundary(
  point: WorldPoint2D,
  radius: number,
  boundary: RadialWorldBoundary,
  squareBoundary = WORLD_BOUNDARY,
): WorldPoint2D {
  const delta = { x: point.x - boundary.center.x, z: point.z - boundary.center.z };
  const distance = Math.hypot(delta.x, delta.z);
  if (!Number.isFinite(distance) || distance <= 0.0001) return point;
  const maximumDistance = Math.min(getRadialBoundaryRadius(boundary, Math.atan2(delta.z, delta.x)), squareBoundary) - radius;
  if (distance <= maximumDistance) return point;
  const safeDistance = Math.max(0, maximumDistance);
  return {
    x: boundary.center.x + (delta.x / distance) * safeDistance,
    z: boundary.center.z + (delta.z / distance) * safeDistance,
  };
}

function getShape(obstacle: CollisionCircle): CollisionShape {
  return obstacle.shape ?? 'circle';
}

function toLocalPoint(point: WorldPoint2D, obstacle: CollisionCircle): WorldPoint2D {
  const rotationY = obstacle.rotationY ?? 0;
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  const deltaX = point.x - obstacle.x;
  const deltaZ = point.z - obstacle.z;
  return {
    x: cosine * deltaX - sine * deltaZ,
    z: sine * deltaX + cosine * deltaZ,
  };
}

function getRectangleHalfWidth(obstacle: CollisionCircle): number {
  return finitePositive(obstacle.halfWidth) ?? obstacle.radius;
}

function getRectangleHalfDepth(obstacle: CollisionCircle): number {
  return finitePositive(obstacle.halfDepth) ?? obstacle.radius;
}

export function getNavigationCollisionRadius(radius: number, obstacle: CollisionCircle): number {
  const inset = finiteNonNegative(obstacle.navigationInset) ?? 0;
  return Math.max(0.05, radius - inset);
}

export function getCollisionDistanceFromCenter(
  obstacle: CollisionCircle,
  direction: WorldPoint2D,
): number {
  const directionLength = Math.hypot(direction.x, direction.z);
  if (!Number.isFinite(directionLength) || directionLength <= 0.0001) return obstacle.radius;
  const normalized = { x: direction.x / directionLength, z: direction.z / directionLength };
  const localDirection = toLocalPoint({ x: obstacle.x + normalized.x, z: obstacle.z + normalized.z }, obstacle);
  if (getShape(obstacle) === 'rectangle') {
    const extents = [
      Math.abs(localDirection.x) > 0.0001 ? getRectangleHalfWidth(obstacle) / Math.abs(localDirection.x) : Number.POSITIVE_INFINITY,
      Math.abs(localDirection.z) > 0.0001 ? getRectangleHalfDepth(obstacle) / Math.abs(localDirection.z) : Number.POSITIVE_INFINITY,
    ];
    return Math.min(...extents);
  }
  if (getShape(obstacle) === 'capsule') {
    const halfLength = finitePositive(obstacle.halfLength) ?? 0;
    const capRadius = finitePositive(obstacle.capRadius) ?? obstacle.radius;
    const axisDirection = obstacle.axis === 'z' ? localDirection.z : localDirection.x;
    return Math.abs(axisDirection) * halfLength + capRadius;
  }
  return obstacle.radius;
}

function circleRectangleOverlap(circle: CollisionCircle, rectangle: CollisionCircle, epsilon: number): boolean {
  const local = toLocalPoint(circle, rectangle);
  const halfWidth = getRectangleHalfWidth(rectangle);
  const halfDepth = getRectangleHalfDepth(rectangle);
  const closestX = Math.min(halfWidth, Math.max(-halfWidth, local.x));
  const closestZ = Math.min(halfDepth, Math.max(-halfDepth, local.z));
  return Math.hypot(local.x - closestX, local.z - closestZ) < getNavigationCollisionRadius(circle.radius, rectangle) + epsilon;
}

function circleCapsuleOverlap(circle: CollisionCircle, capsule: CollisionCircle, epsilon: number): boolean {
  const local = toLocalPoint(circle, capsule);
  const halfLength = finitePositive(capsule.halfLength) ?? 0;
  const capRadius = finitePositive(capsule.capRadius) ?? capsule.radius;
  const axisCoordinate = capsule.axis === 'z' ? local.z : local.x;
  const otherCoordinate = capsule.axis === 'z' ? local.x : local.z;
  const closestAxisCoordinate = Math.min(halfLength, Math.max(-halfLength, axisCoordinate));
  return Math.hypot(axisCoordinate - closestAxisCoordinate, otherCoordinate) < getNavigationCollisionRadius(circle.radius, capsule) + capRadius + epsilon;
}

function getRectangleCorners(rectangle: CollisionCircle): WorldPoint2D[] {
  const halfWidth = getRectangleHalfWidth(rectangle);
  const halfDepth = getRectangleHalfDepth(rectangle);
  const rotationY = rectangle.rotationY ?? 0;
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [
    { x: -halfWidth, z: -halfDepth },
    { x: halfWidth, z: -halfDepth },
    { x: halfWidth, z: halfDepth },
    { x: -halfWidth, z: halfDepth },
  ].map((corner) => ({
    x: rectangle.x + cosine * corner.x + sine * corner.z,
    z: rectangle.z - sine * corner.x + cosine * corner.z,
  }));
}

function getRectangleAxes(rectangle: CollisionCircle): WorldPoint2D[] {
  const rotationY = rectangle.rotationY ?? 0;
  return [
    { x: Math.cos(rotationY), z: -Math.sin(rotationY) },
    { x: Math.sin(rotationY), z: Math.cos(rotationY) },
  ];
}

function rectanglesOverlap(first: CollisionCircle, second: CollisionCircle, epsilon: number): boolean {
  return [...getRectangleAxes(first), ...getRectangleAxes(second)].every((axis) => {
    const firstProjection = getRectangleCorners(first).map((corner) => corner.x * axis.x + corner.z * axis.z);
    const secondProjection = getRectangleCorners(second).map((corner) => corner.x * axis.x + corner.z * axis.z);
    const firstMin = Math.min(...firstProjection);
    const firstMax = Math.max(...firstProjection);
    const secondMin = Math.min(...secondProjection);
    const secondMax = Math.max(...secondProjection);
    return firstMin <= secondMax + epsilon && secondMin <= firstMax + epsilon;
  });
}

export function circlesOverlap(first: CollisionCircle, second: CollisionCircle, epsilon = WORLD_EPSILON): boolean {
  const firstShape = getShape(first);
  const secondShape = getShape(second);
  if (firstShape === 'circle' && secondShape === 'circle') {
    return Math.hypot(first.x - second.x, first.z - second.z)
      < getNavigationCollisionRadius(first.radius, second)
        + getNavigationCollisionRadius(second.radius, first)
        + epsilon;
  }
  if (firstShape === 'circle' && secondShape === 'rectangle') return circleRectangleOverlap(first, second, epsilon);
  if (firstShape === 'rectangle' && secondShape === 'circle') return circleRectangleOverlap(second, first, epsilon);
  if (firstShape === 'circle' && secondShape === 'capsule') return circleCapsuleOverlap(first, second, epsilon);
  if (firstShape === 'capsule' && secondShape === 'circle') return circleCapsuleOverlap(second, first, epsilon);
  if (firstShape === 'rectangle' && secondShape === 'rectangle') return rectanglesOverlap(first, second, epsilon);
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
  entities: CollisionCircleInput[],
): CollisionCircle[] {
  return entities
    .filter((entity) => entity.collisionRadius > 0 && entity.scale > 0)
    .map((entity) => {
      const radius = entity.collisionRadius * entity.scale;
      const rotationY = Number.isFinite(entity.rotationY) ? entity.rotationY : 0;
      const navigationInset = finiteNonNegative(entity.navigationInset);
      const scaledNavigationInset = navigationInset === undefined ? undefined : navigationInset * entity.scale;
      const navigation = scaledNavigationInset === undefined ? {} : { navigationInset: scaledNavigationInset };
      if (entity.collisionShape === 'rectangle' && entity.collisionWidth && entity.collisionDepth) {
        const halfWidth = entity.collisionWidth * entity.scale / 2;
        const halfDepth = entity.collisionDepth * entity.scale / 2;
        return {
          x: entity.positionX,
          z: entity.positionZ,
          radius: Math.max(radius, Math.hypot(halfWidth, halfDepth)),
          shape: 'rectangle' as const,
          rotationY,
          halfWidth,
          halfDepth,
          ...navigation,
        };
      }
      if (entity.collisionShape === 'capsule' && entity.collisionLength) {
        const halfLength = entity.collisionLength * entity.scale / 2;
        return {
          x: entity.positionX,
          z: entity.positionZ,
          radius: Math.max(radius, radius + halfLength),
          shape: 'capsule' as const,
          rotationY,
          halfLength,
          capRadius: radius,
          axis: entity.collisionAxis ?? 'x',
          ...navigation,
        };
      }
      return { x: entity.positionX, z: entity.positionZ, radius, ...navigation };
    });
}

function positionOverlapsObstacle(position: WorldPoint2D, obstacle: CollisionCircle, radius: number): boolean {
  return circlesOverlap({ ...position, radius }, obstacle);
}

export function moveWorldCharacter(
  current: WorldPoint2D,
  desired: WorldPoint2D,
  radius = CHARACTER_COLLISION_RADIUS,
  decorations: CollisionCircle[] = [],
  boundary = WORLD_BOUNDARY,
  radialBoundary?: RadialWorldBoundary,
  includeCentralTreeKeepOut = true,
): WorldPoint2D {
  const obstacles = [
    ...(includeCentralTreeKeepOut ? [{ x: CENTRAL_TREE_KEEP_OUT.x, z: CENTRAL_TREE_KEEP_OUT.z, radius: CENTRAL_TREE_KEEP_OUT.radius }] : []),
    ...decorations.filter((decoration) => decoration.radius > 0),
  ];
  let next = { x: clampWorldPosition(current.x, radius, boundary), z: clampWorldPosition(current.z, radius, boundary) };
  if (radialBoundary) next = clampWorldPointToRadialBoundary(next, radius, radialBoundary, boundary);
  const xCandidate = { x: clampWorldPosition(desired.x, radius, boundary), z: next.z };
  const boundedXCandidate = radialBoundary
    ? clampWorldPointToRadialBoundary(xCandidate, radius, radialBoundary, boundary)
    : xCandidate;
  if (!obstacles.some((obstacle) => positionOverlapsObstacle(boundedXCandidate, obstacle, radius))) next.x = boundedXCandidate.x;
  const zCandidate = { x: next.x, z: clampWorldPosition(desired.z, radius, boundary) };
  const boundedZCandidate = radialBoundary
    ? clampWorldPointToRadialBoundary(zCandidate, radius, radialBoundary, boundary)
    : zCandidate;
  if (!obstacles.some((obstacle) => positionOverlapsObstacle(boundedZCandidate, obstacle, radius))) next.z = boundedZCandidate.z;
  return radialBoundary ? clampWorldPointToRadialBoundary(next, radius, radialBoundary, boundary) : next;
}
