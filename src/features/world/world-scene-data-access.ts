import type { SupabaseClient } from '@supabase/supabase-js';
import type { GamePurchaseResult } from './contracts';
import type { WorldSceneId } from './world-scene-content';
import { buildNpcDialogueCompletionPayload } from './world-npc-dialogue';

export interface WorldSceneUnlockRow {
  family_id: string;
  child_profile_id: string;
  scene_id: WorldSceneId;
  unlock_rule_version: number;
  unlocked_at: string;
}

export interface WorldNpcDialogueProgressRow {
  family_id: string;
  child_profile_id: string;
  npc_id: string;
  dialogue_version: number;
  first_talked_at: string;
  last_talked_at: string;
}

export interface WorldSceneRow {
  id: WorldSceneId;
  name: string;
  sort_order: number;
  required_completed_count: number;
  required_general_count: number;
  unlock_rule_version: number;
  is_active: boolean;
}

export interface WorldNpcRow {
  id: string;
  scene_id: WorldSceneId;
  npc_type: 'character_vendor' | 'roaming_pet';
  name: string;
  asset_key: string;
  catalog_item_id: string | null;
  position_x: number;
  position_y: number;
  position_z: number;
  behavior_mode: 'dance_anchor' | 'roaming';
  animation_name: string;
  roam_bounds: Record<string, number> | null;
  is_active: boolean;
}

export interface WorldNpcOfferingRow {
  npc_id: string;
  catalog_item_id: string;
  sort_order: number;
  dialogue_version: number;
  is_primary_source: boolean;
  is_active: boolean;
}

export interface WorldNpcDialogueResult {
  npc_id: string;
  scene_id: WorldSceneId;
  dialogue_version: number;
  offerings: Array<{
    catalog_item_id: string;
    asset_key: string;
    name: string;
    item_type: string;
    scroll_price: number;
    sort_order: number;
    source_scene_id: WorldSceneId;
    source_npc_id: string;
    source_dialogue_version: number;
  }>;
}

export interface WorldSceneUnlockResult {
  scene_id: WorldSceneId;
  unlocked: boolean;
  unlock_rule_version: number;
  unlocked_at: string;
  completed_count?: number;
  general_completed_count?: number;
}

export interface WorldSceneState {
  scenes: WorldSceneRow[];
  npcs: WorldNpcRow[];
  offerings: WorldNpcOfferingRow[];
  unlocks: WorldSceneUnlockRow[];
  dialogue: WorldNpcDialogueProgressRow[];
}

interface RpcResult<T> {
  data: T;
  error: { message: string } | null;
}

function unwrap<T>({ data, error }: RpcResult<T>): T {
  if (error) throw new Error(error.message);
  return data;
}

export function buildUnlockWorldScenePayload(sceneId: WorldSceneId, childProfileId: string) {
  return { target_scene_id: sceneId, target_child_profile_id: childProfileId };
}

export function buildNpcPurchasePayload(
  catalogItemId: string,
  quantity: number,
  idempotencyKey: string,
  childProfileId: string,
  npcId: string,
) {
  if (!idempotencyKey.trim() || !npcId.trim()) {
    throw new Error('NPC 購買需要來源與冪等鍵。');
  }
  return {
    target_catalog_item_id: catalogItemId,
    target_quantity: quantity,
    purchase_idempotency_key: idempotencyKey,
    target_child_profile_id: childProfileId,
    target_source_npc_id: npcId,
  };
}

export function buildGamePurchasePayload(
  catalogItemId: string,
  quantity: number,
  idempotencyKey: string,
  childProfileId: string,
  sourceNpcId?: string,
) {
  if (!idempotencyKey.trim()) throw new Error('購買需要冪等鍵。');
  return {
    target_catalog_item_id: catalogItemId,
    target_quantity: quantity,
    purchase_idempotency_key: idempotencyKey,
    target_child_profile_id: childProfileId,
    target_source_npc_id: sourceNpcId ?? null,
  };
}

