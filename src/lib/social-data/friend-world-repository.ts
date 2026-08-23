import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeFriendWorldSnapshot,
  type FriendWorldSnapshot,
} from '../../features/friends/friend-world-snapshot';

export interface FriendWorldRepository {
  getFriendWorldSnapshot(targetChildProfileId: string): Promise<FriendWorldSnapshot>;
}

function normalizeTargetId(targetChildProfileId: string): string {
  if (typeof targetChildProfileId !== 'string') {
    throw new TypeError('好友世界目標無效。');
  }
  const normalized = targetChildProfileId.trim();
  if (!normalized || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new TypeError('好友世界目標無效。');
  }
  return normalized;
}

export async function getFriendWorldSnapshot(
  client: SupabaseClient,
  targetChildProfileId: string,
): Promise<FriendWorldSnapshot> {
  const targetId = normalizeTargetId(targetChildProfileId);
  const { data, error } = await client.rpc('get_friend_world_snapshot', {
    target_child_profile_id: targetId,
  });
  if (error) throw new Error('好友世界載入失敗。');

  try {
    return normalizeFriendWorldSnapshot(data);
  } catch {
    throw new Error('好友世界資料無效。');
  }
}

export function createFriendWorldRepository(client: SupabaseClient): FriendWorldRepository {
  return {
    getFriendWorldSnapshot: (targetChildProfileId) => getFriendWorldSnapshot(client, targetChildProfileId),
  };
}
