import {
  emptyChildGameData,
  type ChildGameData,
  type ChildWorldEntity,
  type GameCatalogItem,
} from './contracts';
import { getLocalGameThumbnailUrl, isLocalGameItemInventorySupported } from './game-content-assets';
import {
  type WorldNpcDialogueProgressRow,
  type WorldSceneState,
  type WorldSceneUnlockRow,
} from './world-scene-data-access';
import { hydrateWorldSceneGameData } from './world-scene-game-data';

export interface CatalogRow {
  id: string;
  item_type: GameCatalogItem['itemType'];
  name: string;
  description: string;
  scroll_price: number;
  asset_key: string;
  thumbnail_url: string | null;
  is_active: boolean;
  is_starter: boolean;
  is_child_creation_selectable?: boolean;
  is_newly_obtainable?: boolean;
  is_stackable: boolean;
  collision_radius: number;
  min_scale: number;
  max_scale: number;
  sort_order: number;
  metadata: Record<string, unknown>;
}

export interface PriceRow { catalog_item_id: string; scroll_price: number }
export interface WalletRow { child_profile_id: string; scroll_balance: number }
export interface InventoryRow {
  id: string;
  child_profile_id: string;
  catalog_item_id: string;
  quantity: number;
  acquired_via: 'starter' | 'purchase' | 'grant';
  acquired_at: string;
  display_name?: string | null;
  source_scene_id?: string | null;
  source_npc_id?: string | null;
  source_dialogue_version?: number | null;
}
export interface LoadoutRow {
  child_profile_id: string;
  equipped_character_inventory_id: string | null;
  following_pet_inventory_id: string | null;
  following_pet_inventory_ids?: string[] | null;
}
export interface WorldStateRow { child_profile_id: string; revision: number }
export interface WorldEntityRow {
  id: string;
  child_profile_id: string;
  inventory_item_id: string;
  world_layout_version: number;
  position_x: number;
  position_y: number;
  position_z: number;
  rotation_x: number;
  rotation_y: number;
  rotation_z: number;
  scale: number;
  behavior_mode: ChildWorldEntity['behaviorMode'];
  roaming_slot: number | null;
  is_active: boolean;
  entity_kind: ChildWorldEntity['entityKind'];
}
export interface SharedWorldDecorationRow {
  id: string;
  source_inventory_item_id?: string | null;
  catalog_item_id: string;
  asset_key: string;
  position_x: number | string;
  position_y: number | string;
  position_z: number | string;
  rotation_x: number | string;
  rotation_y: number | string;
  rotation_z: number | string;
  scale: number | string;
  behavior_mode: 'static';
  is_active: boolean;
  shared_by_me: boolean;
  shared_source_display_name?: string | null;
}

function toCatalogItem(row: CatalogRow): GameCatalogItem {
  const item: GameCatalogItem = {
    id: row.id,
    itemType: row.item_type,
    name: row.name,
    description: row.description,
    scrollPrice: row.scroll_price,
    assetKey: row.asset_key,
    // SQL describes the product, but only packaged App assets may enter the UI.
    thumbnailUrl: getLocalGameThumbnailUrl({ itemType: row.item_type, assetKey: row.asset_key }),
    isActive: row.is_active,
    isStarter: row.is_starter,
    isStackable: row.is_stackable,
    collisionRadius: Number(row.collision_radius),
    minScale: Number(row.min_scale),
    maxScale: Number(row.max_scale),
    sortOrder: row.sort_order,
    metadata: row.metadata ?? {},
  };
  if (row.is_child_creation_selectable !== undefined) item.isChildCreationSelectable = row.is_child_creation_selectable;
  if (row.is_newly_obtainable !== undefined) item.isNewlyObtainable = row.is_newly_obtainable;
  return item;
}

