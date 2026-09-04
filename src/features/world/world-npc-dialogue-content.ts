import { CLOUD_TIDE_DIALOGUE } from './world-npc-dialogue-cloud-tide';
import { STAR_SAND_DIALOGUE } from './world-npc-dialogue-star-sand';
import { SUNRISE_FOREST_DIALOGUE } from './world-npc-dialogue-sunrise-forest';
import type {
  WorldNpcDialogueContent,
  WorldNpcDialogueContentContext,
  WorldNpcDialogueRepeatCondition,
  WorldNpcDialogueRepeatLine,
} from './world-npc-dialogue-types';

export type {
  WorldNpcDialogueChoice,
  WorldNpcDialogueContent,
  WorldNpcDialogueContentContext,
  WorldNpcDialogueRepeatCondition,
  WorldNpcDialogueRepeatLine,
} from './world-npc-dialogue-types';

const WORLD_NPC_DIALOGUE_CONTENT: Readonly<Record<string, WorldNpcDialogueContent>> = {
  ...SUNRISE_FOREST_DIALOGUE,
  ...CLOUD_TIDE_DIALOGUE,
  ...STAR_SAND_DIALOGUE,
};

export const WORLD_RICH_DIALOGUE_NPC_IDS = Object.freeze(Object.keys(WORLD_NPC_DIALOGUE_CONTENT));

const OWNED_DIALOGUE_CATALOG_IDS: Partial<Record<WorldNpcDialogueRepeatCondition, string>> = {
  owns_oum: 'pet.oum',
  owns_arcadia: 'pet.arcadia',
  owns_jasmine: 'pet.jasmine',
  owns_qifu_er: 'pet.qifu-er',
  owns_nibus: 'pet.nibus',
  owns_orian: 'pet.orian',
  owns_christo: 'pet.christo',
  owns_kaldo: 'pet.kaldo',
  owns_moko: 'pet.moko',
};

function matchesRepeatCondition(
  condition: WorldNpcDialogueRepeatCondition | undefined,
  context: WorldNpcDialogueContentContext,
): boolean {
  if (!condition) return true;
  const ownedCatalogItemIds = new Set(context.ownedCatalogItemIds ?? []);
  if (condition === 'completed_adventure_today') return context.hasCompletedAdventureToday === true;
  if (condition === 'not_completed_adventure_today') return context.hasCompletedAdventureToday !== true;
  const catalogItemId = OWNED_DIALOGUE_CATALOG_IDS[condition];
  return catalogItemId ? ownedCatalogItemIds.has(catalogItemId) : false;
}

export function getWorldNpcDialogueContent(npcId: string): WorldNpcDialogueContent | undefined {
  return WORLD_NPC_DIALOGUE_CONTENT[npcId];
}

export function getWorldNpcRepeatDialogueLines(
  npcId: string,
  context: WorldNpcDialogueContentContext,
): WorldNpcDialogueRepeatLine[] {
  const content = getWorldNpcDialogueContent(npcId);
  if (!content) return [];
  return content.repeat.filter((line) => matchesRepeatCondition(line.condition, context));
}
