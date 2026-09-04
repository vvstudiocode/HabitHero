import type { WorldLocation } from './world-location';

export type WorldSceneId = Exclude<WorldLocation, 'my-world'>;
export type WorldNpcType = 'character_vendor' | 'roaming_pet';
export type WorldNpcBehavior = 'dance_anchor' | 'roaming';

export interface WorldNpcOfferingContent {
  npcId: string;
  assetKey: string;
  sortOrder: number;
  isPrimarySource: boolean;
}

export interface WorldNpcContent {
  id: string;
  sceneId: WorldSceneId;
  type: WorldNpcType;
  name: string;
  assetKey: string;
  position: { x: number; y: number; z: number };
  behavior: WorldNpcBehavior;
  animationName: string;
  roamBounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  catalogItemAssetKey?: string;
}

export interface WorldSceneContent {
  id: WorldSceneId;
  name: string;
  sortOrder: number;
  requiredCompletedCount: number;
  requiredGeneralCount: number;
  unlockRuleVersion: number;
  npcs: readonly WorldNpcContent[];
  offerings: readonly WorldNpcOfferingContent[];
}

interface WorldNpcRoamBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const ROAM_BOUNDS: WorldNpcRoamBounds = { minX: -6, maxX: 6, minZ: -4, maxZ: 4 };
// Keep Arcadia in the open plaza to the right of the notice board. The
// rectangle leaves a full-radius buffer from the board while still giving
// the pet enough room to patrol instead of repeatedly steering into it.
const SUNRISE_ARCADIA_ROAM_BOUNDS: WorldNpcRoamBounds = { minX: 3.1, maxX: 5.8, minZ: -2.7, maxZ: 1.7 };

function vendor(
  id: string,
  sceneId: WorldSceneId,
  name: string,
  assetKey: string,
  x: number,
  z: number,
): WorldNpcContent {
  return {
    id,
    sceneId,
    type: 'character_vendor',
    name,
    assetKey,
    position: { x, y: 0, z },
    behavior: 'dance_anchor',
    animationName: 'Dance',
  };
}

function roamingPet(
  id: string,
  sceneId: WorldSceneId,
  name: string,
  assetKey: string,
  x: number,
  z: number,
  roamBounds: WorldNpcRoamBounds = ROAM_BOUNDS,
): WorldNpcContent {
  return {
    id,
    sceneId,
    type: 'roaming_pet',
    name,
    assetKey,
    catalogItemAssetKey: assetKey,
    position: { x, y: 0, z },
    behavior: 'roaming',
    animationName: 'Idle',
    roamBounds,
  };
}

function offerings(npcId: string, assetKeys: readonly string[]): WorldNpcOfferingContent[] {
  return assetKeys.map((assetKey, index) => ({
    npcId,
    assetKey,
    sortOrder: index + 1,
    isPrimarySource: true,
  }));
}

