import type { ChildGameData } from './contracts';

export function getFollowingPetInventoryIds(gameData: ChildGameData): string[] {
  const configured = gameData.loadout?.followingPetInventoryIds ?? [];
  const legacy = gameData.loadout?.followingPetInventoryId ? [gameData.loadout.followingPetInventoryId] : [];
  const candidateIds = configured.length > 0 ? configured : legacy;
  const petCatalogIds = new Set(gameData.catalog.filter((item) => item.itemType === 'pet').map((item) => item.id));
  const ownedIds = new Set(
    gameData.inventory
      .filter((inventory) => inventory.quantity > 0 && petCatalogIds.has(inventory.catalogItemId))
      .map((inventory) => inventory.id),
  );
  const seen = new Set<string>();

  return candidateIds.filter((inventoryId) => {
    if (seen.has(inventoryId) || !ownedIds.has(inventoryId)) return false;
    seen.add(inventoryId);
    return true;
  });
}

export function getNextFollowingPets(
  currentFollowingPetIds: readonly string[],
  inventoryItemId: string,
): string[] {
  return currentFollowingPetIds.includes(inventoryItemId)
    ? currentFollowingPetIds.filter((id) => id !== inventoryItemId)
    : [...currentFollowingPetIds, inventoryItemId];
}

/**
 * Selecting a pet makes it the first follower so the pet the child just
 * chose is immediately behind the player. Existing followers remain queued.
 */
export function selectFollowingPet(
  currentFollowingPetIds: readonly string[],
  inventoryItemId: string,
): string[] {
  return currentFollowingPetIds.includes(inventoryItemId)
    ? currentFollowingPetIds.filter((id) => id !== inventoryItemId)
    : [inventoryItemId, ...currentFollowingPetIds.filter((id) => id !== inventoryItemId)];
}
