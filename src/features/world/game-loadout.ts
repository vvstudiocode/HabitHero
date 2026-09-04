import type { ChildGameData, GamePurchaseResult, WorldTransform } from './contracts';

export type RoamingPetPositionOverrides = Readonly<Record<string, WorldTransform>>;

export interface OptimisticPurchaseDraft {
  catalogItemId: string;
  quantity: number;
  localInventoryItemId: string;
  acquiredAt: string;
  existingInventoryItemId?: string | null;
  existingQuantityBefore?: number;
  totalPrice?: number;
  sourceSceneId?: string;
  sourceNpcId?: string;
  sourceDialogueVersion?: number;
}

function getCatalogItem(gameData: ChildGameData, catalogItemId: string) {
  return gameData.catalog.find((item) => item.id === catalogItemId);
}

function getPurchaseTotal(gameData: ChildGameData, draft: OptimisticPurchaseDraft) {
  if (draft.totalPrice !== undefined) return draft.totalPrice;
  const catalogItem = getCatalogItem(gameData, draft.catalogItemId);
  const unitPrice = gameData.prices[draft.catalogItemId] ?? catalogItem?.scrollPrice ?? 0;
  return unitPrice * draft.quantity;
}

/** Apply a purchase before the purchase RPC returns. Server values are reconciled separately. */
export function patchPurchasedGameItem(gameData: ChildGameData, draft: OptimisticPurchaseDraft): ChildGameData {
  const catalogItem = getCatalogItem(gameData, draft.catalogItemId);
  if (!catalogItem) return gameData;
  const existingInventoryItemId = draft.existingInventoryItemId ?? null;
  const existingInventoryItem = existingInventoryItemId
    ? gameData.inventory.find((item) => item.id === existingInventoryItemId)
    : undefined;
  const sourceSnapshot = {
    ...(draft.sourceSceneId ? { sourceSceneId: draft.sourceSceneId } : {}),
    ...(draft.sourceNpcId ? { sourceNpcId: draft.sourceNpcId } : {}),
    ...(draft.sourceDialogueVersion !== undefined ? { sourceDialogueVersion: draft.sourceDialogueVersion } : {}),
  };

  const inventory = existingInventoryItem
    ? gameData.inventory.map((item) => item.id === existingInventoryItem.id
      ? { ...item, quantity: item.quantity + draft.quantity, ...sourceSnapshot }
      : item)
    : [...gameData.inventory, {
      id: draft.localInventoryItemId,
      catalogItemId: draft.catalogItemId,
      quantity: draft.quantity,
      acquiredVia: 'purchase' as const,
      acquiredAt: draft.acquiredAt,
      displayName: null,
      ...sourceSnapshot,
    }];

  return {
    ...gameData,
    walletBalance: gameData.walletBalance - getPurchaseTotal(gameData, draft),
    inventory,
  };
}

/** Replace a temporary purchase row with the server-authoritative purchase result. */
export function reconcilePurchasedGameItem(
  gameData: ChildGameData,
  localInventoryItemId: string,
  result: GamePurchaseResult,
  draft?: Pick<OptimisticPurchaseDraft, 'catalogItemId' | 'acquiredAt' | 'sourceSceneId' | 'sourceNpcId' | 'sourceDialogueVersion'>,
): ChildGameData {
  const inventoryIndex = gameData.inventory.findIndex((item) => item.id === localInventoryItemId);
  const sourceSnapshot = {
    ...((result.sourceSceneId ?? draft?.sourceSceneId) ? { sourceSceneId: result.sourceSceneId ?? draft?.sourceSceneId } : {}),
    ...((result.sourceNpcId ?? draft?.sourceNpcId) ? { sourceNpcId: result.sourceNpcId ?? draft?.sourceNpcId } : {}),
    ...((result.sourceDialogueVersion ?? draft?.sourceDialogueVersion) !== undefined
      && (result.sourceDialogueVersion ?? draft?.sourceDialogueVersion) !== null
      ? { sourceDialogueVersion: result.sourceDialogueVersion ?? draft?.sourceDialogueVersion }
      : {}),
  };
  if (inventoryIndex < 0) {
    if (draft && !gameData.inventory.some((item) => item.id === result.inventoryItemId)) {
      return {
        ...gameData,
        walletBalance: result.walletBalance,
        inventory: [...gameData.inventory, {
          id: result.inventoryItemId,
          catalogItemId: draft.catalogItemId,
          quantity: result.quantity,
          acquiredVia: 'purchase',
          acquiredAt: draft.acquiredAt,
          displayName: null,
          ...sourceSnapshot,
        }],
      };
    }
    return {
      ...gameData,
      walletBalance: result.walletBalance,
    };
  }
  const inventory = [...gameData.inventory];
  inventory[inventoryIndex] = {
    ...inventory[inventoryIndex],
    id: result.inventoryItemId,
    quantity: result.quantity,
    ...sourceSnapshot,
  };
  return { ...gameData, walletBalance: result.walletBalance, inventory };
}

/** Remove only the failed optimistic purchase, preserving later optimistic purchases. */
export function rollbackPurchasedGameItem(gameData: ChildGameData, draft: OptimisticPurchaseDraft): ChildGameData {
  const existingInventoryItemId = draft.existingInventoryItemId ?? null;
  const currentInventoryItem = existingInventoryItemId
    ? gameData.inventory.find((item) => item.id === existingInventoryItemId)
    : gameData.inventory.find((item) => item.id === draft.localInventoryItemId);
  const optimisticPatchWasApplied = existingInventoryItemId
    ? Boolean(currentInventoryItem && currentInventoryItem.quantity > (draft.existingQuantityBefore ?? currentInventoryItem.quantity))
    : Boolean(currentInventoryItem);
  if (!optimisticPatchWasApplied) return gameData;
  const inventory = existingInventoryItemId
    ? gameData.inventory
      .map((item) => item.id === existingInventoryItemId ? { ...item, quantity: item.quantity - draft.quantity } : item)
      .filter((item) => item.quantity > 0)
    : gameData.inventory.filter((item) => item.id !== draft.localInventoryItemId);
  return {
    ...gameData,
    walletBalance: gameData.walletBalance + getPurchaseTotal(gameData, draft),
    inventory,
  };
}

