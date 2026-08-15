import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyChildGameData, type ChildGameData, type ChildWorldEntity, type GameCatalogItem } from './contracts';

interface CatalogRow {
  id: string;
  item_type: GameCatalogItem['itemType'];
  name: string;
  description: string;
  scroll_price: number;
  asset_key: string;
  thumbnail_url: string | null;
  is_active: boolean;
  is_starter: boolean;
  is_stackable: boolean;
  collision_radius: number;
  min_scale: number;
  max_scale: number;
  sort_order: number;
  metadata: Record<string, unknown>;
}

interface PriceRow { catalog_item_id: string; scroll_price: number }
interface WalletRow { child_profile_id: string; scroll_balance: number }
interface InventoryRow { id: string; child_profile_id: string; catalog_item_id: string; quantity: number; acquired_via: 'starter' | 'purchase' | 'grant'; acquired_at: string; display_name?: string | null }
interface LoadoutRow {
  child_profile_id: string;
  equipped_character_inventory_id: string | null;
  following_pet_inventory_id: string | null;
  following_pet_inventory_ids?: string[] | null;
}
interface WorldStateRow { child_profile_id: string; revision: number }
interface WorldEntityRow {
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
interface GameDataQueryError {
  code?: string | null;
  message?: string | null;
  status?: number | null;
  statusCode?: number | null;
}

function isMissingGameDataError(error: unknown): boolean {
  if (!error) return false;
  const candidate = typeof error === 'object' ? error as GameDataQueryError & { context?: { status?: number } } : { message: String(error) };
  const code = String(candidate.code ?? '').toUpperCase();
  const message = String(candidate.message ?? '');
  const status = Number(candidate.status ?? candidate.statusCode ?? candidate.context?.status ?? 0);
  return status === 404
    || /\b404\b/.test(message)
    || code === '404'
    || code === 'PGRST205'
    || code === 'PGRST106'
    || code === '42P01'
    || code === '3F000'
    || /(?:table|relation|schema|schema cache).*(?:does not exist|not found|not exposed|could not find)/i.test(message)
    || /(?:could not find|not found).*(?:table|relation|schema|schema cache)/i.test(message);
}

function readOptionalGameData<T>(
  result: { data: T; error: GameDataQueryError | null },
  fallback: T,
): T {
  if (!result.error) return result.data ?? fallback;
  if (isMissingGameDataError(result.error)) return fallback;
  throw new Error(result.error.message ?? '遊戲資料載入失敗。');
}

async function loadOptionalGameData<T>(
  query: PromiseLike<{ data: T; error: GameDataQueryError | null }>,
  fallback: T,
): Promise<T> {
  try {
    return readOptionalGameData(await query, fallback);
  } catch (error) {
    if (isMissingGameDataError(error)) return fallback;
    throw error;
  }
}

function toCatalogItem(row: CatalogRow): GameCatalogItem {
  return {
    id: row.id,
    itemType: row.item_type,
    name: row.name,
    description: row.description,
    scrollPrice: row.scroll_price,
    assetKey: row.asset_key,
    thumbnailUrl: row.thumbnail_url,
    isActive: row.is_active,
    isStarter: row.is_starter,
    isStackable: row.is_stackable,
    collisionRadius: Number(row.collision_radius),
    minScale: Number(row.min_scale),
    maxScale: Number(row.max_scale),
    sortOrder: row.sort_order,
    metadata: row.metadata ?? {},
  };
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
): Record<string, ChildGameData> {
  const catalog = catalogRows.map(toCatalogItem);
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const prices = Object.fromEntries(priceRows.map((row) => [row.catalog_item_id, row.scroll_price]));
  return Object.fromEntries(childIds.map((childId) => {
    const data = emptyChildGameData();
    data.catalog = catalog;
    data.prices = prices;
    data.walletBalance = Number(walletRows.find((row) => row.child_profile_id === childId)?.scroll_balance ?? 0);
    data.inventory = inventoryRows
      .filter((row) => row.child_profile_id === childId)
      .map((row) => ({ id: row.id, catalogItemId: row.catalog_item_id, quantity: Number(row.quantity), acquiredVia: row.acquired_via, acquiredAt: row.acquired_at, displayName: row.display_name ?? null }));
    const loadout = loadoutRows.find((row) => row.child_profile_id === childId);
    const followingPetInventoryIds = Array.isArray(loadout?.following_pet_inventory_ids)
      ? loadout.following_pet_inventory_ids.filter((value): value is string => typeof value === 'string')
      : [];
    data.loadout = loadout
      ? {
        equippedCharacterInventoryId: loadout.equipped_character_inventory_id,
        followingPetInventoryId: followingPetInventoryIds[0] ?? loadout.following_pet_inventory_id,
        followingPetInventoryIds,
      }
      : null;
    data.worldRevision = Number(worldStateRows.find((row) => row.child_profile_id === childId)?.revision ?? 0);
    data.worldEntities = entityRows.filter((row) => row.child_profile_id === childId && row.is_active).map((row) => {
      const inventory = inventoryRows.find((item) => item.id === row.inventory_item_id);
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
    return [childId, data];
  }));
}

export async function loadChildGameData(
  client: SupabaseClient,
  familyId: string,
  childIds: string[],
  includeInactiveCatalog = false,
): Promise<Record<string, ChildGameData>> {
  if (childIds.length === 0) return {};
  // Keep retired catalog rows available to resolve owned inventory/loadout/
  // world references. The catalog RLS policy still limits which inactive rows
  // a child can see; the shop filters inactive rows at render time.
  const catalogQuery = client.from('game_catalog_items').select('*').order('sort_order');
  const [catalog, prices, wallets, inventory, loadouts, worldStates, entities] = await Promise.all([
    loadOptionalGameData(catalogQuery, []),
    loadOptionalGameData(client.from('family_game_item_prices').select('catalog_item_id, scroll_price').eq('family_id', familyId), []),
    loadOptionalGameData(client.from('child_game_wallets').select('*').in('child_profile_id', childIds), []),
    loadOptionalGameData(client.from('child_inventory_items').select('*').in('child_profile_id', childIds), []),
    loadOptionalGameData(client.from('child_game_loadouts').select('*').in('child_profile_id', childIds), []),
    loadOptionalGameData(client.from('child_world_states').select('*').in('child_profile_id', childIds), []),
    loadOptionalGameData(client.from('child_world_entities').select('*').in('child_profile_id', childIds).eq('is_active', true), []),
  ]);
  return createChildGameDataMap(
    childIds,
    catalog as CatalogRow[],
    prices as PriceRow[],
    wallets as WalletRow[],
    inventory as InventoryRow[],
    loadouts as LoadoutRow[],
    worldStates as WorldStateRow[],
    entities as WorldEntityRow[],
  );
}
