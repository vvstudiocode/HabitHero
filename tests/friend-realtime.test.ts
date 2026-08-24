import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createFriendRealtimeChannel,
  getFriendRealtimeSubscriptions,
} from '../src/features/friends/hooks/friend-realtime';

describe('friend realtime synchronization', () => {
  it('subscribes to both sides of requests and friendships', () => {
    assert.deepEqual(getFriendRealtimeSubscriptions('child-1'), [
      { event: '*', schema: 'public', table: 'child_friend_requests', filter: 'requester_child_profile_id=eq.child-1' },
      { event: '*', schema: 'public', table: 'child_friend_requests', filter: 'addressee_child_profile_id=eq.child-1' },
      { event: '*', schema: 'public', table: 'child_friendships', filter: 'child_profile_id=eq.child-1' },
      { event: '*', schema: 'public', table: 'child_friendships', filter: 'friend_child_profile_id=eq.child-1' },
    ]);
  });

  it('forwards row changes and only treats a recovered channel as a reconnect', () => {
    const subscriptions: Array<{ config: Record<string, string>; handler: () => void }> = [];
    let statusHandler: ((status: string) => void) | undefined;
    let removed = false;
    const channel = {
      on: (_event: string, config: Record<string, string>, handler: () => void) => {
        subscriptions.push({ config, handler });
        return channel;
      },
      subscribe: (handler: (status: string) => void) => {
        statusHandler = handler;
        return channel;
      },
    };
    const client = {
      channel: () => channel,
      removeChannel: async () => {
        removed = true;
        return 'ok';
      },
    } as never;
    let changes = 0;
    let reconnects = 0;

    const cleanup = createFriendRealtimeChannel(client, 'child-1', () => { changes += 1; }, () => { reconnects += 1; });

    assert.equal(subscriptions.length, 4);
    subscriptions[0].handler();
    assert.equal(changes, 1);
    statusHandler?.('CHANNEL_ERROR');
    statusHandler?.('SUBSCRIBED');
    assert.equal(reconnects, 1);
    cleanup();
    assert.equal(removed, true);
  });
});
