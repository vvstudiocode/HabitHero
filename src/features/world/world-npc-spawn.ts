import {
  circlesOverlap,
  clampWorldPointToRadialBoundary,
  WORLD_BOUNDARY,
  type CollisionCircle,
  type RadialWorldBoundary,
  type WorldPoint2D,
} from './world-collision';
import type { WorldNpcSummary } from './contracts';

export interface WorldNpcPetNavigationOptions {
  wanderObstacles: readonly CollisionCircle[];
  walkableBoundary?: number;
  walkableRadialBoundary?: RadialWorldBoundary;
  isPetPositionWalkable?: (position: WorldPoint2D) => boolean;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampWorldNpcRoamingPosition(
  position: WorldPoint2D,
  npc: Pick<WorldNpcSummary, 'roamBounds'>,
  radius: number,
): WorldPoint2D {
  const bounds = npc.roamBounds;
  if (!bounds) return position;
  return {
    x: clamp(position.x, Number(bounds.minX ?? -4.8) + radius, Number(bounds.maxX ?? 4.8) - radius),
    z: clamp(position.z, Number(bounds.minZ ?? -4.8) + radius, Number(bounds.maxZ ?? 4.8) - radius),
  };
}

export function isWorldNpcPetPositionAvailable(
  options: WorldNpcPetNavigationOptions,
  npc: Pick<WorldNpcSummary, 'roamBounds'>,
  position: WorldPoint2D,
  radius: number,
): boolean {
  const boundedRoamPosition = clampWorldNpcRoamingPosition(position, npc, radius);
  if (Math.hypot(boundedRoamPosition.x - position.x, boundedRoamPosition.z - position.z) > 0.001) return false;
  const boundary = options.walkableBoundary ?? WORLD_BOUNDARY;
  if (Math.abs(position.x) + radius > boundary || Math.abs(position.z) + radius > boundary) return false;
  if (options.walkableRadialBoundary) {
    const bounded = clampWorldPointToRadialBoundary(position, radius, options.walkableRadialBoundary, boundary);
    if (Math.hypot(bounded.x - position.x, bounded.z - position.z) > 0.001) return false;
  }
  if (options.isPetPositionWalkable && !options.isPetPositionWalkable(position)) return false;
  return !options.wanderObstacles.some((obstacle) => circlesOverlap({ ...position, radius }, obstacle));
}

export function findWorldNpcPetSpawnPosition(
  options: WorldNpcPetNavigationOptions,
  npc: Pick<WorldNpcSummary, 'position' | 'roamBounds'>,
  radius: number,
): WorldPoint2D {
  const origins = [clampWorldNpcRoamingPosition(npc.position, npc, radius), { x: 0, z: 0 }];
  const visited = new Set<string>();
  const step = Math.max(0.55, radius * 1.8);
  for (const origin of origins) {
    for (let ring = 0; ring <= 14; ring += 1) {
      const sampleCount = ring === 0 ? 1 : 16;
      for (let index = 0; index < sampleCount; index += 1) {
        const angle = index / sampleCount * Math.PI * 2;
        const candidate = clampWorldNpcRoamingPosition({
          x: origin.x + Math.cos(angle) * ring * step,
          z: origin.z + Math.sin(angle) * ring * step,
        }, npc, radius);
        const key = `${candidate.x.toFixed(3)}:${candidate.z.toFixed(3)}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (isWorldNpcPetPositionAvailable(options, npc, candidate, radius)) return candidate;
      }
    }
  }
  return origins[0];
}
