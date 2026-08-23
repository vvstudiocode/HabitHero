export type FriendWorldVisitMode = 'owner' | 'visitor';

export interface FriendWorldOwnerContext {
  viewerChildProfileId: string;
  worldOwnerChildProfileId: string;
  mode: FriendWorldVisitMode;
  isOwner: boolean;
  canMove: true;
  canChat: true;
  canJoinCoopAdventure: true;
  canMutateWorld: boolean;
  canEditDecorations: boolean;
  canManagePets: boolean;
  canUseStore: boolean;
  canManageDailyAdventures: boolean;
}

export function getFriendWorldVisitMode(input: {
  viewerChildProfileId: string;
  worldOwnerChildProfileId: string;
}): FriendWorldVisitMode {
  return input.viewerChildProfileId === input.worldOwnerChildProfileId ? 'owner' : 'visitor';
}

export function createFriendWorldOwnerContext(input: {
  viewerChildProfileId: string;
  worldOwnerChildProfileId: string;
}): FriendWorldOwnerContext {
  const mode = getFriendWorldVisitMode(input);
  const isOwner = mode === 'owner';
  return {
    viewerChildProfileId: input.viewerChildProfileId,
    worldOwnerChildProfileId: input.worldOwnerChildProfileId,
    mode,
    isOwner,
    canMove: true,
    canChat: true,
    canJoinCoopAdventure: true,
    canMutateWorld: isOwner,
    canEditDecorations: isOwner,
    canManagePets: isOwner,
    canUseStore: isOwner,
    canManageDailyAdventures: isOwner,
  };
}

export interface WorldPoint {
  x: number;
  z: number;
}

export type FriendWorldSpawnReason =
  | 'full_reload'
  | 'short_reconnect'
  | 'enter_friend_world'
  | 'enter_own_world'
  | 'leave_friend_world';

export interface FriendWorldSpawnDecision {
  position: WorldPoint;
  source: 'fixed_spawn' | 'memory';
  clearMemoryPosition: boolean;
  shouldRebroadcast: true;
}

export const FRIEND_WORLD_FIXED_SPAWN = Object.freeze({ x: 0, z: 2.08 });

const FRIEND_WORLD_SPAWN_VARIANTS = [
  { x: 1.35, z: 0 },
  { x: 1.35, z: 0.24 },
  { x: 1.35, z: -0.24 },
] as const;

export interface FriendWorldSpawnInput {
  reason: FriendWorldSpawnReason;
  fixedSpawn: WorldPoint;
  memoryPosition?: WorldPoint | null;
}

function isFiniteWorldPoint(value: WorldPoint | null | undefined): value is WorldPoint {
  return Boolean(value) && Number.isFinite(value.x) && Number.isFinite(value.z);
}

function copyPoint(point: WorldPoint): WorldPoint {
  return { x: point.x, z: point.z };
}

function stableProfileHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getFriendWorldSpawnPosition(input: {
  mode: FriendWorldVisitMode;
  childProfileId: string;
  worldOwnerChildProfileId?: string;
  fixedSpawn?: WorldPoint;
}): WorldPoint {
  const fixedSpawn = input.fixedSpawn ?? FRIEND_WORLD_FIXED_SPAWN;
  if (!isFiniteWorldPoint(fixedSpawn) || !input.childProfileId.trim()) {
    throw new TypeError('好友世界多人出生點參數無效。');
  }
  const mode = input.worldOwnerChildProfileId
    ? getFriendWorldVisitMode({ viewerChildProfileId: input.childProfileId, worldOwnerChildProfileId: input.worldOwnerChildProfileId })
    : input.mode;
  const variant = FRIEND_WORLD_SPAWN_VARIANTS[stableProfileHash(input.childProfileId) % FRIEND_WORLD_SPAWN_VARIANTS.length];
  return {
    x: fixedSpawn.x + (mode === 'owner' ? -variant.x : variant.x),
    z: fixedSpawn.z + variant.z,
  };
}

export const getFriendWorldMultiplayerSpawnPosition = getFriendWorldSpawnPosition;

export function getFriendWorldReloadSpawnDecision(input: FriendWorldSpawnInput): FriendWorldSpawnDecision {
  if (!isFiniteWorldPoint(input.fixedSpawn)) {
    throw new TypeError('好友世界固定出生點無效。');
  }
  const canReuseMemory = input.reason === 'short_reconnect' && isFiniteWorldPoint(input.memoryPosition);
  return {
    position: copyPoint(canReuseMemory ? input.memoryPosition : input.fixedSpawn),
    source: canReuseMemory ? 'memory' : 'fixed_spawn',
    clearMemoryPosition: input.reason !== 'short_reconnect',
    shouldRebroadcast: true,
  };
}

export const decideFriendWorldSpawn = getFriendWorldReloadSpawnDecision;
export const getReloadSpawnDecision = getFriendWorldReloadSpawnDecision;
