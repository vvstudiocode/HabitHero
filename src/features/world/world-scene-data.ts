import type { ChildGameData, GameCatalogItem } from './contracts';
import { getFollowingPetInventoryIds } from './following-pet-state';
import { getAdventureTableCatalogItem } from './adventure-table';

function uniqueCatalogItems(items: readonly (GameCatalogItem | undefined)[]): GameCatalogItem[] {
  const seen = new Set<string>();
  return items.filter((item): item is GameCatalogItem => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function getRequiredWorldPetCatalogItems(gameData: ChildGameData): GameCatalogItem[] {
  const catalogById = new Map(gameData.catalog.filter((item) => item.itemType === 'pet').map((item) => [item.id, item]));
  const catalogByAssetKey = new Map(gameData.catalog.filter((item) => item.itemType === 'pet').map((item) => [item.assetKey, item]));
  const inventoryById = new Map(gameData.inventory.map((item) => [item.id, item]));
  const followingItems = getFollowingPetInventoryIds(gameData).map((inventoryId) => {
    const inventory = inventoryById.get(inventoryId);
    return inventory ? catalogById.get(inventory.catalogItemId) : undefined;
  });
  const activeWorldItems = gameData.worldEntities
    .filter((entity) => entity.entityKind === 'pet' && entity.isActive)
    .map((entity) => {
      const inventory = inventoryById.get(entity.inventoryItemId);
      const catalogItemId = entity.catalogItemId ?? inventory?.catalogItemId;
      return (catalogItemId ? catalogById.get(catalogItemId) : undefined)
        ?? (entity.assetKey ? catalogByAssetKey.get(entity.assetKey) : undefined);
    });
  return uniqueCatalogItems([...followingItems, ...activeWorldItems]);
}

export function getRequiredWorldDecorationCatalogItems(
  gameData: ChildGameData,
  placementItem?: GameCatalogItem,
  options: { includeAdventureTable?: boolean } = {},
): GameCatalogItem[] {
  const activeDecorationIds = new Set(
    gameData.worldEntities
      .filter((entity) => entity.entityKind === 'decoration' && entity.isActive && entity.catalogItemId)
      .map((entity) => entity.catalogItemId),
  );
  const activeItems = gameData.catalog.filter((item) => item.itemType === 'decoration' && activeDecorationIds.has(item.id));
  return uniqueCatalogItems([
    ...activeItems,
    placementItem?.itemType === 'decoration' ? placementItem : undefined,
    options.includeAdventureTable === false ? undefined : getAdventureTableCatalogItem(gameData),
  ]);
}

export function createWorldSceneGameDataSnapshot(gameData: ChildGameData): ChildGameData {
  const followingPetInventoryIds = getFollowingPetInventoryIds(gameData);
  const followingPetInventories = followingPetInventoryIds
    .map((inventoryId) => gameData.inventory.find((inventory) => inventory.id === inventoryId))
    .filter((inventory): inventory is NonNullable<typeof inventory> => Boolean(inventory));
  const activeWorldPetInventoryIds = new Set(
    gameData.worldEntities
      .filter((entity) => entity.entityKind === 'pet' && entity.isActive)
      .map((entity) => entity.inventoryItemId),
  );
  const sceneInventory = gameData.inventory.filter((inventory) => (
    followingPetInventoryIds.includes(inventory.id) || activeWorldPetInventoryIds.has(inventory.id)
  ));
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
    inventory: sceneInventory.length > 0 ? sceneInventory : followingPetInventories,
    loadout: {
      equippedCharacterInventoryId: null,
      followingPetInventoryId: followingPetInventoryIds[0] ?? null,
      followingPetInventoryIds,
    },
    worldEntities: gameData.worldEntities,
    worldRevision: gameData.worldRevision,
  };
}