export function createChildGameDataMap(
  childIds: string[],
  catalogRows: CatalogRow[],
  priceRows: PriceRow[],
  walletRows: WalletRow[],
  inventoryRows: InventoryRow[],
  loadoutRows: LoadoutRow[],
  worldStateRows: WorldStateRow[],
  entityRows: WorldEntityRow[],
  sharedDecorationRows: SharedWorldDecorationRow[] = [],
  sharedDecorationOwnerChildProfileId = childIds[0],
  sceneUnlockRows?: WorldSceneUnlockRow[],
  dialogueRows?: WorldNpcDialogueProgressRow[],
  worldSceneState?: WorldSceneState,
): Record<string, ChildGameData> {
  const catalog = catalogRows.map(toCatalogItem);
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const prices = Object.fromEntries(priceRows.map((row) => [row.catalog_item_id, row.scroll_price]));
  return Object.fromEntries(childIds.map((childId) => {
    const data = emptyChildGameData();
    const supportedInventoryRows = inventoryRows.filter((row) => {
      const item = catalogById.get(row.catalog_item_id);
      return item ? isLocalGameItemInventorySupported(item) : false;
    });
    const supportedInventoryIds = new Set(
      supportedInventoryRows
        .filter((row) => row.child_profile_id === childId)
        .map((row) => row.id),
    );
    data.catalog = catalog;
    data.prices = prices;
    data.walletBalance = Number(walletRows.find((row) => row.child_profile_id === childId)?.scroll_balance ?? 0);
    data.inventory = supportedInventoryRows
      .filter((row) => row.child_profile_id === childId)
      .map((row) => ({
        id: row.id,
        catalogItemId: row.catalog_item_id,
        quantity: Number(row.quantity),
        acquiredVia: row.acquired_via,
        acquiredAt: row.acquired_at,
        displayName: row.display_name ?? null,
        ...(row.source_scene_id !== undefined ? { sourceSceneId: row.source_scene_id } : {}),
        ...(row.source_npc_id !== undefined ? { sourceNpcId: row.source_npc_id } : {}),
        ...(row.source_dialogue_version !== undefined ? { sourceDialogueVersion: row.source_dialogue_version } : {}),
      }));
    const loadout = loadoutRows.find((row) => row.child_profile_id === childId);
    const followingPetInventoryIds = Array.isArray(loadout?.following_pet_inventory_ids)
      ? loadout.following_pet_inventory_ids.filter((value): value is string => typeof value === 'string' && supportedInventoryIds.has(value))
      : [];
    const legacyFollowingPetInventoryId = loadout?.following_pet_inventory_id && supportedInventoryIds.has(loadout.following_pet_inventory_id)
      ? loadout.following_pet_inventory_id
      : null;
    data.loadout = loadout
      ? {
        equippedCharacterInventoryId: loadout.equipped_character_inventory_id && supportedInventoryIds.has(loadout.equipped_character_inventory_id)
          ? loadout.equipped_character_inventory_id
          : null,
        followingPetInventoryId: followingPetInventoryIds[0] ?? legacyFollowingPetInventoryId,
        followingPetInventoryIds,
      }
      : null;
    data.worldRevision = Number(worldStateRows.find((row) => row.child_profile_id === childId)?.revision ?? 0);
    hydrateWorldSceneGameData(data, childId, sceneUnlockRows, dialogueRows, worldSceneState);
    const ownedEntities = entityRows.filter((row) => row.child_profile_id === childId && row.is_active && supportedInventoryIds.has(row.inventory_item_id)).map((row) => {
      const inventory = supportedInventoryRows.find((item) => item.id === row.inventory_item_id);
      const item = inventory ? catalogById.get(inventory.catalog_item_id) : undefined;
      return {
        id: row.id,
        inventoryItemId: row.inventory_item_id,
        entityKind: row.entity_kind,
        worldLayoutVersion: row.world_layout_version,
        x: Number(row.position_x),
        y: Number(row.position_y),
        z: Number(row.position_z),
        rotationX: Number(row.rotation_x),
        rotationY: Number(row.rotation_y),
        rotationZ: Number(row.rotation_z),
        scale: Number(row.scale),
        behaviorMode: row.behavior_mode,
        roamingSlot: row.roaming_slot,
        isActive: row.is_active,
        catalogItemId: item?.id,
        collisionRadius: item?.collisionRadius,
        assetKey: item?.assetKey,
        name: item?.name,
        displayName: inventory?.display_name ?? undefined,
      } satisfies ChildWorldEntity;
    });
    const sharedEntities = childId === sharedDecorationOwnerChildProfileId
      ? sharedDecorationRows
      .filter((row) => row.is_active)
      .flatMap((row) => {
        const item = catalogById.get(row.catalog_item_id);
        if (!item || item.itemType !== 'decoration') return [];
        return [{
          id: row.id,
          // The source inventory id is an internal server key. Keep it out of
          // the synthetic world entity exposed to the owner of this world.
          inventoryItemId: `shared:${row.id}`,
          entityKind: 'decoration' as const,
          worldLayoutVersion: 1,
          x: Number(row.position_x),
          y: Number(row.position_y),
          z: Number(row.position_z),
          rotationX: Number(row.rotation_x),
          rotationY: Number(row.rotation_y),
          rotationZ: Number(row.rotation_z),
          scale: Number(row.scale),
          behaviorMode: row.behavior_mode,
          roamingSlot: null,
          isActive: true,
          catalogItemId: item.id,
          collisionRadius: item.collisionRadius,
          assetKey: row.asset_key || item.assetKey,
          name: item.name,
          placementScope: 'shared' as const,
          canTransform: true,
          canRemove: true,
          sharedByMe: row.shared_by_me === true,
          sharedSourceDisplayName: row.shared_source_display_name ?? undefined,
        } satisfies ChildWorldEntity];
      })
      : [];
    data.worldEntities = [...ownedEntities, ...sharedEntities];
    return [childId, data];
  }));
}
