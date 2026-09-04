import assert from 'node:assert/strict';
import test from 'node:test';
import { createChildGameDataMap } from '../src/features/world/game-data';
import {
  getCatalogShopGateContext,
  getCatalogShopPurchaseSource,
  getCatalogShopState,
} from '../src/features/world/world-npc-shop';
import {
  completeWorldNpcDialogue,
  loadWorldSceneStateForChildren,
  purchaseWorldNpcOffering,
} from '../src/features/world/world-scene-data-access';
import {
  createWorldNpcInteractionController,
} from '../src/features/world/world-npc-runtime';
import {
  getServerWorldSceneAccess,
} from '../src/features/world/world-scene-unlocks';

const catalogRow = {
  id: 'pet-nibus', item_type: 'pet' as const, name: '尼布斯', description: '', scroll_price: 7,
  asset_key: 'pet.nibus', thumbnail_url: null, is_active: true, is_starter: false,
  is_child_creation_selectable: false, is_newly_obtainable: true, is_stackable: false,
  collision_radius: 0.2, min_scale: 0.9, max_scale: 1.1, sort_order: 1, metadata: {},
};

const sceneState = {
  scenes: [{
    id: 'cloud-workshop' as const, name: '雲工房', sort_order: 3,
    required_completed_count: 12, required_general_count: 2, unlock_rule_version: 1, is_active: true,
  }],
  npcs: [{
    id: 'npc.nibus', scene_id: 'cloud-workshop' as const, npc_type: 'roaming_pet' as const,
    name: '尼布斯', asset_key: 'pet.nibus', catalog_item_id: 'pet-nibus',
    position_x: -3, position_y: 0, position_z: 1, behavior_mode: 'roaming' as const,
    animation_name: 'Walk', roam_bounds: { minX: -6, maxX: 6, minZ: -4, maxZ: 4 }, is_active: true,
  }],
  offerings: [{
    npc_id: 'npc.nibus', catalog_item_id: 'pet-nibus', sort_order: 1,
    dialogue_version: 2, is_primary_source: false, is_active: true,
  }],
  unlocks: [],
  dialogue: [],
};

test('server scene access fails closed when hydration is unavailable', () => {
  assert.deepEqual(getServerWorldSceneAccess('cloud-workshop', undefined, undefined), {
    available: false,
    unlocked: false,
    reason: 'scene_data_unavailable',
  });
  assert.deepEqual(getServerWorldSceneAccess('cloud-workshop', sceneState.scenes, []), {
    available: true,
    unlocked: false,
    reason: 'scene_locked',
  });
  assert.deepEqual(getServerWorldSceneAccess('cloud-workshop', sceneState.scenes, [{ sceneId: 'cloud-workshop' }]), {
    available: true,
    unlocked: true,
    reason: null,
  });
});

test('shop state uses hydrated DB offerings and never authorizes from static content', () => {
  const gameData = createChildGameDataMap(
    ['child-a'], [catalogRow], [{ catalog_item_id: 'pet-nibus', scroll_price: 9 }], [], [], [], [],
    [], [], 'child-a', [], [], sceneState,
  )['child-a'];
  const context = getCatalogShopGateContext(gameData);
  assert.ok(context);
  assert.equal(getCatalogShopState(gameData.catalog[0], context).reason, 'scene_locked');
  assert.equal(getCatalogShopPurchaseSource(gameData.catalog[0], context), undefined);
  const unlockedGameData = {
    ...gameData,
    sceneUnlocks: [{ familyId: 'family-a', childProfileId: 'child-a', sceneId: 'cloud-workshop', unlockRuleVersion: 1, unlockedAt: '2026-09-03T00:00:00Z' }],
    npcDialogueProgress: [{ familyId: 'family-a', childProfileId: 'child-a', npcId: 'npc.nibus', dialogueVersion: 2, firstTalkedAt: '2026-09-03T00:00:00Z', lastTalkedAt: '2026-09-03T00:00:00Z' }],
  };
  const unlockedContext = getCatalogShopGateContext(unlockedGameData);
  assert.equal(getCatalogShopState(unlockedGameData.catalog[0], unlockedContext).purchasable, true);
  assert.equal(getCatalogShopPurchaseSource(unlockedGameData.catalog[0], unlockedContext), 'npc.nibus');
  assert.equal(getCatalogShopState(unlockedGameData.catalog[0], undefined).purchasable, false);
});

test('legacy inventory remains mappable while the server catalog controls new acquisition', () => {
  const data = createChildGameDataMap(
    ['child-a'], [{ ...catalogRow, id: 'legacy-pet', asset_key: 'pet.forest-guardian', is_newly_obtainable: false }],
    [], [], [{ id: 'inventory-legacy', child_profile_id: 'child-a', catalog_item_id: 'legacy-pet', quantity: 1, acquired_via: 'purchase', acquired_at: '2026-09-01T00:00:00Z', source_scene_id: null, source_npc_id: null, source_dialogue_version: null }],
    [], [], [], [], 'child-a', undefined, undefined,
  )['child-a'];
  assert.equal(data.inventory[0]?.id, 'inventory-legacy');
  assert.equal(data.catalog[0]?.isNewlyObtainable, false);
  assert.equal(getCatalogShopState(data.catalog[0], undefined).purchasable, false);
});

test('NPC controller exposes selection and a disposable lifecycle boundary', () => {
  const controller = createWorldNpcInteractionController('cloud-workshop', sceneState.npcs);
  assert.deepEqual(controller.select('npc.nibus'), { sceneId: 'cloud-workshop', npcId: 'npc.nibus' });
  assert.equal(controller.select('npc.missing'), null);
  controller.dispose();
  assert.equal(controller.select('npc.nibus'), null);
});

test('world scene repository preserves child scope, source NPC, and idempotency', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === 'complete_world_npc_dialogue') return { data: { npc_id: 'npc.noah', scene_id: 'cloud-workshop', dialogue_version: 2, offerings: [] }, error: null };
      return { data: { purchase_id: 'purchase-1', inventory_item_id: 'inventory-1', wallet_balance: 4, quantity: 1 }, error: null };
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          in: () => Promise.resolve({ data: [], error: null }),
          order: () => Promise.resolve({ data: [], error: null }),
        }),
        in: () => Promise.resolve({ data: [], error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      in: () => Promise.resolve({ data: [], error: null }),
    }),
  };
  const state = await loadWorldSceneStateForChildren(client as never, ['child-a']);
  assert.deepEqual(state.unlocks, []);
  await completeWorldNpcDialogue(client as never, 'npc.noah', 'child-a');
  await purchaseWorldNpcOffering(client as never, 'pet-nibus', 1, 'purchase-key', 'child-a', 'npc.noah');
  assert.deepEqual(calls, [
    { name: 'complete_world_npc_dialogue', args: { target_npc_id: 'npc.noah', target_child_profile_id: 'child-a' } },
    { name: 'purchase_game_item', args: {
      target_catalog_item_id: 'pet-nibus', target_quantity: 1, purchase_idempotency_key: 'purchase-key',
      target_child_profile_id: 'child-a', target_source_npc_id: 'npc.noah',
    } },
  ]);
});