export const WORLD_SCENE_CONTENT: readonly WorldSceneContent[] = [
  {
    id: 'sunrise-village', name: '晨光村', sortOrder: 1,
    requiredCompletedCount: 0, requiredGeneralCount: 0, unlockRuleVersion: 1,
    npcs: [
      vendor('npc.gilt', 'sunrise-village', '吉爾特', 'character.gilt', 0, -2),
      roamingPet('npc.oum', 'sunrise-village', '歐姆', 'pet.oum', -3, 1),
      roamingPet('npc.arcadia', 'sunrise-village', '阿卡迪亞', 'pet.arcadia', 4.1, -1.7, SUNRISE_ARCADIA_ROAM_BOUNDS),
    ],
    offerings: offerings('npc.gilt', [
      'character.gilt', 'pet.oum', 'pet.arcadia', 'decoration.bed',
      'decoration.nightstand', 'decoration.sofa', 'decoration.pawprint-rug',
    ]),
  },
  {
    id: 'forest-valley', name: '森語谷', sortOrder: 2,
    requiredCompletedCount: 5, requiredGeneralCount: 0, unlockRuleVersion: 1,
    npcs: [
      vendor('npc.moss', 'forest-valley', '莫斯', 'character.moss', -2, -1),
      vendor('npc.lunalia', 'forest-valley', '露娜莉亞', 'character.lunalia', 2, -1),
      roamingPet('npc.jasmine', 'forest-valley', '茉莉', 'pet.jasmine', -3, 1),
      roamingPet('npc.qifu-er', 'forest-valley', '齊福爾', 'pet.qifu-er', 3, 1),
    ],
    offerings: [
      ...offerings('npc.moss', ['character.moss', 'pet.jasmine', 'pet.qifu-er', 'decoration.stone-fire-pit']),
      ...offerings('npc.lunalia', ['character.lunalia', 'decoration.fountain', 'decoration.patchwork-rug', 'decoration.wall']),
    ],
  },
  {
    id: 'cloud-workshop', name: '雲工房', sortOrder: 3,
    requiredCompletedCount: 12, requiredGeneralCount: 2, unlockRuleVersion: 1,
    npcs: [
      vendor('npc.noah', 'cloud-workshop', '諾亞', 'character.noah', 0, -2),
      roamingPet('npc.nibus', 'cloud-workshop', '尼布斯', 'pet.nibus', -3, 1),
      roamingPet('npc.orian', 'cloud-workshop', '奧利安', 'pet.orian', 3, 1),
    ],
    offerings: offerings('npc.noah', [
      'character.noah', 'pet.nibus', 'pet.orian', 'decoration.computer-desk',
      'decoration.study-desk', 'decoration.study-chair', 'decoration.gaming-chair',
    ]),
  },
  {
    id: 'tideglow-archipelago', name: '潮光群島', sortOrder: 4,
    requiredCompletedCount: 20, requiredGeneralCount: 5, unlockRuleVersion: 1,
    npcs: [
      vendor('npc.collette', 'tideglow-archipelago', '柯蕾特', 'character.collette', 0, -2),
      roamingPet('npc.christo', 'tideglow-archipelago', '克里斯多', 'pet.christo', 0, 1),
    ],
    offerings: offerings('npc.collette', [
      'character.collette', 'pet.christo', 'decoration.blue-rug',
      'decoration.lavender-pattern-rug', 'decoration.floor-lamp',
    ]),
  },
  {
    id: 'star-sand-wasteland', name: '星砂荒原', sortOrder: 5,
    requiredCompletedCount: 30, requiredGeneralCount: 10, unlockRuleVersion: 1,
    npcs: [
      vendor('npc.violette', 'star-sand-wasteland', '薇歐莉特', 'character.violette', 0, -2),
      roamingPet('npc.kaldo', 'star-sand-wasteland', '卡爾多', 'pet.kaldo', -3, 1),
      roamingPet('npc.moko', 'star-sand-wasteland', '莫可', 'pet.moko', 3, 1),
    ],
    offerings: offerings('npc.violette', [
      'character.violette', 'pet.kaldo', 'pet.moko', 'decoration.bookcase',
      'decoration.curtain-wall', 'decoration.royal-crest-rug',
    ]),
  },
];

const sceneById = new Map(WORLD_SCENE_CONTENT.map((scene) => [scene.id, scene]));
const npcById = new Map(WORLD_SCENE_CONTENT.flatMap((scene) => scene.npcs).map((npc) => [npc.id, npc]));

export function getWorldSceneContent(sceneId: string | null | undefined): WorldSceneContent | undefined {
  return sceneId ? sceneById.get(sceneId as WorldSceneId) : undefined;
}

export function getWorldSceneNpc(npcId: string | null | undefined): WorldNpcContent | undefined {
  return npcId ? npcById.get(npcId) : undefined;
}

export function getWorldScenePrimaryOfferings(): WorldNpcOfferingContent[] {
  return WORLD_SCENE_CONTENT.flatMap((scene) => scene.offerings);
}

export function getWorldSceneNpcOfferings(npcId: string): WorldNpcOfferingContent[] {
  const npc = getWorldSceneNpc(npcId);
  if (!npc) return [];
  if (npc.type === 'roaming_pet' && npc.catalogItemAssetKey) {
    return [{ npcId, assetKey: npc.catalogItemAssetKey, sortOrder: 1, isPrimarySource: false }];
  }
  return getWorldSceneContent(npc.sceneId)?.offerings.filter((offering) => offering.npcId === npcId) ?? [];
}
