import type { ChildGameData } from './contracts';

export function patchEquippedCharacter(gameData: ChildGameData, inventoryItemId: string): ChildGameData {
  return {
    ...gameData,
    loadout: {
      equippedCharacterInventoryId: inventoryItemId,
      followingPetInventoryId: gameData.loadout?.followingPetInventoryId ?? null,
    },
  };
}
