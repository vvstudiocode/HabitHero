import type {
  ChildGameData,
  ChildWorldEntity,
  WorldMutationPayload,
  WorldMutationResult,
  WorldTransformMutationPayload,
} from './contracts';

function withRevision(gameData: ChildGameData, worldEntities: ChildWorldEntity[]): ChildGameData {
  return { ...gameData, worldEntities, worldRevision: gameData.worldRevision + 1 };
}

function findCatalogAndInventory(gameData: ChildGameData, inventoryItemId: string) {
  const inventory = gameData.inventory.find((item) => item.id === inventoryItemId);
  const catalog = inventory ? gameData.catalog.find((item) => item.id === inventory.catalogItemId) : undefined;
  return { inventory, catalog };
}

export function patchPlacedWorldEntity(
  gameData: ChildGameData,
  payload: WorldMutationPayload,
  localEntityId: string,
): ChildGameData {
  if (!payload.transform) return gameData;
  const { inventory, catalog } = findCatalogAndInventory(gameData, payload.inventoryItemId);
  if (!inventory || !catalog) return gameData;
  const entity: ChildWorldEntity = {
    id: localEntityId,
    inventoryItemId: inventory.id,
    entityKind: catalog.itemType === 'pet' ? 'pet' : 'decoration',
    worldLayoutVersion: 1,
    behaviorMode: payload.behaviorMode ?? (catalog.itemType === 'decoration' ? 'static' : 'idle'),
    roamingSlot: payload.roamingSlot ?? null,
    isActive: true,
    catalogItemId: catalog.id,
    collisionRadius: catalog.collisionRadius,
    assetKey: catalog.assetKey,
    name: catalog.name,
    displayName: inventory.displayName ?? undefined,
    ...payload.transform,
  };
  return withRevision(gameData, [...gameData.worldEntities, entity]);
}

export function patchUpdatedWorldEntity(
  gameData: ChildGameData,
  payload: WorldTransformMutationPayload,
): ChildGameData {
  const index = payload.entityId
    ? gameData.worldEntities.findIndex((entity) => entity.id === payload.entityId && entity.isActive)
    : gameData.worldEntities.findIndex((entity) => entity.inventoryItemId === payload.inventoryItemId && entity.isActive);
  if (index < 0) return gameData;
  const worldEntities = [...gameData.worldEntities];
  worldEntities[index] = { ...worldEntities[index], ...payload.transform };
  return withRevision(gameData, worldEntities);
}

export function patchRemovedWorldEntity(
  gameData: ChildGameData,
  inventoryItemId: string,
  entityId?: string,
): ChildGameData {
  const worldEntities = gameData.worldEntities.map((entity) => {
    const matches = entity.isActive
      && entity.inventoryItemId === inventoryItemId
      && (!entityId || entity.id === entityId);
    return matches ? { ...entity, isActive: false, behaviorMode: 'idle' as const, roamingSlot: null } : entity;
  });
  return worldEntities.some((entity, index) => entity !== gameData.worldEntities[index])
    ? withRevision(gameData, worldEntities)
    : gameData;
}

export function patchCollectedWorldDecorations(gameData: ChildGameData): ChildGameData {
  const worldEntities = gameData.worldEntities.map((entity) => entity.entityKind === 'decoration' && entity.isActive
    ? { ...entity, isActive: false, behaviorMode: 'idle' as const, roamingSlot: null }
    : entity);
  return worldEntities.some((entity, index) => entity !== gameData.worldEntities[index])
    ? withRevision(gameData, worldEntities)
    : gameData;
}

export function reconcilePlacedWorldEntity(
  gameData: ChildGameData,
  localEntityId: string,
  result: WorldMutationResult,
): ChildGameData {
  const worldEntities = result.entity
    ? gameData.worldEntities.map((entity) => entity.id === localEntityId ? { ...entity, ...result.entity } : entity)
    : gameData.worldEntities;
  return { ...gameData, worldEntities, worldRevision: result.revision };
}

export function reconcileUpdatedWorldEntity(
  gameData: ChildGameData,
  result: WorldMutationResult,
): ChildGameData {
  const worldEntities = result.entity
    ? gameData.worldEntities.map((entity) => entity.id === result.entity?.id ? { ...entity, ...result.entity } : entity)
    : gameData.worldEntities;
  return { ...gameData, worldEntities, worldRevision: result.revision };
}
