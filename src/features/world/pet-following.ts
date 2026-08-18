import {
  CHARACTER_COLLISION_RADIUS,
  moveWorldCharacter,
  WORLD_BOUNDARY,
  type CollisionCircle,
  type WorldPoint2D,
} from './world-collision';
import { isRoamingPathClear } from './world-roaming';

export const PET_FOLLOW_DISTANCE = 0.12;
export const PET_FOLLOW_SPACING = 0.16;
export const PET_FOLLOW_CLEARANCE = 0.04;
export const PET_FOLLOW_STOP_DISTANCE = 0.18;
export const PET_FOLLOW_SPEED = 0.75;
export const PET_FOLLOW_TRAIL_SAMPLE_DISTANCE = 0.05;
export const PET_FOLLOW_TRAIL_MAX_SAMPLES = 240;

export function getFollowingDistance(index: number): number {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return PET_FOLLOW_DISTANCE + safeIndex * PET_FOLLOW_SPACING;
}

export interface PetFollowPlayer {
  position: WorldPoint2D;
  facing: WorldPoint2D;
}

export interface PetFollowingStep {
  next: WorldPoint2D;
  facing: WorldPoint2D;
  target: WorldPoint2D;
  arrived: boolean;
  rerouted: boolean;
  blocked: boolean;
}

function normalize(point: WorldPoint2D): WorldPoint2D {
  const length = Math.hypot(point.x, point.z);
  return length > 0.0001 ? { x: point.x / length, z: point.z / length } : { x: 0, z: 1 };
}

function getPetSideFromPlayer(current: WorldPoint2D, player: PetFollowPlayer): WorldPoint2D {
  return normalize({
    x: current.x - player.position.x,
    z: current.z - player.position.z,
  });
}

export function getSafeFollowingDistance(
  followDistance: number,
  followerRadius: number,
  leaderRadius: number,
): number {
  return Math.max(
    Number.isFinite(followDistance) ? followDistance : PET_FOLLOW_DISTANCE,
    leaderRadius + Math.max(followerRadius, 0.08) + PET_FOLLOW_CLEARANCE,
  );
}

export function appendFollowingTrailSample(
  history: WorldPoint2D[],
  position: WorldPoint2D,
  minDistance = PET_FOLLOW_TRAIL_SAMPLE_DISTANCE,
): void {
  const latest = history[0];
  if (latest && Math.hypot(position.x - latest.x, position.z - latest.z) < Math.max(minDistance, 0)) return;
  history.unshift({ x: position.x, z: position.z });
  if (history.length > PET_FOLLOW_TRAIL_MAX_SAMPLES) history.length = PET_FOLLOW_TRAIL_MAX_SAMPLES;
}

export function getFollowingTrailTarget(
  history: readonly WorldPoint2D[],
  leaderPosition: WorldPoint2D,
  followDistance: number,
): WorldPoint2D | undefined {
  if (history.length === 0) return undefined;
  const distance = Number.isFinite(followDistance) ? Math.max(followDistance, 0.1) : PET_FOLLOW_DISTANCE;
  let previous = leaderPosition;
  let travelled = 0;
  for (const sample of history) {
    const segmentDistance = Math.hypot(sample.x - previous.x, sample.z - previous.z);
    if (travelled + segmentDistance >= distance) {
      if (segmentDistance <= 0.0001) return { x: sample.x, z: sample.z };
      const ratio = (distance - travelled) / segmentDistance;
      return {
        x: previous.x + (sample.x - previous.x) * ratio,
        z: previous.z + (sample.z - previous.z) * ratio,
      };
    }
    travelled += segmentDistance;
    previous = sample;
  }
  return undefined;
}

export function getFollowingTarget(
  current: WorldPoint2D,
  player: PetFollowPlayer,
  distance = PET_FOLLOW_DISTANCE,
): WorldPoint2D {
  const safeDistance = Number.isFinite(distance) ? Math.max(distance, 0.1) : PET_FOLLOW_DISTANCE;
  // Keep the pet on the side where it already is. The player's facing is a
  // visual state and must not make a nearby pet cross the player to get behind
  // them when they turn in place.
  const sideFromPlayer = getPetSideFromPlayer(current, player);
  return {
    x: player.position.x + sideFromPlayer.x * safeDistance,
    z: player.position.z + sideFromPlayer.z * safeDistance,
  };
}

