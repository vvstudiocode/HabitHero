import { getWorldSceneContent, type WorldSceneId } from './world-scene-content';

export interface WorldUnlockTask {
  status: string;
  adventureType?: string | null;
}

export interface WorldAdventureProgress {
  completedCount: number;
  generalCompletedCount: number;
}

export interface WorldSceneUnlockState extends WorldAdventureProgress {
  unlocked: boolean;
  remainingCompletedCount: number;
  remainingGeneralCompletedCount: number;
}

export interface WorldSceneEntryState extends WorldSceneUnlockState {
  persistedUnlock: boolean;
}

export interface ServerWorldSceneAccess {
  available: boolean;
  unlocked: boolean;
  reason: 'scene_data_unavailable' | 'scene_locked' | null;
}

export function getServerWorldSceneAccess(
  sceneId: WorldSceneId,
  scenes: readonly { id: string; isActive?: boolean }[] | undefined,
  persistedUnlocks: readonly { sceneId: string }[] | undefined,
): ServerWorldSceneAccess {
  const scene = scenes?.find((candidate) => candidate.id === sceneId && candidate.isActive !== false);
  if (!scene || !persistedUnlocks) {
    return { available: false, unlocked: false, reason: 'scene_data_unavailable' };
  }
  const unlocked = persistedUnlocks.some((unlock) => unlock.sceneId === sceneId);
  return { available: true, unlocked, reason: unlocked ? null : 'scene_locked' };
}

export function getWorldSceneProgress(tasks: readonly WorldUnlockTask[]): WorldAdventureProgress {
  const completed = tasks.filter((task) => task.status === 'completed');
  return {
    completedCount: completed.length,
    generalCompletedCount: completed.filter((task) => task.adventureType === 'general').length,
  };
}

export function isWorldSceneUnlocked(
  sceneId: WorldSceneId,
  progress: WorldAdventureProgress,
  permanentlyUnlockedSceneIds: readonly string[] = [],
): boolean {
  if (permanentlyUnlockedSceneIds.includes(sceneId)) return true;
  const scene = getWorldSceneContent(sceneId);
  return Boolean(scene
    && progress.completedCount >= scene.requiredCompletedCount
    && progress.generalCompletedCount >= scene.requiredGeneralCount);
}

export function getWorldSceneUnlockState(
  sceneId: WorldSceneId,
  progress: WorldAdventureProgress,
  permanentlyUnlockedSceneIds: readonly string[] = [],
): WorldSceneUnlockState {
  const scene = getWorldSceneContent(sceneId);
  const requiredCompletedCount = scene?.requiredCompletedCount ?? Number.POSITIVE_INFINITY;
  const requiredGeneralCount = scene?.requiredGeneralCount ?? Number.POSITIVE_INFINITY;
  return {
    ...progress,
    unlocked: isWorldSceneUnlocked(sceneId, progress, permanentlyUnlockedSceneIds),
    remainingCompletedCount: Math.max(0, requiredCompletedCount - progress.completedCount),
    remainingGeneralCompletedCount: Math.max(0, requiredGeneralCount - progress.generalCompletedCount),
  };
}

export function getWorldSceneEntryState(
  sceneId: WorldSceneId,
  progress: WorldAdventureProgress,
  persistedUnlock: boolean,
): WorldSceneEntryState {
  const state = getWorldSceneUnlockState(sceneId, progress);
  return { ...state, persistedUnlock, unlocked: persistedUnlock || state.unlocked };
}