export function patchEquippedCharacter(gameData: ChildGameData, inventoryItemId: string): ChildGameData {
  return {
    ...gameData,
    loadout: {
      equippedCharacterInventoryId: inventoryItemId,
      followingPetInventoryId: gameData.loadout?.followingPetInventoryId ?? null,
      followingPetInventoryIds: gameData.loadout?.followingPetInventoryIds ?? (
        gameData.loadout?.followingPetInventoryId ? [gameData.loadout.followingPetInventoryId] : []
      ),
    },
  };
}

export function patchFollowingPets(gameData: ChildGameData, inventoryItemIds: readonly string[]): ChildGameData {
  const followingPetInventoryIds = [...inventoryItemIds];
  const followingPetInventoryIdSet = new Set(followingPetInventoryIds);
  return {
    ...gameData,
    loadout: {
      equippedCharacterInventoryId: gameData.loadout?.equippedCharacterInventoryId ?? null,
      followingPetInventoryId: followingPetInventoryIds[0] ?? null,
      followingPetInventoryIds,
    },
    worldEntities: gameData.worldEntities.map((entity) => entity.entityKind === 'pet'
      && entity.isActive
      && followingPetInventoryIdSet.has(entity.inventoryItemId)
      ? { ...entity, behaviorMode: 'idle', roamingSlot: null, isActive: false }
      : entity),
  };
}

/** Mirror set_roaming_pets locally, including entities created by the RPC. */
export function patchRoamingPets(
  gameData: ChildGameData,
  inventoryItemIds: readonly string[],
  positionOverrides: RoamingPetPositionOverrides = {},
): ChildGameData {
  const followingPetInventoryIds = gameData.loadout?.followingPetInventoryIds?.length
    ? gameData.loadout.followingPetInventoryIds
    : gameData.loadout?.followingPetInventoryId ? [gameData.loadout.followingPetInventoryId] : [];
  const followingIds = new Set(followingPetInventoryIds);
  const selectedIds = [...new Set(inventoryItemIds)];
  if (selectedIds.some((inventoryItemId) => followingIds.has(inventoryItemId))) return gameData;
  const selected = new Set(selectedIds);
  const inventoryById = new Map(gameData.inventory.map((item) => [item.id, item]));
  const catalogById = new Map(gameData.catalog.map((item) => [item.id, item]));
  const existingEntityIds = new Set<string>();

  const worldEntities = gameData.worldEntities.map((entity) => {
    if (entity.entityKind !== 'pet') return entity;
    const selectedIndex = selectedIds.indexOf(entity.inventoryItemId);
    if (selectedIndex < 0) {
      return entity.behaviorMode === 'wander'
        ? { ...entity, behaviorMode: 'idle' as const, roamingSlot: null, isActive: false }
        : entity;
    }
    existingEntityIds.add(entity.inventoryItemId);
    const inventory = inventoryById.get(entity.inventoryItemId);
    const catalogItem = inventory ? catalogById.get(inventory.catalogItemId) : undefined;
    const slot = selectedIndex + 1;
    const positionOverride = positionOverrides[entity.inventoryItemId];
    return {
      ...entity,
      ...positionOverride,
      behaviorMode: 'wander' as const,
      roamingSlot: slot,
      isActive: true,
      catalogItemId: catalogItem?.id ?? entity.catalogItemId,
      collisionRadius: catalogItem?.collisionRadius ?? entity.collisionRadius,
      assetKey: catalogItem?.assetKey ?? entity.assetKey,
      name: catalogItem?.name ?? entity.name,
      displayName: inventory?.displayName ?? entity.displayName,
    };
  });

  for (const [selectedIndex, inventoryItemId] of selectedIds.entries()) {
    if (existingEntityIds.has(inventoryItemId)) continue;
    const inventory = inventoryById.get(inventoryItemId);
    const catalogItem = inventory ? catalogById.get(inventory.catalogItemId) : undefined;
    if (!inventory || !catalogItem || catalogItem.itemType !== 'pet') continue;
    const slot = selectedIndex + 1;
    const positionOverride = positionOverrides[inventoryItemId];
    worldEntities.push({
      id: `local-roaming-${inventoryItemId}`,
      inventoryItemId,
      entityKind: 'pet',
      worldLayoutVersion: 1,
      x: positionOverride?.x ?? -3.5 + ((slot - 1) % 8),
      y: positionOverride?.y ?? 0,
      z: positionOverride?.z ?? -3.5 + (Math.floor((slot - 1) / 8) % 8),
      rotationX: positionOverride?.rotationX ?? 0,
      rotationY: positionOverride?.rotationY ?? 0,
      rotationZ: positionOverride?.rotationZ ?? 0,
      scale: positionOverride?.scale ?? 1,
      behaviorMode: 'wander',
      roamingSlot: slot,
      isActive: true,
      catalogItemId: catalogItem.id,
      collisionRadius: catalogItem.collisionRadius,
      assetKey: catalogItem.assetKey,
      name: catalogItem.name,
      displayName: inventory.displayName ?? undefined,
    });
  }

  return { ...gameData, worldEntities };
}