function getFollowRoute(
  current: WorldPoint2D,
  target: WorldPoint2D,
  player: PetFollowPlayer,
  radius: number,
  obstacles: readonly CollisionCircle[],
  playerRadius: number,
): { waypoint: WorldPoint2D; rerouted: boolean } {
  const collisionObstacles: CollisionCircle[] = [
    ...obstacles,
    { x: player.position.x, z: player.position.z, radius: playerRadius },
  ];
  if (isRoamingPathClear(current, target, radius, collisionObstacles)) {
    return { waypoint: target, rerouted: false };
  }

  const sideFromPlayer = getPetSideFromPlayer(current, player);
  const side = { x: -sideFromPlayer.z, z: sideFromPlayer.x };
  // Keep the waypoint outside both hitboxes. When the target is close to the
  // player, the tangent point needs to move farther out so the second leg does
  // not cut back through either collision circle.
  const clearance = playerRadius + radius + 0.02;
  const targetDistanceFromPlayer = Math.hypot(
    target.x - player.position.x,
    target.z - player.position.z,
  );
  const tangentRadius = targetDistanceFromPlayer > clearance
    ? (clearance * targetDistanceFromPlayer / Math.sqrt(targetDistanceFromPlayer ** 2 - clearance ** 2)) + 0.08
    : clearance + 0.4;
  const orbitRadius = Math.max(playerRadius + radius + 0.4, tangentRadius, 0.9);
  const candidates = [
    { x: player.position.x + side.x * orbitRadius, z: player.position.z + side.z * orbitRadius },
    { x: player.position.x - side.x * orbitRadius, z: player.position.z - side.z * orbitRadius },
  ]
    .filter((candidate) => Math.abs(candidate.x) + radius <= WORLD_BOUNDARY && Math.abs(candidate.z) + radius <= WORLD_BOUNDARY)
    .filter((candidate) => isRoamingPathClear(current, candidate, radius, collisionObstacles))
    .filter((candidate) => isRoamingPathClear(candidate, target, radius, collisionObstacles))
    .sort((left, right) => (
      Math.hypot(left.x - current.x, left.z - current.z) + Math.hypot(left.x - target.x, left.z - target.z)
    ) - (
      Math.hypot(right.x - current.x, right.z - current.z) + Math.hypot(right.x - target.x, right.z - target.z)
    ));

  return candidates.length > 0
    ? { waypoint: candidates[0], rerouted: true }
    : { waypoint: target, rerouted: false };
}

export function getFollowingStep(
  current: WorldPoint2D,
  player: PetFollowPlayer,
  delta: number,
  radius: number,
  speed = PET_FOLLOW_SPEED,
  obstacles: readonly CollisionCircle[] = [],
  playerRadius = CHARACTER_COLLISION_RADIUS,
  followDistance = PET_FOLLOW_DISTANCE,
  targetOverride?: WorldPoint2D,
): PetFollowingStep {
  const safeFollowDistance = getSafeFollowingDistance(followDistance, radius, playerRadius);
  const distanceToPlayer = Math.hypot(
    current.x - player.position.x,
    current.z - player.position.z,
  );
  const initialTarget = distanceToPlayer <= safeFollowDistance
    ? current
    : getFollowingTarget(current, player, safeFollowDistance);
  const target = targetOverride ?? initialTarget;
  const distanceToTarget = Math.hypot(target.x - current.x, target.z - current.z);
  if (distanceToTarget <= PET_FOLLOW_STOP_DISTANCE) {
    return { next: current, facing: getPetSideFromPlayer(current, player), target, arrived: true, rerouted: false, blocked: false };
  }

  const currentFromLeader = {
    x: current.x - player.position.x,
    z: current.z - player.position.z,
  };
  const targetFromLeader = {
    x: target.x - player.position.x,
    z: target.z - player.position.z,
  };
  const currentDistanceFromLeader = Math.hypot(currentFromLeader.x, currentFromLeader.z);
  const targetDistanceFromLeader = Math.hypot(targetFromLeader.x, targetFromLeader.z);
  if (
    currentDistanceFromLeader > safeFollowDistance
    && targetDistanceFromLeader > safeFollowDistance
    && currentFromLeader.x * targetFromLeader.x + currentFromLeader.z * targetFromLeader.z < 0
  ) {
    return {
      next: current,
      facing: normalize({ x: target.x - current.x, z: target.z - current.z }),
      target,
      arrived: false,
      rerouted: false,
      blocked: true,
    };
  }

  const route = getFollowRoute(current, target, player, radius, obstacles, playerRadius);
  const deltaX = route.waypoint.x - current.x;
  const deltaZ = route.waypoint.z - current.z;
  const waypointDistance = Math.hypot(deltaX, deltaZ);
  if (waypointDistance <= 0.0001) {
    return { next: current, facing: getPetSideFromPlayer(current, player), target, arrived: distanceToTarget <= 0.08, rerouted: route.rerouted, blocked: false };
  }

  const direction = { x: deltaX / waypointDistance, z: deltaZ / waypointDistance };
  const stepDistance = Math.min(waypointDistance, Math.max(delta, 0) * Math.max(speed, 0));
  const next = moveWorldCharacter(
    current,
    { x: current.x + direction.x * stepDistance, z: current.z + direction.z * stepDistance },
    radius,
    [...obstacles, { x: player.position.x, z: player.position.z, radius: playerRadius }],
  );
  const moved = Math.hypot(next.x - current.x, next.z - current.z);
  return {
    next,
    facing: direction,
    target,
    arrived: Math.hypot(target.x - next.x, target.z - next.z) <= 0.08,
    rerouted: route.rerouted,
    blocked: moved <= 0.0001,
  };
}
