import { getWorldSceneContent, getWorldSceneNpc } from './world-scene-content';
import type { ChildGameData } from './contracts';

export const LEGACY_PET_ASSET_KEYS = [
  'pet.forest-guardian',
  'pet.starlight-sprout',
  'pet.chrono-rabbit',
  'pet.silf-owl',
  'pet.yaoguang-deer',
  'pet.murphy-bear',
  'pet.magellan-rabbit',
  'pet.buleifu-tiger',
  'pet.belilos-fox',
  'pet.baruku-mushroom',
  'pet.star-diver',
] as const;

export interface CatalogShopItemInput {
  id?: string;
  itemType: 'character' | 'pet' | 'decoration';
  isActive: boolean;
  isStarter: boolean;
  assetKey?: string;
  isNewlyObtainable?: boolean;
}

export interface CatalogShopGateContext {
  unlockedSceneIds: readonly string[];
  talkedNpcIds: readonly string[];
  offerings: readonly CatalogShopOffering[];
}

export interface CatalogShopSource {
  catalogItemId?: string;
  sceneId: string;
  npcId: string;
  npcName: string;
  dialogueVersion?: number;
}

export interface CatalogShopOffering {
  catalogItemId: string;
  sceneId: string;
  npcId: string;
  npcName: string;
  dialogueVersion: number;
  isPrimarySource: boolean;
}

export interface CatalogShopState {
  visible: boolean;
  purchasable: boolean;
  reason: 'inactive' | 'starter' | 'legacy_pet' | 'scene_locked' | 'dialogue_required' | 'data_unavailable' | 'not_offered' | null;
  source?: CatalogShopSource;
}

export function getCatalogShopGateContext(
  gameData: Pick<ChildGameData, 'sceneUnlocks' | 'npcDialogueProgress'>,
): CatalogShopGateContext | undefined {
  const hydratedGameData = gameData as Pick<ChildGameData, 'sceneUnlocks' | 'npcDialogueProgress' | 'worldSceneDataStatus' | 'worldNpcOfferings'>;
  if (hydratedGameData.worldSceneDataStatus !== 'ready'
    || !hydratedGameData.sceneUnlocks
    || !hydratedGameData.npcDialogueProgress
    || !hydratedGameData.worldNpcOfferings) return undefined;
  return {
    unlockedSceneIds: gameData.sceneUnlocks.map((unlock) => unlock.sceneId),
    talkedNpcIds: gameData.npcDialogueProgress.map((dialogue) => dialogue.npcId),
    offerings: hydratedGameData.worldNpcOfferings
      .filter((offering) => offering.isActive)
      .map((offering) => ({
        catalogItemId: offering.catalogItemId,
        sceneId: offering.sceneId,
        npcId: offering.npcId,
        npcName: offering.npcName,
        dialogueVersion: offering.dialogueVersion,
        isPrimarySource: offering.isPrimarySource,
      })),
  };
}

function toCatalogShopSource(offering: CatalogShopOffering): CatalogShopSource {
  return {
    catalogItemId: offering.catalogItemId,
    sceneId: offering.sceneId,
    npcId: offering.npcId,
    npcName: offering.npcName,
    dialogueVersion: offering.dialogueVersion,
  };
}

function getCatalogShopOfferings(item: CatalogShopItemInput, gateContext: CatalogShopGateContext): CatalogShopOffering[] {
  if (!item.id) return [];
  return gateContext.offerings.filter((offering) => offering.catalogItemId === item.id);
}

function isPetNpcOffering(offering: CatalogShopOffering): boolean {
  return getWorldSceneNpc(offering.npcId)?.type === 'roaming_pet';
}

function getDisplayOffering(item: CatalogShopItemInput, offerings: readonly CatalogShopOffering[]): CatalogShopOffering | undefined {
  const eligibleOfferings = item.itemType === 'pet'
    ? offerings.filter(isPetNpcOffering)
    : offerings;
  return eligibleOfferings.find((offering) => offering.isPrimarySource) ?? eligibleOfferings[0];
}

function chooseCatalogShopOffering(
  offerings: readonly CatalogShopOffering[],
  talkedNpcIds: readonly string[],
  itemType: CatalogShopItemInput['itemType'],
): CatalogShopOffering | undefined {
  const eligibleOfferings = itemType === 'pet'
    ? offerings.filter(isPetNpcOffering)
    : offerings;
  const primary = eligibleOfferings.find((offering) => offering.isPrimarySource) ?? eligibleOfferings[0];
  if (!primary) return undefined;
  return eligibleOfferings.find((offering) => offering.isPrimarySource && talkedNpcIds.includes(offering.npcId))
    ?? eligibleOfferings.find((offering) => talkedNpcIds.includes(offering.npcId))
    ?? primary;
}

