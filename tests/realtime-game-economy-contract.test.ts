import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { subscribeToAppData } from '../src/lib/realtime';

const gameTables = [
  'family_game_item_prices',
  'child_game_wallets',
  'child_inventory_items',
  'child_game_loadouts',
  'child_world_states',
  'child_world_entities',
] as const;

function createRealtimeClient() {
  const subscriptions: Array<{ event: string; schema: string; table: string; filter?: string }> = [];
  const channel = {
    on: (_event: string, config: { event: string; schema: string; table: string; filter?: string }) => {
      subscriptions.push(config);
      return channel;
    },
    subscribe: () => channel,
  };
  return {
    client: {
      channel: () => channel,
      removeChannel: async () => channel,
    } as never,
    subscriptions,
  };
}

describe('game economy realtime scope', () => {
  it('preserves legacy subscriptions and adds family-scoped game tables for parents', () => {
    const { client, subscriptions } = createRealtimeClient();

    subscribeToAppData(client, {
      familyId: 'family-a',
      role: 'parent',
      childProfileId: null,
      userId: 'user-a',
      onChange: () => undefined,
      onReconnect: () => undefined,
    });

    for (const table of ['family_members', 'child_profiles', 'tasks', 'point_ledger']) {
      assert.ok(subscriptions.some((subscription) => subscription.table === table));
    }
    for (const table of gameTables) {
      assert.deepEqual(
        subscriptions.find((subscription) => subscription.table === table),
        { event: '*', schema: 'public', table, filter: 'family_id=eq.family-a' },
      );
    }
  });

  it('uses family scope for prices and child scope for child-owned game rows', () => {
    const { client, subscriptions } = createRealtimeClient();

    subscribeToAppData(client, {
      familyId: 'family-a',
      role: 'child',
      childProfileId: 'child-a',
      userId: 'user-a',
      onChange: () => undefined,
      onReconnect: () => undefined,
    });

    assert.deepEqual(
      subscriptions.find((subscription) => subscription.table === 'family_game_item_prices'),
      { event: '*', schema: 'public', table: 'family_game_item_prices', filter: 'family_id=eq.family-a' },
    );
    for (const table of gameTables.slice(1)) {
      assert.deepEqual(
        subscriptions.find((subscription) => subscription.table === table),
        { event: '*', schema: 'public', table, filter: 'child_profile_id=eq.child-a' },
      );
    }
    assert.equal(
      subscriptions.some((subscription) => subscription.filter === 'family_id=eq.family-b' || subscription.filter === 'child_profile_id=eq.child-b'),
      false,
    );
  });
});
