import type { SupabaseClient } from '@supabase/supabase-js';

interface FriendRealtimeSubscription {
  event: '*';
  schema: 'public';
  table: 'child_friend_requests' | 'child_friendships';
  filter: string;
}

const friendRealtimeColumns = [
  { table: 'child_friend_requests', column: 'requester_child_profile_id' },
  { table: 'child_friend_requests', column: 'addressee_child_profile_id' },
  { table: 'child_friendships', column: 'child_profile_id' },
  { table: 'child_friendships', column: 'friend_child_profile_id' },
] as const;

export function getFriendRealtimeSubscriptions(childProfileId: string): FriendRealtimeSubscription[] {
  return friendRealtimeColumns.map(({ table, column }) => ({
    event: '*',
    schema: 'public',
    table,
    filter: `${column}=eq.${childProfileId}`,
  }));
}

export function createFriendRealtimeChannel(
  client: SupabaseClient,
  childProfileId: string,
  onChange: () => void,
  onReconnect: () => void,
): () => void {
  const channel = client.channel(`habithero:friends:${childProfileId}`);
  for (const subscription of getFriendRealtimeSubscriptions(childProfileId)) {
    channel.on('postgres_changes', subscription, onChange);
  }

  let hadError = false;
  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      hadError = true;
      return;
    }
    if (status === 'SUBSCRIBED' && hadError) {
      hadError = false;
      onReconnect();
    }
  });

  return () => { void client.removeChannel(channel); };
}
