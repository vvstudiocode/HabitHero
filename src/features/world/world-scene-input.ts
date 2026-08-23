import type { ChildGameData, GameCatalogItem } from './contracts';
import { createWorldSceneGameDataSnapshot } from './world-scene-data';
import { toDecorationPlacementTransform, type DecorationPlacementDraft } from './world-placement';
import type { WorldRuntimeSession } from './world-runtime-multiplayer';

interface TerrainWorldSceneInputArgs {
  gameData: ChildGameData;
  socialGameData?: ChildGameData;
  session?: WorldRuntimeSession | null;
  placement?: { catalogItemId: string; entityId?: string; draft: DecorationPlacementDraft };
  placementValid: boolean;
  showPetNames: boolean;
  dayNightEnabled: boolean;
  getEquippedCatalogItem: (gameData: ChildGameData) => GameCatalogItem | undefined;
  getCharacterRenderMode: (item: GameCatalogItem | undefined) => 'anime-maiden' | 'world-glb' | 'procedural';
  getWorldCharacterModelUrl: (item: GameCatalogItem | undefined) => string | undefined;
}

export function createTerrainWorldSceneInput({
  gameData,
  session,
  socialGameData,
  placement,
  placementValid,
  showPetNames,
  dayNightEnabled,
  getEquippedCatalogItem,
  getCharacterRenderMode,
  getWorldCharacterModelUrl,
}: TerrainWorldSceneInputArgs) {
  const sourceGameData = socialGameData ?? gameData;
  const equippedCatalogItem = getEquippedCatalogItem(sourceGameData);
  const placementItem = placement
    ? sourceGameData.catalog.find((item) => item.id === placement.catalogItemId && item.itemType === 'decoration')
    : undefined;
  return {
    gameData: createWorldSceneGameDataSnapshot(sourceGameData),
    equippedCatalogItem,
    characterRenderMode: getCharacterRenderMode(equippedCatalogItem),
    characterModelUrl: getWorldCharacterModelUrl(equippedCatalogItem),
    showPetNames,
    dayNightEnabled,
    session,
    placement: placement && placementItem ? {
      item: placementItem,
      entityId: placement.entityId,
      transform: toDecorationPlacementTransform(placement.draft),
      isValid: placementValid,
    } : undefined,
  };
}