export function getCatalogShopState(
  item: CatalogShopItemInput,
  gateContext?: CatalogShopGateContext,
): CatalogShopState {
  if (!item.isActive) return { visible: false, purchasable: false, reason: 'inactive' };
  if (item.isStarter) return { visible: false, purchasable: false, reason: 'starter' };
  if (item.itemType === 'pet' && item.isNewlyObtainable === false) {
    return { visible: false, purchasable: false, reason: 'legacy_pet' };
  }
  if (!gateContext) return { visible: false, purchasable: false, reason: 'data_unavailable' };
  const offerings = getCatalogShopOfferings(item, gateContext);
  const displayOffering = getDisplayOffering(item, offerings);
  if (!displayOffering) return { visible: false, purchasable: false, reason: 'not_offered' };
  const displaySource = toCatalogShopSource(displayOffering);
  if (!gateContext.unlockedSceneIds.includes(displayOffering.sceneId)) {
    return { visible: true, purchasable: false, reason: 'scene_locked', source: displaySource };
  }
  const sourceOffering = chooseCatalogShopOffering(offerings, gateContext.talkedNpcIds, item.itemType);
  if (!sourceOffering || !gateContext.talkedNpcIds.includes(sourceOffering.npcId)) {
    return { visible: true, purchasable: false, reason: 'dialogue_required', source: displaySource };
  }
  return { visible: true, purchasable: true, reason: null, source: toCatalogShopSource(sourceOffering) };
}

export function getCatalogShopPurchaseSource(
  item: CatalogShopItemInput,
  gateContext: CatalogShopGateContext | undefined,
): string | undefined {
  if (!gateContext) return undefined;
  const state = getCatalogShopState(item, gateContext);
  return state.purchasable ? state.source?.npcId : undefined;
}

export function getCatalogShopSourceLabel(
  item: CatalogShopItemInput,
  gateContext?: CatalogShopGateContext,
): string | undefined {
  const source = getCatalogShopState(item, gateContext).source;
  return source ? getItemSourceLabel(source) : undefined;
}

export interface ItemSourceSnapshot {
  sourceSceneId: string;
  sourceNpcId: string;
  sourceDialogueVersion: number;
}

export function toItemSourceSnapshot(sceneId: string, npcId: string, dialogueVersion: number): ItemSourceSnapshot {
  return { sourceSceneId: sceneId, sourceNpcId: npcId, sourceDialogueVersion: dialogueVersion };
}

export function getItemSourceLabel(source: { sceneId: string; npcName: string } | null): string {
  if (!source) return '早期取得';
  const sceneName = getWorldSceneContent(source.sceneId)?.name ?? source.sceneId;
  return `${sceneName}，找${source.npcName}`;
}

export function getInventorySourceLabel(
  sourceSceneId?: string | null,
  sourceNpcId?: string | null,
  context?: Pick<ChildGameData, 'worldScenes' | 'worldNpcs'>,
): string {
  const npcName = context?.worldNpcs?.find((npc) => npc.id === sourceNpcId)?.name
    ?? (sourceNpcId ? getWorldSceneNpc(sourceNpcId)?.name ?? sourceNpcId : null);
  if (!sourceSceneId || !npcName) return getItemSourceLabel(null);
  const sceneName = context?.worldScenes?.find((scene) => scene.id === sourceSceneId)?.name
    ?? getWorldSceneContent(sourceSceneId)?.name
    ?? sourceSceneId;
  return `${sceneName}，找${npcName}`;
}

export function getPrimaryOfferingSource(assetKey: string): CatalogShopSource | null {
  const scene = getWorldSceneContent(
    getWorldSceneContentIds().find((sceneId) => getWorldSceneContent(sceneId)?.offerings.some((offering) => offering.assetKey === assetKey)),
  );
  const offering = scene?.offerings.find((candidate) => candidate.assetKey === assetKey && candidate.isPrimarySource);
  const npc = offering ? getWorldSceneNpc(offering.npcId) : undefined;
  return scene && npc ? { sceneId: scene.id, npcId: npc.id, npcName: npc.name } : null;
}

function getWorldSceneContentIds(): string[] {
  return ['sunrise-village', 'forest-valley', 'cloud-workshop', 'tideglow-archipelago', 'star-sand-wasteland'];
}
