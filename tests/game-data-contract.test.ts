import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createChildGameDataMap, loadChildGameData, type SharedWorldDecorationRow } from '../src/features/world/game-data';

function queryResult<T>(result: { data: T; error: unknown }) {
  return {
    select: () => queryResult(result),
    order: () => queryResult(result),
    eq: () => queryResult(result),
    in: () => queryResult(result),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
}

function gameDataClient({ missingTables = [], networkFailure = false }: { missingTables?: string[]; networkFailure?: boolean } = {}) {
  const missing = new Set(missingTables);
  return {
    from: (table: string) => {
      if (networkFailure) {
        const rejectedQuery = {
          select: () => rejectedQuery,
          order: () => rejectedQuery,
          eq: () => rejectedQuery,
          in: () => rejectedQuery,
          then: (_resolve: unknown, reject: (reason: Error) => unknown) => Promise.reject(new Error('network unavailable')).catch(reject),
        };
        return rejectedQuery;
      }
      const result = missing.has(table)
        ? { data: null, error: { code: 'PGRST205', message: `Could not find the table '${table}' in the schema cache` } }
        : { data: [], error: null };
      return queryResult(result);
    },
  };
}

describe('child game data mapping', () => {
  it('keeps catalog, wallet, inventory, loadout, and world data isolated per child', () => {
    const data = createChildGameDataMap(
      ['child-a', 'child-b'],
      [{ id: 'item-1', item_type: 'character', name: 'A', description: '', scroll_price: 0, asset_key: 'character.anime-maiden', thumbnail_url: null, is_active: true, is_starter: true, is_stackable: false, collision_radius: 0.2, min_scale: 0.9, max_scale: 1.1, sort_order: 1, metadata: {} }],
      [],
      [{ child_profile_id: 'child-a', scroll_balance: 3 }],
      [{ id: 'inventory-a', child_profile_id: 'child-a', catalog_item_id: 'item-1', quantity: 1, acquired_via: 'starter', acquired_at: '2026-08-09T00:00:00Z' }],
      [{ child_profile_id: 'child-a', equipped_character_inventory_id: 'inventory-a', following_pet_inventory_id: null }],
      [{ child_profile_id: 'child-a', revision: 2 }],
      [],
    );
    assert.equal(data['child-a'].walletBalance, 3);
    assert.equal(data['child-a'].inventory.length, 1);
    assert.equal(data['child-b'].walletBalance, 0);
    assert.equal(data['child-b'].inventory.length, 0);
  });

  it('preserves scene acquisition flags and source snapshots when the new columns exist', () => {
    const data = createChildGameDataMap(
      ['child-a'],
      [{
        id: 'item-1', item_type: 'pet', name: '尼布斯', description: '', scroll_price: 3,
        asset_key: 'pet.nibus', thumbnail_url: null, is_active: true, is_starter: false,
        is_child_creation_selectable: false, is_newly_obtainable: true, is_stackable: false,
        collision_radius: 0.2, min_scale: 0.9, max_scale: 1.1, sort_order: 1, metadata: {},
      }],
      [], [],
      [{
        id: 'inventory-a', child_profile_id: 'child-a', catalog_item_id: 'item-1', quantity: 1,
        acquired_via: 'purchase', acquired_at: '2026-09-03T00:00:00Z',
        source_scene_id: 'cloud-workshop', source_npc_id: 'npc.nibus', source_dialogue_version: 1,
      }],
      [], [], [],
    );
    assert.equal(data['child-a'].catalog[0]?.isNewlyObtainable, true);
    assert.deepEqual(data['child-a'].inventory[0], {
      id: 'inventory-a',
      catalogItemId: 'item-1',
      quantity: 1,
      acquiredVia: 'purchase',
      acquiredAt: '2026-09-03T00:00:00Z',
      displayName: null,
      sourceSceneId: 'cloud-workshop',
      sourceNpcId: 'npc.nibus',
      sourceDialogueVersion: 1,
    });
  });

  it('does not expose an owned item that has no packaged app asset', () => {
    const data = createChildGameDataMap(
      ['child-a'],
      [{ id: 'retired-decoration', item_type: 'decoration', name: '已下架裝飾', description: '', scroll_price: 2, asset_key: 'decoration.retired', thumbnail_url: null, is_active: false, is_starter: false, is_stackable: true, collision_radius: 0.3, min_scale: 0.75, max_scale: 1.25, sort_order: 2, metadata: {} }],
      [],
      [],
      [{ id: 'inventory-a', child_profile_id: 'child-a', catalog_item_id: 'retired-decoration', quantity: 2, acquired_via: 'purchase', acquired_at: '2026-08-09T00:00:00Z' }],
      [],
      [{ child_profile_id: 'child-a', revision: 3 }],
      [{ id: 'entity-a', child_profile_id: 'child-a', inventory_item_id: 'inventory-a', world_layout_version: 1, position_x: 1, position_y: 0, position_z: -1, rotation_x: 0, rotation_y: 0, rotation_z: 0, scale: 1, behavior_mode: 'static', roaming_slot: null, is_active: true, entity_kind: 'decoration' }],
    );

    assert.equal(data['child-a'].inventory.length, 0);
    assert.equal(data['child-a'].loadout, null);
    assert.equal(data['child-a'].worldEntities.length, 0);
  });

  it('merges active shared decorations into the owner world without adding fake inventory', () => {
    const data = createChildGameDataMap(
      ['child-owner'],
      [{ id: 'shared-catalog', item_type: 'decoration', name: '共享地毯', description: '', scroll_price: 0, asset_key: 'decoration.shared-rug', thumbnail_url: null, is_active: true, is_starter: false, is_stackable: true, collision_radius: 0.7, min_scale: 0.5, max_scale: 2, sort_order: 2, metadata: {} }],
      [],
      [],
      [],
      [],
      [{ child_profile_id: 'child-owner', revision: 4 }],
      [],
      [{ id: 'shared-entity', source_inventory_item_id: 'source-inventory', catalog_item_id: 'shared-catalog', asset_key: 'decoration.shared-rug', position_x: 1, position_y: 0, position_z: -1, rotation_x: 0, rotation_y: 0, rotation_z: 0, scale: 1, behavior_mode: 'static', is_active: true, shared_by_me: false, shared_source_display_name: '小明' } satisfies SharedWorldDecorationRow],
    );

    assert.equal(data['child-owner'].inventory.length, 0);
    assert.deepEqual(data['child-owner'].worldEntities[0], {
      id: 'shared-entity',
      inventoryItemId: 'shared:shared-entity',
      entityKind: 'decoration',
      worldLayoutVersion: 1,
      x: 1,
      y: 0,
      z: -1,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scale: 1,
      behaviorMode: 'static',
      roamingSlot: null,
      isActive: true,
      catalogItemId: 'shared-catalog',
      collisionRadius: 0.7,
      assetKey: 'decoration.shared-rug',
      name: '共享地毯',
      placementScope: 'shared',
      canTransform: true,
      canRemove: true,
      sharedByMe: false,
      sharedSourceDisplayName: '小明',
    });
  });

  it('does not copy one child\'s shared decorations into another child\'s world', () => {
    const data = createChildGameDataMap(
      ['child-owner', 'child-other'],
      [{ id: 'shared-catalog', item_type: 'decoration', name: '共享地毯', description: '', scroll_price: 0, asset_key: 'decoration.shared-rug', thumbnail_url: null, is_active: true, is_starter: false, is_stackable: true, collision_radius: 0.7, min_scale: 0.5, max_scale: 2, sort_order: 2, metadata: {} }],
      [], [], [], [],
      [{ child_profile_id: 'child-owner', revision: 4 }, { child_profile_id: 'child-other', revision: 8 }],
      [],
      [{ id: 'shared-entity', source_inventory_item_id: 'source-inventory', catalog_item_id: 'shared-catalog', asset_key: 'decoration.shared-rug', position_x: 1, position_y: 0, position_z: -1, rotation_x: 0, rotation_y: 0, rotation_z: 0, scale: 1, behavior_mode: 'static', is_active: true, shared_by_me: false } satisfies SharedWorldDecorationRow],
      'child-owner',
    );

    assert.equal(data['child-owner'].worldEntities.length, 1);
    assert.equal(data['child-other'].worldEntities.length, 0);
  });

  it('returns an empty per-child fallback when game tables are not deployed yet', async () => {
    const data = await loadChildGameData(gameDataClient({ missingTables: [
      'game_catalog_items',
      'family_game_item_prices',
      'child_game_wallets',
      'child_inventory_items',
      'child_game_loadouts',
      'child_world_states',
      'child_world_entities',
      'child_world_scene_unlocks',
      'child_world_npc_dialogue_progress',
    ] }) as never, 'family-1', ['child-a', 'child-b']);

    assert.deepEqual(data['child-a'], {
      walletBalance: 0,
      catalog: [],
      prices: {},
      inventory: [],
      loadout: null,
      worldEntities: [],
      worldRevision: 0,
    });
    assert.deepEqual(data['child-b'], data['child-a']);
  });

  it('also treats a rejected game-table request with HTTP 404 as an optional fallback', async () => {
    const notFoundQuery = {
      select: () => notFoundQuery,
      order: () => notFoundQuery,
      eq: () => notFoundQuery,
      in: () => notFoundQuery,
      then: (_resolve: unknown, reject: (reason: Error & { status?: number }) => unknown) => {
        const error = Object.assign(new Error('Not Found'), { status: 404 });
        return Promise.reject(error).catch(reject);
      },
    };
    const data = await loadChildGameData({ from: () => notFoundQuery } as never, 'family-1', ['child-a']);
    assert.deepEqual(data['child-a'].catalog, []);
    assert.deepEqual(data['child-a'].worldEntities, []);
  });

  it('does not turn authorization or network failures into game-data fallbacks', async () => {
    const unauthorizedClient = {
      from: () => queryResult({ data: null, error: { code: '42501', message: 'permission denied for table game_catalog_items' } }),
    };
    await assert.rejects(
      () => loadChildGameData(unauthorizedClient as never, 'family-1', ['child-a']),
      /permission denied/,
    );
    await assert.rejects(
      () => loadChildGameData(gameDataClient({ networkFailure: true }) as never, 'family-1', ['child-a']),
      /network unavailable/,
    );
  });

  it('keeps write errors explicit instead of swallowing RPC failures', async () => {
    const repositoryClient = {
      rpc: async () => ({ data: null, error: { message: 'permission denied' } }),
      from: () => { throw new Error('from() should not be called'); },
    };
    const { createDataRepository } = await import('../src/lib/data-access');
    const repository = createDataRepository(repositoryClient as never);
    await assert.rejects(() => repository.setFamilyGameItemPrice('item-1', 5), /permission denied/);
  });
});
