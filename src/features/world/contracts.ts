import type { WorldTransform } from './world-collision';

export type GameItemType = 'character' | 'pet' | 'decoration';
export type GameEntityKind = 'pet' | 'decoration';
export type PetBehaviorMode = 'static' | 'idle' | 'wander';
export type GameLootDropKind = 'star' | 'scroll';

export interface GameCatalogItem {
  id: string;
  itemType: GameItemType;
  name: string;
  description: string;
  scrollPrice: number;
  assetKey: string;
  thumbnailUrl: string | null;
  isActive: boolean;
  isStarter: boolean;
  isStackable: boolean;
  collisionRadius: number;
  minScale: number;
  maxScale: number;
  sortOrder: number;
  metadata: Record<string, unknown>;
}

export interface ChildInventoryItem {
  id: string;
  catalogItemId: string;
  quantity: number;
  acquiredVia: 'starter' | 'purchase' | 'grant';
  acquiredAt: string;
}

export interface ChildWorldEntity extends WorldTransform {
  id: string;
  inventoryItemId: string;
  entityKind: GameEntityKind;
  worldLayoutVersion: number;
  behaviorMode: PetBehaviorMode;
  roamingSlot: number | null;
  isActive: boolean;
  catalogItemId?: string;
  collisionRadius?: number;
  assetKey?: string;
  name?: string;
}

export interface GameLootDrop {
  id: string;
  sourceTaskId: string;
  kind: GameLootDropKind;
  amount: number;
  x: number;
  y: number;
  z: number;
  createdAt: string;
}

export interface ChildGameData {
  walletBalance: number;
  catalog: GameCatalogItem[];
  prices: Record<string, number>;
  inventory: ChildInventoryItem[];
  loadout: { equippedCharacterInventoryId: string | null; followingPetInventoryId: string | null } | null;
  worldEntities: ChildWorldEntity[];
  worldRevision: number;
  lootDrops: GameLootDrop[];
}

export interface GamePurchaseResult {
  purchaseId: string;
  inventoryItemId: string;
  walletBalance: number;
  quantity: number;
}

export interface GameLootCollectionResult {
  dropId: string;
  kind: GameLootDropKind;
  amount: number;
  pointsBalance: number;
  walletBalance: number;
  idempotentReplay: boolean;
}

export interface GameLootBatchCollectionResult {
  dropIds: string[];
  starAmount: number;
  scrollAmount: number;
  pointsBalance: number;
  walletBalance: number;
  idempotentReplay: boolean;
}

export interface WorldMutationResult {
  revision: number;
}

export const emptyChildGameData = (): ChildGameData => ({
  walletBalance: 0,
  catalog: [],
  prices: {},
  inventory: [],
  loadout: null,
  worldEntities: [],
  worldRevision: 0,
  lootDrops: [],
});

export interface WorldMutationPayload {
  inventoryItemId: string;
  entityId?: string;
  expectedRevision: number;
  transform?: WorldTransform;
  behaviorMode?: PetBehaviorMode;
  roamingSlot?: number | null;
}

export type WorldTransformMutationPayload = Pick<WorldMutationPayload, 'inventoryItemId' | 'entityId' | 'expectedRevision' | 'transform'> & {
  transform: WorldTransform;
};

export function toWorldMutationPayload(input: WorldMutationPayload): Record<string, unknown> {
  return {
    target_inventory_item_id: input.inventoryItemId,
    ...(input.entityId ? { target_entity_id: input.entityId } : {}),
    expected_revision: input.expectedRevision,
    ...(input.transform ? {
      position_x: input.transform.x,
      position_y: input.transform.y,
      position_z: input.transform.z,
      rotation_x: input.transform.rotationX,
      rotation_y: input.transform.rotationY,
      rotation_z: input.transform.rotationZ,
      scale: input.transform.scale,
    } : {}),
    ...(input.behaviorMode ? { target_behavior_mode: input.behaviorMode } : {}),
    ...(input.roamingSlot !== undefined ? { target_roaming_slot: input.roamingSlot } : {}),
  };
}
