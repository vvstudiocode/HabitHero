import {
  clampWorldPointToRadialBoundary,
  circlesOverlap,
  getCollisionDistanceFromCenter,
  getNavigationCollisionRadius,
  moveWorldCharacter,
  WORLD_BOUNDARY,
  type CollisionCircle,
  type RadialWorldBoundary,
  type WorldPoint2D,
} from './world-collision';
import { isRoamingPathClear } from './world-roaming-target';

export { chooseRoamingTarget, getRoamingStep, isRoamingPathClear } from './world-roaming-target';

export const HABITHERO_ROAMING_CHARACTER_ASSET_KEY = 'character.habithero-sprout';
export const HABITHERO_ROAMING_CHARACTER_MODEL_URL = '/assets/habithero-v16-wanderer.glb';
export const HABITHERO_ROAMING_CHARACTER_RADIUS = 0.34;
export const HABITHERO_ROAMING_CHARACTER_SPEED = 0.3;
export const HABITHERO_ROAMING_CHARACTER_PAUSE = 0.45;
// The source rig is authored at a different scale from the world avatar. This
// factor keeps the roaming actor's requested in-world size explicit while
// preserving its proportions.
export const HABITHERO_ROAMING_CHARACTER_VISUAL_SCALE = 0.7;

const WANDER_BOUNDARY_MARGIN = 1.15;
const WANDER_OBSTACLE_MARGIN = 0.72;
const WANDER_MAX_TURN_RATE = 0.72;
const WANDER_TURN_INTERVAL_MIN = 1.4;
const WANDER_TURN_INTERVAL_MAX = 3.2;
const WANDER_PAUSE_INTERVAL_MIN = 4.2;
const WANDER_PAUSE_INTERVAL_MAX = 8.5;
const WANDER_PAUSE_DURATION_MIN = 0.65;
const WANDER_PAUSE_DURATION_MAX = 1.75;
const WANDER_EXPLORE_INTERVAL_MIN = 12;
const WANDER_EXPLORE_INTERVAL_MAX = 18;

/** Shared baseline for the owned-pet and scene-pet patrol runtimes. */
export const PET_WANDER_SPEED = 0.5;

export interface WanderState {
  seed: number;
  randomState: number;
  facing: WorldPoint2D;
  turnRate: number;
  nextTurnAt: number;
  nextPauseAt: number;
  pauseUntil: number;
  explorationTarget: WorldPoint2D | null;
  nextExploreAt: number;
}

export interface WanderStep {
  next: WorldPoint2D;
  facing: WorldPoint2D;
  walking: boolean;
  blocked: boolean;
}

export interface WanderPauseDurationRange {
  min: number;
  max: number;
}

export const DEFAULT_WANDER_PAUSE_DURATION_RANGE = {
  min: WANDER_PAUSE_DURATION_MIN,
  max: WANDER_PAUSE_DURATION_MAX,
} as const satisfies WanderPauseDurationRange;

