import type { FriendWorldSnapshotEntity } from '../friends/friend-world-snapshot';
import type { ChildInventoryItem, ChildWorldEntity, GameCatalogItem } from '../world/contracts';

export interface SharedDecorationSceneData {
  catalog: GameCatalogItem[];
  inventory: ChildInventoryItem[];
  worldEntities: ChildWorldEntity[];
}

export function createSharedDecorationSceneData(input: {
  entities: readonly FriendWorldSnapshotEntity[];
  catalog: readonly GameCatalogItem[];
}): SharedDecorationSceneData {
  const catalogByAssetKey = new Map(input.catalog.filter((item) => item.itemType === 'decoration' && item.isActive).map((item) => [item.assetKey, item]));
  const catalog: GameCatalogItem[] = [];
  const inventory: ChildInventoryItem[] = [];
  const worldEntities: ChildWorldEntity[] = [];

  input.entities.forEach((entity) => {
    if (entity.entityKind !== 'decoration' || entity.isActive === false || entity.placementScope !== 'shared') return;
    const item = catalogByAssetKey.get(entity.assetKey);
    if (!item) return;
    catalog.push(item);
    const inventoryItemId = `shared-decoration-inventory:${entity.id}`;
    inventory.push({ id: inventoryItemId, catalogItemId: item.id, quantity: 1, acquiredVia: 'grant', acquiredAt: new Date(0).toISOString() });
    worldEntities.push({
      id: entity.id,
      inventoryItemId,
      entityKind: 'decoration',
      worldLayoutVersion: 1,
      behaviorMode: entity.behaviorMode,
      roamingSlot: null,
      isActive: true,
      catalogItemId: item.id,
      assetKey: entity.assetKey,
      name: item.name,
      x: entity.x,
      y: entity.y,
      z: entity.z,
      rotationX: entity.rotationX,
      rotationY: entity.rotationY,
      rotationZ: entity.rotationZ,
      scale: entity.scale,
    });
  });
  return { catalog: [...new Map(catalog.map((item) => [item.id, item])).values()], inventory, worldEntities };
}
