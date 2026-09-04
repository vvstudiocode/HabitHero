import { getWorldSceneNpc, getWorldSceneNpcOfferings, type WorldNpcOfferingContent } from './world-scene-content';

export type NpcDialogueBlockReason = 'scene_locked' | 'talk_required' | null;

export interface NpcDialogueState {
  canTalk: boolean;
  canShop: boolean;
  reason: NpcDialogueBlockReason;
}

export interface NpcDialogueContext {
  sceneUnlocked: boolean;
  talked: boolean;
}

export function isNpcDialogueOfferingVisible(
  npcType: 'character_vendor' | 'roaming_pet',
  itemType: 'character' | 'pet' | 'decoration',
): boolean {
  return npcType === 'roaming_pet'
    ? itemType === 'pet'
    : itemType === 'character' || itemType === 'decoration';
}

export function getNpcDialogueState(context: NpcDialogueContext): NpcDialogueState {
  if (!context.sceneUnlocked) return { canTalk: false, canShop: false, reason: 'scene_locked' };
  if (!context.talked) return { canTalk: true, canShop: false, reason: 'talk_required' };
  return { canTalk: true, canShop: true, reason: null };
}

export function getNpcOfferingsAfterDialogue(
  npcId: string,
  context: NpcDialogueContext,
): WorldNpcOfferingContent[] {
  const npc = getWorldSceneNpc(npcId);
  return npc && getNpcDialogueState(context).canShop ? getWorldSceneNpcOfferings(npcId) : [];
}

export function buildNpcDialogueCompletionPayload(npcId: string, childProfileId: string) {
  return { target_npc_id: npcId, target_child_profile_id: childProfileId };
}
