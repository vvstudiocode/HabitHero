import type { ChildGameData } from '../contracts';

export const MAX_ROAMING_PETS = 3;

export function getRoamablePetInventoryIds(gameData: ChildGameData): string[] {
  const followingPetInventoryId = gameData.loadout?.followingPetInventoryId ?? null;
  const petCatalogIds = new Set(
    gameData.catalog.filter((item) => item.itemType === 'pet' && item.isActive).map((item) => item.id),
  );

  return gameData.inventory
    .filter((inventory) => inventory.quantity > 0)
    .filter((inventory) => petCatalogIds.has(inventory.catalogItemId))
    .filter((inventory) => inventory.id !== followingPetInventoryId)
    .map((inventory) => inventory.id);
}

export function getRoamingPetSnapshot(gameData: ChildGameData): string[] {
  const roamablePetIds = new Set(getRoamablePetInventoryIds(gameData));
  const seen = new Set<string>();

  return [...gameData.worldEntities]
    .filter((entity) => entity.entityKind === 'pet')
    .filter((entity) => entity.behaviorMode === 'wander' && entity.isActive)
    .filter((entity) => roamablePetIds.has(entity.inventoryItemId))
    .sort((left, right) => (left.roamingSlot ?? Number.MAX_SAFE_INTEGER) - (right.roamingSlot ?? Number.MAX_SAFE_INTEGER))
    .map((entity) => entity.inventoryItemId)
    .filter((inventoryItemId) => {
      if (seen.has(inventoryItemId)) return false;
      seen.add(inventoryItemId);
      return true;
    })
    .slice(0, MAX_ROAMING_PETS);
}

export function getNextRoamingPets(
  currentRoamingPetIds: string[],
  inventoryItemId: string,
  roamablePetIds: readonly string[],
): string[] {
  if (!roamablePetIds.includes(inventoryItemId)) return currentRoamingPetIds;
  if (currentRoamingPetIds.includes(inventoryItemId)) {
    return currentRoamingPetIds.filter((id) => id !== inventoryItemId);
  }
  if (currentRoamingPetIds.length >= MAX_ROAMING_PETS) return currentRoamingPetIds;
  return [...currentRoamingPetIds, inventoryItemId];
}
