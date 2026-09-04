import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChildGameData } from './contracts';
import {
  createChildGameDataMap,
  type CatalogRow,
  type InventoryRow,
  type LoadoutRow,
  type PriceRow,
  type SharedWorldDecorationRow,
  type WalletRow,
  type WorldEntityRow,
  type WorldStateRow,
} from './game-data-map';
import {
  loadWorldSceneStateForChildren,
  type WorldNpcDialogueProgressRow,
  type WorldSceneState,
  type WorldSceneUnlockRow,
} from './world-scene-data-access';

export { createChildGameDataMap };
export type { SharedWorldDecorationRow };

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

export async function loadChildGameData(
  client: SupabaseClient,
  familyId: string,
  childIds: string[],
  includeInactiveCatalog = false,
  sharedDecorationOwnerChildProfileId = childIds[0],
): Promise<Record<string, ChildGameData>> {
  if (childIds.length === 0) return {};
  // Keep retired catalog rows available so supported historical inventory,
  // loadout, and world references can still resolve. Unsupported references
  // are filtered after the catalog is mapped against packaged app assets.
  const catalogQuery = client.from('game_catalog_items').select('*').order('sort_order');
  const sharedDecorationsQuery = typeof client.rpc === 'function'
    ? loadOptionalGameData(client.rpc('get_my_shared_world_decorations', { target_child_profile_id: sharedDecorationOwnerChildProfileId }), [])
    : Promise.resolve([] as SharedWorldDecorationRow[]);
  const loadWorldSceneState = loadWorldSceneStateForChildren(client, childIds).catch((error) => {
    if (isMissingGameDataError(error)) return undefined;
    throw error;
  });
  const [catalog, prices, wallets, inventory, loadouts, worldStates, entities, sharedDecorations, sceneUnlocks, dialogueProgress, worldSceneState] = await Promise.all([
    loadOptionalGameData(catalogQuery, []),
    loadOptionalGameData(client.from('family_game_item_prices').select('catalog_item_id, scroll_price').eq('family_id', familyId), []),
    loadOptionalGameData(client.from('child_game_wallets').select('*').in('child_profile_id', childIds), []),
    loadOptionalGameData(client.from('child_inventory_items').select('*').in('child_profile_id', childIds), []),
    loadOptionalGameData(client.from('child_game_loadouts').select('*').in('child_profile_id', childIds), []),
    loadOptionalGameData(client.from('child_world_states').select('*').in('child_profile_id', childIds), []),
    loadOptionalGameData(client.from('child_world_entities').select('*').in('child_profile_id', childIds).eq('is_active', true), []),
    sharedDecorationsQuery,
    loadOptionalGameData<WorldSceneUnlockRow[] | undefined>(
      client.from('child_world_scene_unlocks').select('*').in('child_profile_id', childIds),
      undefined,
    ),
    loadOptionalGameData<WorldNpcDialogueProgressRow[] | undefined>(
      client.from('child_world_npc_dialogue_progress').select('*').in('child_profile_id', childIds),
      undefined,
    ),
    loadWorldSceneState,
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
    sharedDecorations as SharedWorldDecorationRow[],
    sharedDecorationOwnerChildProfileId,
    sceneUnlocks as WorldSceneUnlockRow[] | undefined,
    dialogueProgress as WorldNpcDialogueProgressRow[] | undefined,
    worldSceneState as WorldSceneState | undefined,
  );
}
