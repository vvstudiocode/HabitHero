import {
  circlesOverlap,
  WORLD_BOUNDARY,
  type CollisionCircle,
  type WorldPoint2D,
} from './world-collision';

const DISTRIBUTED_PET_SPAWNS: readonly WorldPoint2D[] = [
  { x: -3.2, z: -2.8 },
  { x: 3.1, z: -2.4 },
  { x: -3.25, z: 1.25 },
  { x: 3.2, z: 1.55 },
  { x: -1.7, z: 3.45 },
  { x: 1.8, z: -3.45 },
  { x: -3.5, z: -0.55 },
  { x: 3.45, z: -0.15 },
  { x: 0, z: -3.55 },
  { x: -2.55, z: 2.85 },
  { x: 2.65, z: 3.05 },
  { x: 1.55, z: 0.15 },
];

function isAvailableSpawn(
  position: WorldPoint2D,
  radius: number,
  obstacles: readonly CollisionCircle[],
): boolean {
  return Math.abs(position.x) + radius <= WORLD_BOUNDARY - 0.04
    && Math.abs(position.z) + radius <= WORLD_BOUNDARY - 0.04
    && !obstacles.some((obstacle) => circlesOverlap({ ...position, radius }, obstacle));
}

export function getPetNavigationRadius(collisionRadius: number, entityScale: number): number {
  const safeRadius = Number.isFinite(collisionRadius) ? Math.max(collisionRadius, 0.08) : 0.28;
  const safeScale = Number.isFinite(entityScale) ? Math.max(entityScale, 0.01) : 1;
  return safeRadius * safeScale;
}

export function getDistributedPetSpawnPosition(
  index: number,
  radius: number,
  obstacles: readonly CollisionCircle[],
): WorldPoint2D {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  for (let offset = 0; offset < DISTRIBUTED_PET_SPAWNS.length; offset += 1) {
    const candidate = DISTRIBUTED_PET_SPAWNS[(safeIndex + offset) % DISTRIBUTED_PET_SPAWNS.length];
    if (isAvailableSpawn(candidate, radius, obstacles)) return { ...candidate };
  }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const angle = (safeIndex + attempt) * goldenAngle;
    const ring = 1.6 + (attempt % 4) * 0.65;
    const candidate = { x: Math.cos(angle) * ring, z: Math.sin(angle) * ring };
    if (isAvailableSpawn(candidate, radius, obstacles)) return candidate;
  }

  return { x: 0, z: -Math.max(0, WORLD_BOUNDARY - radius - 0.12) };
}
