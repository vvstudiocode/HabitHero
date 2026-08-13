import type { ChildGameData } from './contracts';

export function patchPetDisplayName(
  gameData: ChildGameData,
  inventoryItemId: string,
  displayName: string | null,
): ChildGameData {
  const normalizedName = displayName?.trim() || null;
  return {
    ...gameData,
    inventory: gameData.inventory.map((inventory) => inventory.id === inventoryItemId
      ? { ...inventory, displayName: normalizedName }
      : inventory),
    worldEntities: gameData.worldEntities.map((entity) => entity.inventoryItemId === inventoryItemId && entity.entityKind === 'pet'
      ? { ...entity, displayName: normalizedName ?? undefined }
      : entity),
  };
}
