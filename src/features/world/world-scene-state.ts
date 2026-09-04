import type {
  ChildGameData,
  WorldNpcDialogueProgress,
  WorldNpcOffering,
  WorldSceneUnlock,
} from './contracts';
import type {
  WorldNpcDialogueResult,
  WorldSceneUnlockResult,
} from './world-scene-data-access';

export function applyWorldSceneUnlockResult(
  gameData: ChildGameData,
  childProfileId: string,
  familyId: string,
  result: WorldSceneUnlockResult,
): ChildGameData {
  if (!result.unlocked || !gameData.sceneUnlocks) return gameData;
  if (gameData.sceneUnlocks.some((unlock) => unlock.sceneId === result.scene_id)) return gameData;
  const unlock: WorldSceneUnlock = {
    familyId,
    childProfileId,
    sceneId: result.scene_id,
    unlockRuleVersion: Number(result.unlock_rule_version),
    unlockedAt: result.unlocked_at,
  };
  return { ...gameData, sceneUnlocks: [...gameData.sceneUnlocks, unlock] };
}

function toDialogueProgress(
  current: WorldNpcDialogueProgress | undefined,
  familyId: string,
  childProfileId: string,
  result: WorldNpcDialogueResult,
): WorldNpcDialogueProgress {
  return {
    familyId: current?.familyId ?? familyId,
    childProfileId,
    npcId: result.npc_id,
    dialogueVersion: Number(result.dialogue_version),
    firstTalkedAt: current?.firstTalkedAt ?? new Date().toISOString(),
    lastTalkedAt: new Date().toISOString(),
  };
}

function mergeDialogueOfferings(
  gameData: ChildGameData,
  result: WorldNpcDialogueResult,
): WorldNpcOffering[] {
  const existingOfferings = gameData.worldNpcOfferings ?? [];
  const npc = gameData.worldNpcs?.find((candidate) => candidate.id === result.npc_id);
  const scene = npc ? gameData.worldScenes?.find((candidate) => candidate.id === npc.sceneId) : undefined;
  const existing = new Map(existingOfferings.map((offering) => [
    `${offering.npcId}:${offering.catalogItemId}`,
    offering,
  ]));
  if (!npc || !scene) return existingOfferings;
  result.offerings.forEach((offering) => {
    const key = `${result.npc_id}:${offering.catalog_item_id}`;
    if (existing.has(key)) return;
    existing.set(key, {
      sceneId: offering.source_scene_id,
      sceneName: scene.name,
      npcId: offering.source_npc_id,
      npcName: npc.name,
      catalogItemId: offering.catalog_item_id,
      sortOrder: Number(offering.sort_order),
      dialogueVersion: Number(offering.source_dialogue_version),
      isPrimarySource: false,
      isActive: true,
    });
  });
  return [...existing.values()];
}

export function applyWorldNpcDialogueResult(
  gameData: ChildGameData,
  childProfileId: string,
  familyId: string,
  result: WorldNpcDialogueResult,
): ChildGameData {
  if (!gameData.npcDialogueProgress) return gameData;
  const current = gameData.npcDialogueProgress.find((progress) => progress.npcId === result.npc_id);
  const progress = toDialogueProgress(current, familyId, childProfileId, result);
  const nextProgress = current
    ? gameData.npcDialogueProgress.map((item) => item.npcId === result.npc_id ? progress : item)
    : [...gameData.npcDialogueProgress, progress];
  const nextOfferings = mergeDialogueOfferings(gameData, result);
  return {
    ...gameData,
    npcDialogueProgress: nextProgress,
    worldNpcOfferings: nextOfferings,
  };
}
