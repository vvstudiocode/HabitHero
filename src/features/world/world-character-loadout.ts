import type { ChildGameData, GameCatalogItem } from './contracts';

export const DEFAULT_WORLD_CHARACTER: GameCatalogItem = {
  id: 'character.arthur',
  itemType: 'character',
  name: '亞瑟',
  description: '帶著溫暖笑容、勇敢踏上冒險的旅人。',
  scrollPrice: 9,
  assetKey: 'character.arthur',
  thumbnailUrl: '/assets/characters/arthur-thumbnail.webp',
  isActive: true,
  isStarter: true,
  isStackable: false,
  collisionRadius: 0.28,
  minScale: 0.9,
  maxScale: 1.1,
  sortOrder: 10,
  metadata: { model: '/assets/characters/arthur.glb', animation: 'Walk_InPlace' },
};

export function getEquippedCharacterCatalogItem(gameData: ChildGameData): GameCatalogItem {
  const equippedInventoryId = gameData.loadout?.equippedCharacterInventoryId;
  const equippedInventory = equippedInventoryId
    ? gameData.inventory.find((inventory) => inventory.id === equippedInventoryId)
    : undefined;
  const equippedItem = equippedInventory
    ? gameData.catalog.find((item) => item.id === equippedInventory.catalogItemId && item.itemType === 'character')
    : undefined;
  return equippedItem && equippedItem.isActive
    ? equippedItem
    : gameData.catalog.find((item) => item.itemType === 'character' && item.isActive && item.assetKey === DEFAULT_WORLD_CHARACTER.assetKey)
      ?? DEFAULT_WORLD_CHARACTER;
}

export function createCharacterFallbackCatalogItem(assetKey: string): GameCatalogItem {
  return {
    ...DEFAULT_WORLD_CHARACTER,
    id: assetKey,
    assetKey,
    name: assetKey,
  };
}
