import {
  CHARACTER_COLLISION_RADIUS,
  moveWorldCharacter,
  WORLD_BOUNDARY,
  type CollisionCircle,
  type WorldPoint2D,
} from './world-collision';
import { isRoamingPathClear } from './world-roaming';

export const PET_FOLLOW_DISTANCE = 0.48;
export const PET_FOLLOW_STOP_DISTANCE = 0.18;
export const PET_FOLLOW_SPEED = 0.75;

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

export function getFollowingTarget(
  player: PetFollowPlayer,
  distance = PET_FOLLOW_DISTANCE,
): WorldPoint2D {
  const facing = normalize(player.facing);
  const safeDistance = Number.isFinite(distance) ? Math.max(distance, 0.1) : PET_FOLLOW_DISTANCE;
  return {
    x: player.position.x - facing.x * safeDistance,
    z: player.position.z - facing.z * safeDistance,
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

  const facing = normalize(player.facing);
  const side = { x: -facing.z, z: facing.x };
  // Keep the waypoint outside both hitboxes. When the target is close behind
  // the player, the tangent point needs to move farther out so the second leg
  // does not cut back through either collision circle.
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
): PetFollowingStep {
  const safeFollowDistance = Math.max(
    PET_FOLLOW_DISTANCE,
    playerRadius + Math.max(radius, 0.08) + 0.12,
  );
  const target = getFollowingTarget(player, safeFollowDistance);
  const distanceToTarget = Math.hypot(target.x - current.x, target.z - current.z);
  if (distanceToTarget <= PET_FOLLOW_STOP_DISTANCE) {
    return { next: current, facing: normalize(player.facing), target, arrived: true, rerouted: false, blocked: false };
  }

  const route = getFollowRoute(current, target, player, radius, obstacles, playerRadius);
  const deltaX = route.waypoint.x - current.x;
  const deltaZ = route.waypoint.z - current.z;
  const waypointDistance = Math.hypot(deltaX, deltaZ);
  if (waypointDistance <= 0.0001) {
    return { next: current, facing: normalize(player.facing), target, arrived: distanceToTarget <= 0.08, rerouted: route.rerouted, blocked: false };
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
