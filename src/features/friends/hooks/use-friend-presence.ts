import { useEffect, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getFriendWorldLiveTopic } from '../../world-multiplayer/world-topic';
import { flattenPresenceState } from '../../world-multiplayer/world-presence';

interface FriendPresenceOptions {
  client: SupabaseClient | null;
  friendIds: readonly string[];
  enabled?: boolean;
}

interface FriendPresenceState {
  onlineFriendIds: ReadonlySet<string>;
  checkedFriendIds: ReadonlySet<string>;
}

export function useFriendPresence({ client, friendIds, enabled = true }: FriendPresenceOptions): FriendPresenceState {
  const friendIdsKey = [...new Set(friendIds)].filter(Boolean).sort().join('|');
  const [onlineFriendIds, setOnlineFriendIds] = useState<ReadonlySet<string>>(() => new Set());
  const [checkedFriendIds, setCheckedFriendIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const ids = friendIdsKey ? friendIdsKey.split('|') : [];
    setOnlineFriendIds(new Set());
    setCheckedFriendIds(enabled && client ? new Set() : new Set(ids));
    if (!enabled || !client || ids.length === 0) return undefined;

    let disposed = false;
    const channels: Array<{ friendId: string; channel: RealtimeChannel }> = [];
    const markChecked = (friendId: string) => {
      if (disposed) return;
      setCheckedFriendIds((current) => new Set([...current, friendId]));
    };
    const refresh = (friendId: string, channel: RealtimeChannel) => {
      if (disposed) return;
      const isOnline = flattenPresenceState(channel.presenceState()).some((member) => member.childProfileId === friendId);
      setOnlineFriendIds((current) => {
        const next = new Set(current);
        if (isOnline) next.add(friendId);
        else next.delete(friendId);
        return next;
      });
      markChecked(friendId);
    };
    const subscribe = async () => {
      try {
        await client.realtime.setAuth();
      } catch {
        ids.forEach(markChecked);
        return;
      }
      if (disposed) return;
      ids.forEach((friendId) => {
        const channel = client.channel(getFriendWorldLiveTopic(friendId), { config: { private: true } });
        channels.push({ friendId, channel });
        const refreshPresence = () => refresh(friendId, channel);
        channel.on('presence', { event: 'sync' }, refreshPresence);
        channel.on('presence', { event: 'join' }, refreshPresence);
        channel.on('presence', { event: 'leave' }, refreshPresence);
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') refreshPresence();
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') markChecked(friendId);
        });
      });
    };
    void subscribe();

    return () => {
      disposed = true;
      channels.forEach(({ channel }) => { void client.removeChannel(channel); });
    };
  }, [client, enabled, friendIdsKey]);

  return { onlineFriendIds, checkedFriendIds };
}
