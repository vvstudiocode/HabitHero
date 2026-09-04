import type {
  ChildGameData,
  WorldNpcDialogueProgress,
  WorldNpcOffering,
  WorldNpcSummary,
  WorldSceneSummary,
  WorldSceneUnlock,
} from './contracts';
import type {
  WorldNpcDialogueProgressRow,
  WorldSceneState,
  WorldSceneUnlockRow,
} from './world-scene-data-access';

function toWorldSceneSummaries(state: WorldSceneState): WorldSceneSummary[] {
  return state.scenes.map((scene) => ({
    id: scene.id,
    name: scene.name,
    sortOrder: Number(scene.sort_order),
    requiredCompletedCount: Number(scene.required_completed_count),
    requiredGeneralCount: Number(scene.required_general_count),
    unlockRuleVersion: Number(scene.unlock_rule_version),
    isActive: scene.is_active,
  }));
}

function toWorldNpcSummaries(state: WorldSceneState): WorldNpcSummary[] {
  return state.npcs.map((npc) => ({
    id: npc.id,
    sceneId: npc.scene_id,
    npcType: npc.npc_type,
    name: npc.name,
    assetKey: npc.asset_key,
    catalogItemId: npc.catalog_item_id,
    position: { x: Number(npc.position_x), y: Number(npc.position_y), z: Number(npc.position_z) },
    behaviorMode: npc.behavior_mode,
    animationName: npc.animation_name,
    roamBounds: npc.roam_bounds,
    isActive: npc.is_active,
  }));
}

function toWorldNpcOfferings(state: WorldSceneState): WorldNpcOffering[] {
  const sceneById = new Map(state.scenes.map((scene) => [scene.id, scene]));
  const npcById = new Map(state.npcs.map((npc) => [npc.id, npc]));
  return state.offerings.flatMap((offering) => {
    const npc = npcById.get(offering.npc_id);
    const scene = npc ? sceneById.get(npc.scene_id) : undefined;
    if (!npc || !scene) return [];
    return [{
      sceneId: scene.id,
      sceneName: scene.name,
      npcId: npc.id,
      npcName: npc.name,
      catalogItemId: offering.catalog_item_id,
      sortOrder: Number(offering.sort_order),
      dialogueVersion: Number(offering.dialogue_version),
      isPrimarySource: offering.is_primary_source,
      isActive: offering.is_active,
    } satisfies WorldNpcOffering];
  });
}

function mapSceneUnlocks(rows: readonly WorldSceneUnlockRow[], childId: string): WorldSceneUnlock[] {
  return rows.filter((row) => row.child_profile_id === childId).map((row) => ({
    familyId: row.family_id,
    childProfileId: row.child_profile_id,
    sceneId: row.scene_id,
    unlockRuleVersion: Number(row.unlock_rule_version),
    unlockedAt: row.unlocked_at,
  }));
}

function mapDialogueProgress(rows: readonly WorldNpcDialogueProgressRow[], childId: string): WorldNpcDialogueProgress[] {
  return rows.filter((row) => row.child_profile_id === childId).map((row) => ({
    familyId: row.family_id,
    childProfileId: row.child_profile_id,
    npcId: row.npc_id,
    dialogueVersion: Number(row.dialogue_version),
    firstTalkedAt: row.first_talked_at,
    lastTalkedAt: row.last_talked_at,
  }));
}

export function hydrateWorldSceneGameData(
  data: ChildGameData,
  childId: string,
  sceneUnlockRows: WorldSceneUnlockRow[] | undefined,
  dialogueRows: WorldNpcDialogueProgressRow[] | undefined,
  worldSceneState: WorldSceneState | undefined,
): ChildGameData {
  const unlocks = sceneUnlockRows ?? worldSceneState?.unlocks;
  const dialogue = dialogueRows ?? worldSceneState?.dialogue;
  if (worldSceneState) {
    data.worldSceneDataStatus = 'ready';
    data.worldScenes = toWorldSceneSummaries(worldSceneState);
    data.worldNpcs = toWorldNpcSummaries(worldSceneState);
    data.worldNpcOfferings = toWorldNpcOfferings(worldSceneState);
  }
  if (unlocks !== undefined) data.sceneUnlocks = mapSceneUnlocks(unlocks, childId);
  if (dialogue !== undefined) data.npcDialogueProgress = mapDialogueProgress(dialogue, childId);
  return data;
}
