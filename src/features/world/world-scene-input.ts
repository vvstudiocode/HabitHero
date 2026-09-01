import { emptyChildGameData, type ChildGameData, type GameCatalogItem } from './contracts';
import { createWorldSceneGameDataSnapshot } from './world-scene-data';
import { toDecorationPlacementTransform, type DecorationPlacementDraft } from './world-placement';
import type { WorldRuntimeSession } from './world-runtime-multiplayer';
import { getFriendWorldSpawnPosition, getFriendWorldVisitMode } from '../friends/friend-world-visit';
import type { WorldLocation } from './world-location';
import type { WorldNavigationPoint } from './world-navigation';

type WorldSocialRuntimeSession = WorldRuntimeSession & {
  worldOwnerChildProfileId?: string;
  multiplayer?: WorldRuntimeSession['multiplayer'] & {
    childProfileId?: string;
    worldOwnerChildProfileId?: string;
  };
};

interface TerrainWorldSceneInputArgs {
  gameData: ChildGameData;
  worldLocation?: WorldLocation;
  entryPosition?: WorldNavigationPoint;
  entryFacingY?: number;
  entryCameraYaw?: number;
  socialGameData?: ChildGameData;
  session?: WorldSocialRuntimeSession | null;
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
  worldLocation = 'my-world',
  entryPosition,
  entryFacingY,
  entryCameraYaw,
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
  const sourceGameData = socialGameData ?? (worldLocation === 'my-world' ? gameData : emptyChildGameData());
  const sessionIdentity = session?.multiplayer;
  const worldOwnerChildProfileId = sessionIdentity?.worldOwnerChildProfileId ?? session?.worldOwnerChildProfileId;
  const childProfileId = sessionIdentity?.childProfileId;
  const sessionMode = childProfileId && worldOwnerChildProfileId
    ? getFriendWorldVisitMode({ viewerChildProfileId: childProfileId, worldOwnerChildProfileId })
    : undefined;
  const multiplayerSpawn = session && sessionMode && childProfileId
    ? getFriendWorldSpawnPosition({ mode: sessionMode, childProfileId, worldOwnerChildProfileId, fixedSpawn: session.fixedSpawn })
    : undefined;
  const runtimeSession = session && multiplayerSpawn
    ? { ...session, fixedSpawn: multiplayerSpawn }
    : session;
  const equippedCatalogItem = getEquippedCatalogItem(gameData);
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
    entryPosition,
    entryFacingY,
    entryCameraYaw,
    session: runtimeSession,
    placement: placement && placementItem ? {
      item: placementItem,
      entityId: placement.entityId,
      transform: toDecorationPlacementTransform(placement.draft),
      isValid: placementValid,
    } : undefined,
  };
}
