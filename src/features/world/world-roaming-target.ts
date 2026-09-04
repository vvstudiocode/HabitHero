import {
  clampWorldPosition,
  circlesOverlap,
  moveWorldCharacter,
  WORLD_BOUNDARY,
  type CollisionCircle,
  type WorldPoint2D,
} from './world-collision';

export function isRoamingPathClear(
  start: WorldPoint2D,
  end: WorldPoint2D,
  radius: number,
  obstacles: readonly CollisionCircle[],
): boolean {
  const distance = Math.hypot(end.x - start.x, end.z - start.z);
  const sampleDistance = Math.max(radius * 0.55, 0.1);
  const sampleCount = Math.max(1, Math.ceil(distance / sampleDistance));
  for (let index = 1; index <= sampleCount; index += 1) {
    const progress = index / sampleCount;
    const point = {
      x: start.x + (end.x - start.x) * progress,
      z: start.z + (end.z - start.z) * progress,
    };
    if (obstacles.some((obstacle) => circlesOverlap({ ...point, radius }, obstacle))) return false;
  }
  return true;
}

export function chooseRoamingTarget(
  current: WorldPoint2D,
  radius: number,
  obstacles: readonly CollisionCircle[],
  random: () => number = Math.random,
): WorldPoint2D | undefined {
  const limit = WORLD_BOUNDARY - radius - 0.08;
  const minimumDistance = Math.max(1.1, radius * 2.4);
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = { x: (random() * 2 - 1) * limit, z: (random() * 2 - 1) * limit };
    if (Math.hypot(candidate.x - current.x, candidate.z - current.z) < minimumDistance) continue;
    if (obstacles.some((obstacle) => circlesOverlap({ ...candidate, radius }, obstacle))) continue;
    if (!isRoamingPathClear(current, candidate, radius, obstacles)) continue;
    return candidate;
  }

  const fallbackDistance = Math.max(1.4, limit * 0.35);
  const fallbackCandidates = [
    { x: clampWorldPosition(current.x + fallbackDistance, radius), z: current.z },
    { x: clampWorldPosition(current.x - fallbackDistance, radius), z: current.z },
    { x: current.x, z: clampWorldPosition(current.z + fallbackDistance, radius) },
    { x: current.x, z: clampWorldPosition(current.z - fallbackDistance, radius) },
  ];
  const localFallback = fallbackCandidates.find((candidate) => (
    Math.hypot(candidate.x - current.x, candidate.z - current.z) >= minimumDistance
    && !obstacles.some((obstacle) => circlesOverlap({ ...candidate, radius }, obstacle))
    && isRoamingPathClear(current, candidate, radius, obstacles)
  ));
  if (localFallback) return localFallback;

  // A decoration can occupy one or more local fallback points. These perimeter
  // points keep the NPC moving when random sampling happens to miss the open
  // area, while the same obstacle/path checks still prevent tree and wall hits.
  const perimeterCandidates = [
    { x: -limit, z: -limit },
    { x: -limit, z: limit },
    { x: limit, z: -limit },
    { x: limit, z: limit },
    { x: 0, z: -limit },
    { x: 0, z: limit },
    { x: -limit, z: 0 },
    { x: limit, z: 0 },
  ];
  return perimeterCandidates.find((candidate) => (
    Math.hypot(candidate.x - current.x, candidate.z - current.z) >= minimumDistance
    && !obstacles.some((obstacle) => circlesOverlap({ ...candidate, radius }, obstacle))
    && isRoamingPathClear(current, candidate, radius, obstacles)
  ));
}

export function getRoamingStep(
  current: WorldPoint2D,
  target: WorldPoint2D,
  delta: number,
  radius: number,
  speed: number,
  obstacles: readonly CollisionCircle[],
): {
  next: WorldPoint2D;
  facing: WorldPoint2D;
  arrived: boolean;
  blocked: boolean;
} {
  const deltaX = target.x - current.x;
  const deltaZ = target.z - current.z;
  const distance = Math.hypot(deltaX, deltaZ);
  if (distance <= 0.06) {
    return { next: target, facing: { x: 0, z: 1 }, arrived: true, blocked: false };
  }

  const direction = { x: deltaX / distance, z: deltaZ / distance };
  const step = Math.min(distance, Math.max(delta, 0) * Math.max(speed, 0));
  const next = moveWorldCharacter(
    current,
    { x: current.x + direction.x * step, z: current.z + direction.z * step },
    radius,
    [...obstacles],
  );
  const moved = Math.hypot(next.x - current.x, next.z - current.z);
  return {
    next,
    facing: direction,
    arrived: Math.hypot(target.x - next.x, target.z - next.z) <= 0.06,
    blocked: moved <= 0.0001,
  };
}
