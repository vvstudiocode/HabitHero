import type { SupabaseClient } from '@supabase/supabase-js';

interface RealtimeOptions {
  familyId: string;
  role: 'parent' | 'child';
  childProfileId: string | null;
  userId: string;
  onChange: () => void;
  onReconnect: () => void;
}

const familyTables = ['family_members', 'child_profiles', 'task_templates', 'tasks', 'rewards', 'wishlist_items', 'reward_redemptions', 'point_ledger'] as const;
const childTables = ['profiles', 'child_profiles', 'tasks', 'rewards', 'wishlist_items', 'reward_redemptions', 'point_ledger'] as const;

export function subscribeToAppData(client: SupabaseClient, options: RealtimeOptions) {
  const tables = options.role === 'parent' ? familyTables : childTables;
  const channel = client.channel(`habithero:${options.role}:${options.familyId}:${options.childProfileId ?? 'family'}`);

  for (const table of tables) {
    const filter = table === 'profiles'
      ? `id=eq.${options.userId}`
      : table === 'family_members' || table === 'child_profiles' || table === 'task_templates'
      ? `family_id=eq.${options.familyId}`
      : options.role === 'child' ? `child_profile_id=eq.${options.childProfileId}` : `family_id=eq.${options.familyId}`;
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, options.onChange);
  }
  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'SUBSCRIBED') options.onReconnect();
  });
  return () => { void client.removeChannel(channel); };
}
