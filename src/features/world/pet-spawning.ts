import {
  circlesOverlap,
  WORLD_BOUNDARY,
  type CollisionCircle,
  type WorldPoint2D,
} from './world-collision';

const PET_SPAWN_MIN_RADIUS = 1.15;
const PET_SPAWN_MAX_RADIUS = 2.75;
const PET_SPAWN_GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function seededUnit(value: number): number {
  let state = Math.imul((Math.floor(value) ^ 0x9e3779b9) >>> 0, 0x85ebca6b) >>> 0;
  state ^= state >>> 16;
  state = Math.imul(state, 0xc2b2ae35) >>> 0;
  state ^= state >>> 13;
  return (state >>> 0) / 0x1_0000_0000;
}

function getMidFieldSpawnCandidate(sequence: number): WorldPoint2D {
  const angleJitter = (seededUnit(sequence + 17) - 0.5) * 0.6;
  const angle = sequence * PET_SPAWN_GOLDEN_ANGLE + angleJitter;
  const radius = PET_SPAWN_MIN_RADIUS
    + seededUnit(sequence + 31) * (PET_SPAWN_MAX_RADIUS - PET_SPAWN_MIN_RADIUS);
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
}

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
  for (let offset = 0; offset < 64; offset += 1) {
    const candidate = getMidFieldSpawnCandidate(safeIndex + offset * 13);
    if (isAvailableSpawn(candidate, radius, obstacles)) return { ...candidate };
  }

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const angle = (safeIndex + attempt) * PET_SPAWN_GOLDEN_ANGLE;
    const ring = 1.2 + (attempt % 5) * 0.32;
    const candidate = { x: Math.cos(angle) * ring, z: Math.sin(angle) * ring };
    if (isAvailableSpawn(candidate, radius, obstacles)) return candidate;
  }

  return { x: 0, z: -1.2 };
}
