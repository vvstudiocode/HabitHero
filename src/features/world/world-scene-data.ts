import type { ChildGameData } from './contracts';
import { getFollowingPetInventoryIds } from './following-pet-state';

export function createWorldSceneGameDataSnapshot(gameData: ChildGameData): ChildGameData {
  const followingPetInventoryIds = getFollowingPetInventoryIds(gameData);
  const followingPetInventories = followingPetInventoryIds
    .map((inventoryId) => gameData.inventory.find((inventory) => inventory.id === inventoryId))
    .filter((inventory): inventory is NonNullable<typeof inventory> => Boolean(inventory));
  const followingPetCatalogIds = new Set(followingPetInventories.map((inventory) => inventory.catalogItemId));
  const activePetCatalogIds = new Set(
    gameData.worldEntities
      .filter((entity) => entity.entityKind === 'pet' && entity.isActive && entity.catalogItemId)
      .map((entity) => entity.catalogItemId),
  );
  const activePetAssetKeys = new Set(
    gameData.worldEntities
      .filter((entity) => entity.entityKind === 'pet' && entity.isActive && entity.assetKey)
      .map((entity) => entity.assetKey),
  );
  const activeDecorationCatalogIds = new Set(
    gameData.worldEntities
      .filter((entity) => entity.entityKind === 'decoration' && entity.isActive && entity.catalogItemId)
      .map((entity) => entity.catalogItemId),
  );
  const sceneCatalog = gameData.catalog.filter((item) => item.itemType === 'pet' && (
    followingPetCatalogIds.has(item.id)
    || activePetCatalogIds.has(item.id)
    || activePetAssetKeys.has(item.assetKey)
  ))
    .concat(gameData.catalog.filter((item) => item.itemType === 'decoration' && activeDecorationCatalogIds.has(item.id)));

  return {
    walletBalance: 0,
    catalog: sceneCatalog,
    prices: {},
    inventory: followingPetInventories,
    loadout: {
      equippedCharacterInventoryId: null,
      followingPetInventoryId: followingPetInventoryIds[0] ?? null,
      followingPetInventoryIds,
    },
    worldEntities: gameData.worldEntities,
    worldRevision: gameData.worldRevision,
  };
}
