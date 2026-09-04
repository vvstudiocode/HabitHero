import {
  getWorldSceneContent,
  type WorldNpcContent,
  type WorldSceneId,
} from './world-scene-content';

export type RoamingNpcRuntimeState = 'roaming' | 'paused';
export type RoamingNpcDialogueAction = 'open' | 'close';

export interface NpcRuntimePlan {
  characterVendors: WorldNpcContent[];
  roamingPets: WorldNpcContent[];
}

export interface WorldNpcSelection {
  sceneId: WorldSceneId;
  npcId: string;
}

export interface WorldNpcScreenPosition extends WorldNpcSelection {
  npcType: 'character_vendor' | 'roaming_pet';
  npcName: string;
  x: number;
  y: number;
  scale: number;
}

export const WORLD_NPC_INTERACTION_ENTER_RADIUS = 1.1;
export const WORLD_NPC_INTERACTION_EXIT_RADIUS = WORLD_NPC_INTERACTION_ENTER_RADIUS;

export function isWorldNpcNearby(distance: number, wasNearby: boolean): boolean {
  if (!Number.isFinite(distance) || distance < 0) return false;
  return distance <= (wasNearby ? WORLD_NPC_INTERACTION_EXIT_RADIUS : WORLD_NPC_INTERACTION_ENTER_RADIUS);
}

export interface AmbientNpcDescriptor {
  id: string;
  sceneId?: WorldSceneId;
  scene_id?: WorldSceneId;
  isActive?: boolean;
}

export interface WorldNpcInteractionController {
  select: (npcId: string) => WorldNpcSelection | null;
  dispose: () => void;
}

/**
 * Keeps public NPC selection independent from the Three.js actor lifecycle.
 * The future actor adapter can feed the same selection contract without
 * making child-owned world entities or React state part of the runtime.
 */
export function createWorldNpcInteractionController(
  sceneId: WorldSceneId,
  npcs: readonly AmbientNpcDescriptor[],
): WorldNpcInteractionController {
  let disposed = false;
  const activeNpcIds = new Set(
    npcs.filter((npc) => (npc.sceneId ?? npc.scene_id) === sceneId && npc.isActive !== false).map((npc) => npc.id),
  );
  return {
    select: (npcId) => {
      if (disposed || !activeNpcIds.has(npcId)) return null;
      return { sceneId, npcId };
    },
    dispose: () => {
      disposed = true;
      activeNpcIds.clear();
    },
  };
}

export function createWorldNpcRuntimePlan(sceneId: WorldSceneId): NpcRuntimePlan {
  const npcs = getWorldSceneContent(sceneId)?.npcs ?? [];
  return {
    characterVendors: npcs.filter((npc) => npc.type === 'character_vendor'),
    roamingPets: npcs.filter((npc) => npc.type === 'roaming_pet'),
  };
}

export function getCharacterNpcAnimation(availableClipNames: readonly string[]): { animationName: 'Dance' | 'Idle'; usedFallback: boolean } {
  const hasDance = availableClipNames.some((clipName) => /dance/i.test(clipName));
  return hasDance ? { animationName: 'Dance', usedFallback: false } : { animationName: 'Idle', usedFallback: true };
}

export function transitionRoamingNpcDialogue(
  state: RoamingNpcRuntimeState,
  action: RoamingNpcDialogueAction,
): RoamingNpcRuntimeState {
  if (action === 'open') return 'paused';
  return state === 'paused' ? 'roaming' : state;
}
