import type { ChildGameData, ChildInventoryItem, ChildWorldEntity, GameCatalogItem } from '../world/contracts';
import type { FriendWorldSnapshot } from './friend-world-snapshot';
import { getFriendWorldPetPresentation } from './friend-world-pet-presentation';
import { getLocalDecorationRuntimeDefaults } from '../world/game-content-assets';

export function buildFriendWorldGameData(snapshot: FriendWorldSnapshot): ChildGameData {
  const characterInventoryId = `friend-character:${snapshot.worldOwnerChildProfileId}`;
  const character: GameCatalogItem = createCatalogItem(snapshot.characterAssetKey, 'character', snapshot.displayName);
  const inventory: ChildInventoryItem[] = [{
    id: characterInventoryId,
    catalogItemId: character.id,
    quantity: 1,
    acquiredVia: 'starter',
    acquiredAt: new Date(0).toISOString(),
  }];
  const entities: ChildWorldEntity[] = snapshot.entities.map((entity) => {
    const catalogItemId = `friend-asset:${entity.assetKey}`;
    const inventoryItemId = `friend-entity:${entity.id}`;
    const petPresentation = entity.entityKind === 'pet' ? getFriendWorldPetPresentation(entity.assetKey) : undefined;
    const displayName = entity.displayName ?? petPresentation?.displayName;
    inventory.push({
      id: inventoryItemId,
      catalogItemId,
      quantity: 1,
      acquiredVia: 'starter',
      acquiredAt: new Date(0).toISOString(),
      displayName: entity.displayName,
    });
    return {
      id: entity.id,
      inventoryItemId,
      catalogItemId,
      entityKind: entity.entityKind,
      worldLayoutVersion: 1,
      behaviorMode: entity.behaviorMode,
      roamingSlot: null,
      isActive: true,
      assetKey: entity.assetKey,
      name: displayName ?? entity.assetKey,
      displayName,
      placementScope: entity.placementScope,
      canTransform: entity.canTransform,
      canRemove: entity.canRemove,
      sharedByMe: entity.sharedByMe,
      sharedSourceDisplayName: entity.sharedSourceDisplayName,
      x: entity.x,
      y: entity.y,
      z: entity.z,
      rotationX: entity.rotationX,
      rotationY: entity.rotationY,
      rotationZ: entity.rotationZ,
      scale: entity.scale,
    };
  });
  return {
    walletBalance: 0,
    catalog: [character, ...snapshot.entities.map((entity) => createCatalogItem(entity.assetKey, entity.entityKind, entity.displayName))],
    prices: {},
    inventory,
    loadout: { equippedCharacterInventoryId: characterInventoryId, followingPetInventoryId: null, followingPetInventoryIds: [] },
    worldEntities: entities,
    worldRevision: snapshot.revision,
  };
}

function createCatalogItem(assetKey: string, itemType: 'character' | 'pet' | 'decoration', displayName?: string): GameCatalogItem {
  const petPresentation = itemType === 'pet' ? getFriendWorldPetPresentation(assetKey) : undefined;
  const decorationPresentation = itemType === 'decoration' ? getLocalDecorationRuntimeDefaults(assetKey) : undefined;
  return {
    id: itemType === 'character' ? assetKey : `friend-asset:${assetKey}`,
    itemType,
    name: displayName?.trim() || petPresentation?.displayName || assetKey,
    description: '好友世界公開資產',
    scrollPrice: 0,
    assetKey,
    thumbnailUrl: null,
    isActive: true,
    isStarter: true,
    isStackable: false,
    collisionRadius: decorationPresentation?.collisionRadius ?? 0.28,
    minScale: 0.25,
    maxScale: 3,
    sortOrder: 0,
    metadata: decorationPresentation?.metadata ?? petPresentation?.metadata ?? {},
  };
}
