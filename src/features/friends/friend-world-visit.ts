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