export async function unlockWorldSceneIfEligible(
  client: SupabaseClient,
  sceneId: WorldSceneId,
  childProfileId: string,
): Promise<WorldSceneUnlockResult> {
  return unwrap(await client.rpc('unlock_world_scene_if_eligible', buildUnlockWorldScenePayload(sceneId, childProfileId))) as WorldSceneUnlockResult;
}

export async function completeWorldNpcDialogue(
  client: SupabaseClient,
  npcId: string,
  childProfileId: string,
): Promise<WorldNpcDialogueResult> {
  return unwrap(await client.rpc('complete_world_npc_dialogue', buildNpcDialogueCompletionPayload(npcId, childProfileId))) as WorldNpcDialogueResult;
}

export async function purchaseWorldNpcOffering(
  client: SupabaseClient,
  catalogItemId: string,
  quantity: number,
  idempotencyKey: string,
  childProfileId: string,
  npcId: string,
): Promise<GamePurchaseResult> {
  const result = await purchaseGameItem(client, catalogItemId, quantity, idempotencyKey, childProfileId, npcId);
  return result;
}

export async function purchaseGameItem(
  client: SupabaseClient,
  catalogItemId: string,
  quantity: number,
  idempotencyKey: string,
  childProfileId: string,
  sourceNpcId?: string,
): Promise<GamePurchaseResult> {
  if (sourceNpcId !== undefined && !sourceNpcId.trim()) {
    throw new Error('NPC 購買需要有效來源。');
  }
  const result = unwrap(await client.rpc('purchase_game_item', buildGamePurchasePayload(
    catalogItemId,
    quantity,
    idempotencyKey,
    childProfileId,
    sourceNpcId,
  ))) as {
    purchase_id: string;
    inventory_item_id: string;
    wallet_balance: number;
    quantity: number;
    source_scene_id?: string | null;
    source_npc_id?: string | null;
    source_dialogue_version?: number | null;
  };
  return {
    purchaseId: result.purchase_id,
    inventoryItemId: result.inventory_item_id,
    walletBalance: Number(result.wallet_balance),
    quantity: Number(result.quantity),
    sourceSceneId: result.source_scene_id ?? null,
    sourceNpcId: result.source_npc_id ?? null,
    sourceDialogueVersion: result.source_dialogue_version === null || result.source_dialogue_version === undefined
      ? null
      : Number(result.source_dialogue_version),
  };
}

export async function loadWorldSceneStateForChildren(
  client: SupabaseClient,
  childProfileIds: readonly string[],
): Promise<WorldSceneState> {
  if (childProfileIds.length === 0) {
    return { scenes: [], npcs: [], offerings: [], unlocks: [], dialogue: [] };
  }
  const [scenes, npcs, offerings, unlocks, dialogue] = await Promise.all([
    client.from('game_world_scenes').select('*').eq('is_active', true).order('sort_order'),
    client.from('game_world_npcs').select('*').eq('is_active', true),
    client.from('game_world_npc_offerings').select('*').eq('is_active', true),
    client.from('child_world_scene_unlocks').select('*').in('child_profile_id', [...childProfileIds]),
    client.from('child_world_npc_dialogue_progress').select('*').in('child_profile_id', [...childProfileIds]),
  ]);
  return {
    scenes: unwrap(scenes as RpcResult<WorldSceneRow[]>),
    npcs: unwrap(npcs as RpcResult<WorldNpcRow[]>),
    offerings: unwrap(offerings as RpcResult<WorldNpcOfferingRow[]>),
    unlocks: unwrap(unlocks as RpcResult<WorldSceneUnlockRow[]>),
    dialogue: unwrap(dialogue as RpcResult<WorldNpcDialogueProgressRow[]>),
  };
}

export async function loadWorldSceneState(
  client: SupabaseClient,
  childProfileId: string,
): Promise<WorldSceneState> {
  return loadWorldSceneStateForChildren(client, [childProfileId]);
}