function normalize(point: WorldPoint2D): WorldPoint2D {
  const length = Math.hypot(point.x, point.z);
  return length > 0.0001 ? { x: point.x / length, z: point.z / length } : { x: 0, z: 1 };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function nextRandom(state: WanderState): number {
  let value = state.randomState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.randomState = value >>> 0;
  return state.randomState / 0x1_0000_0000;
}

function randomBetween(state: WanderState, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * nextRandom(state);
}

export function hashWanderSeed(value: string | number): number {
  const input = String(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

export function createWanderState(seed: number, initialFacing: WorldPoint2D = { x: 0, z: 1 }): WanderState {
  const normalizedSeed = (Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 1) >>> 0 || 1;
  const state = {
    seed: normalizedSeed,
    randomState: normalizedSeed,
    facing: normalize(initialFacing),
    turnRate: 0,
    nextTurnAt: 0,
    nextPauseAt: 0,
    pauseUntil: Number.POSITIVE_INFINITY,
    explorationTarget: null,
    nextExploreAt: 0,
  } satisfies WanderState;
  state.turnRate = randomBetween(state, -WANDER_MAX_TURN_RATE, WANDER_MAX_TURN_RATE);
  state.nextTurnAt = randomBetween(state, WANDER_TURN_INTERVAL_MIN, WANDER_TURN_INTERVAL_MAX);
  state.nextPauseAt = randomBetween(state, WANDER_PAUSE_INTERVAL_MIN, WANDER_PAUSE_INTERVAL_MAX);
  return state;
}

function getAngle(point: WorldPoint2D): number {
  return Math.atan2(point.x, point.z);
}

function getAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function getBoundaryForce(
  current: WorldPoint2D,
  radius: number,
  boundary = WORLD_BOUNDARY,
  radialBoundary?: RadialWorldBoundary,
): WorldPoint2D {
  const innerBoundary = boundary - radius;
  const margin = Math.max(WANDER_BOUNDARY_MARGIN, radius * 3);
  const force = { x: 0, z: 0 };
  for (const axis of ['x', 'z'] as const) {
    const distance = innerBoundary - Math.abs(current[axis]);
    const proximity = clamp((margin - distance) / margin, 0, 1);
    if (proximity <= 0 || Math.abs(current[axis]) <= 0.0001) continue;
    force[axis] = -Math.sign(current[axis]) * proximity ** 2 * 3.4;
  }
  if (radialBoundary) {
    const offset = { x: current.x - radialBoundary.center.x, z: current.z - radialBoundary.center.z };
    const distance = Math.hypot(offset.x, offset.z);
    if (distance > 0.0001) {
      const direction = { x: offset.x / distance, z: offset.z / distance };
      const edge = clampWorldPointToRadialBoundary({
        x: radialBoundary.center.x + direction.x * (boundary + radius + 1),
        z: radialBoundary.center.z + direction.z * (boundary + radius + 1),
      }, radius, radialBoundary, boundary);
      const edgeDistance = Math.hypot(edge.x - radialBoundary.center.x, edge.z - radialBoundary.center.z);
      const proximity = clamp((margin - (edgeDistance - distance)) / margin, 0, 1);
      force.x -= direction.x * proximity ** 2 * 3.4;
      force.z -= direction.z * proximity ** 2 * 3.4;
    }
  }
  return force;
}

function getObstacleForce(
  current: WorldPoint2D,
  radius: number,
  obstacles: readonly CollisionCircle[],
  state: WanderState,
): WorldPoint2D {
  const force = { x: 0, z: 0 };
  obstacles.forEach((obstacle, index) => {
    const away = { x: current.x - obstacle.x, z: current.z - obstacle.z };
    const distance = Math.hypot(away.x, away.z);
    const outward = distance > 0.0001 ? { x: away.x / distance, z: away.z / distance } : { x: 1, z: 0 };
    const collisionDistance = getNavigationCollisionRadius(radius, obstacle)
      + getCollisionDistanceFromCenter(obstacle, outward);
    const influenceDistance = collisionDistance + Math.max(WANDER_OBSTACLE_MARGIN, radius * 2);
    if (distance >= influenceDistance) return;
    const proximity = clamp((influenceDistance - distance) / influenceDistance, 0, 1);
    const strength = proximity ** 2 * 3.2;
    force.x += outward.x * strength;
    force.z += outward.z * strength;
    const side = ((state.seed + index) & 1) === 0 ? 1 : -1;
    const approaching = clamp(-(state.facing.x * outward.x + state.facing.z * outward.z), 0, 1);
    force.x += -outward.z * side * strength * 0.58 * approaching;
    force.z += outward.x * side * strength * 0.58 * approaching;
  });
  return force;
}

function chooseExplorationTarget(
  current: WorldPoint2D,
  radius: number,
  obstacles: readonly CollisionCircle[],
  state: WanderState,
  boundary = WORLD_BOUNDARY,
  radialBoundary?: RadialWorldBoundary,
): WorldPoint2D | null {
  const limit = Math.max(0.4, boundary - radius - 0.12);
  const minimumDistance = Math.min(3.6, limit * 1.15);
  const targetXSign = current.x >= 0 ? -1 : 1;
  const targetZSign = current.z >= 0 ? -1 : 1;
  for (let attempt = 0; attempt < 28; attempt += 1) {
    const rawCandidate = {
      x: targetXSign * randomBetween(state, limit * 0.45, limit),
      z: targetZSign * randomBetween(state, limit * 0.45, limit),
    };
    const candidate = radialBoundary
      ? clampWorldPointToRadialBoundary(rawCandidate, radius, radialBoundary, boundary)
      : rawCandidate;
    if (Math.hypot(candidate.x - current.x, candidate.z - current.z) < minimumDistance) continue;
    if (obstacles.some((obstacle) => circlesOverlap({ ...candidate, radius }, obstacle))) continue;
    if (!isRoamingPathClear(current, candidate, radius, obstacles)) continue;
    return candidate;
  }
  return null;
}

function getWanderDirection(
  current: WorldPoint2D,
  radius: number,
  obstacles: readonly CollisionCircle[],
  state: WanderState,
  delta: number,
  boundary = WORLD_BOUNDARY,
  radialBoundary?: RadialWorldBoundary,
): WorldPoint2D {
  const currentAngle = getAngle(state.facing);
  state.turnRate += randomBetween(state, -0.12, 0.12) * Math.min(delta, 0.05);
  state.turnRate = clamp(state.turnRate, -WANDER_MAX_TURN_RATE, WANDER_MAX_TURN_RATE);
  const driftAngle = currentAngle + state.turnRate * Math.max(delta, 0);
  const drift = { x: Math.sin(driftAngle), z: Math.cos(driftAngle) };
  const boundaryForce = getBoundaryForce(current, radius, boundary, radialBoundary);
  const obstacle = getObstacleForce(current, radius, obstacles, state);
  const targetOffset = state.explorationTarget
    ? { x: state.explorationTarget.x - current.x, z: state.explorationTarget.z - current.z }
    : { x: 0, z: 0 };
  const targetDistance = Math.hypot(targetOffset.x, targetOffset.z);
  const exploration = targetDistance > 0.001 ? normalize(targetOffset) : { x: 0, z: 0 };
  const explorationWeight = clamp(targetDistance / 3.2, 0, 1) * 0.85;
  const desired = {
    x: drift.x * 0.78 + exploration.x * explorationWeight + boundaryForce.x + obstacle.x,
    z: drift.z * 0.78 + exploration.z * explorationWeight + boundaryForce.z + obstacle.z,
  };
  const desiredDirection = normalize(desired);
  const desiredAngle = getAngle(desiredDirection);
  const boundaryStrength = Math.hypot(boundaryForce.x, boundaryForce.z);
  const obstacleStrength = Math.hypot(obstacle.x, obstacle.z);
  const turnRateLimit = clamp(1.15 + boundaryStrength * 0.55 + obstacleStrength * 0.7, 1.15, 2.8);
  const actorTurnVariation = 0.9 + ((state.seed % 997) / 997) * 0.2;
  const turnLimit = turnRateLimit * actorTurnVariation * Math.max(delta, 0);
  const smoothedAngle = currentAngle + clamp(getAngleDelta(currentAngle, desiredAngle), -turnLimit, turnLimit);
  return normalize({ x: Math.sin(smoothedAngle), z: Math.cos(smoothedAngle) });
}

export function getWanderStep(
  current: WorldPoint2D,
  delta: number,
  radius: number,
  speed: number,
  obstacles: readonly CollisionCircle[],
  state: WanderState,
  now = 0,
  pauseDurationRange: WanderPauseDurationRange = DEFAULT_WANDER_PAUSE_DURATION_RANGE,
  boundary = WORLD_BOUNDARY,
  radialBoundary?: RadialWorldBoundary,
): WanderStep {
  const safeDelta = Math.max(0, Number.isFinite(delta) ? delta : 0);
  const safeNow = Number.isFinite(now) ? now : state.nextPauseAt;
  const pauseMin = Number.isFinite(pauseDurationRange.min) ? Math.max(0, pauseDurationRange.min) : WANDER_PAUSE_DURATION_MIN;
  const pauseMax = Number.isFinite(pauseDurationRange.max) ? Math.max(pauseMin, pauseDurationRange.max) : Math.max(pauseMin, WANDER_PAUSE_DURATION_MAX);
  if (safeNow >= state.nextPauseAt && state.pauseUntil === Number.POSITIVE_INFINITY) {
    state.pauseUntil = safeNow + randomBetween(state, pauseMin, pauseMax);
    state.nextPauseAt = Number.POSITIVE_INFINITY;
  }
  if (state.pauseUntil !== Number.POSITIVE_INFINITY && safeNow < state.pauseUntil) {
    return { next: current, facing: state.facing, walking: false, blocked: false };
  }
  if (state.pauseUntil !== Number.POSITIVE_INFINITY) {
    state.pauseUntil = Number.POSITIVE_INFINITY;
    state.nextPauseAt = safeNow + randomBetween(state, WANDER_PAUSE_INTERVAL_MIN, WANDER_PAUSE_INTERVAL_MAX);
  }
  if (safeNow >= state.nextTurnAt) {
    state.turnRate = randomBetween(state, -WANDER_MAX_TURN_RATE, WANDER_MAX_TURN_RATE);
    state.nextTurnAt = safeNow + randomBetween(state, WANDER_TURN_INTERVAL_MIN, WANDER_TURN_INTERVAL_MAX);
  }
  const explorationDistance = state.explorationTarget
    ? Math.hypot(state.explorationTarget.x - current.x, state.explorationTarget.z - current.z)
    : 0;
  if (!state.explorationTarget || safeNow >= state.nextExploreAt || explorationDistance < Math.max(0.7, radius * 1.4)) {
    state.explorationTarget = chooseExplorationTarget(current, radius, obstacles, state, boundary, radialBoundary);
    state.nextExploreAt = safeNow + randomBetween(state, WANDER_EXPLORE_INTERVAL_MIN, WANDER_EXPLORE_INTERVAL_MAX);
  }
  const direction = getWanderDirection(current, radius, obstacles, state, safeDelta, boundary, radialBoundary);
  state.facing = direction;
  const stepDistance = safeDelta * Math.max(speed, 0);
  const desired = { x: current.x + direction.x * stepDistance, z: current.z + direction.z * stepDistance };
  const next = moveWorldCharacter(
    current,
    desired,
    radius,
    [...obstacles],
    boundary,
    radialBoundary,
  );
  const moved = Math.hypot(next.x - current.x, next.z - current.z);
  const blocked = moved <= 0.0001 && stepDistance > 0.0001;
  if (blocked) {
    state.explorationTarget = null;
    state.nextExploreAt = safeNow;
    state.turnRate = ((state.seed & 1) === 0 ? 1 : -1) * WANDER_MAX_TURN_RATE;
  }
  return {
    next,
    facing: direction,
    walking: true,
    blocked,
  };
}
