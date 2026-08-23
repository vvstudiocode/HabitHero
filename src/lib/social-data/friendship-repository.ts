import type { SupabaseClient } from '@supabase/supabase-js';
import type { FriendRequest, FriendSummary } from '../../features/friends/contracts';

export interface FriendshipRepository {
  getMyCode(): Promise<string>;
  listFriends(): Promise<FriendSummary[]>;
  listRequests(): Promise<FriendRequest[]>;
  sendRequest(code: string): Promise<void>;
  acceptRequest(requestId: string): Promise<void>;
  declineRequest(requestId: string): Promise<void>;
  removeFriend(childProfileId: string): Promise<void>;
  blockChild(childProfileId: string): Promise<void>;
}

export function createFriendshipRepository(client: SupabaseClient): FriendshipRepository {
  return {
    getMyCode: async () => readCode(await client.rpc('get_my_friend_code')),
    listFriends: async () => mapRows(await client.rpc('list_my_friends')),
    listRequests: async () => mapRequests(await client.rpc('list_my_friend_requests')),
    sendRequest: async (code) => run(await client.rpc('send_friend_request', { target_friend_code: code })),
    acceptRequest: async (requestId) => run(await client.rpc('accept_friend_request', { target_request_id: requestId })),
    declineRequest: async (requestId) => run(await client.rpc('decline_friend_request', { target_request_id: requestId })),
    removeFriend: async (childProfileId) => run(await client.rpc('remove_friend', { target_child_profile_id: childProfileId })),
    blockChild: async (childProfileId) => run(await client.rpc('block_child', { target_child_profile_id: childProfileId })),
  };
}

function readCode(result: { data: unknown; error: { message?: string } | null }): string {
  if (result.error) throw new Error('好友代碼目前無法取得。');
  if (typeof result.data === 'string') return result.data;
  const value = result.data as { code?: unknown } | null;
  if (!value || typeof value.code !== 'string') throw new Error('好友代碼目前無法取得。');
  return value.code;
}

function mapRows(result: { data: unknown; error: { message?: string } | null }): FriendSummary[] {
  if (result.error) throw new Error('好友名單目前無法取得。');
  return Array.isArray(result.data) ? result.data.map((row) => mapFriend(row)) : [];
}

function mapRequests(result: { data: unknown; error: { message?: string } | null }): FriendRequest[] {
  if (result.error) throw new Error('好友邀請目前無法取得。');
  return Array.isArray(result.data) ? result.data.map((row) => mapRequest(row)) : [];
}

function mapFriend(value: unknown): FriendSummary {
  const row = asRecord(value);
  return { childProfileId: stringValue(row.child_profile_id), displayName: stringValue(row.display_name), isOnline: row.is_online === true, worldRevision: numberValue(row.world_revision) };
}

function mapRequest(value: unknown): FriendRequest {
  const row = asRecord(value);
  return { id: stringValue(row.id), direction: row.direction === 'outgoing' ? 'outgoing' : 'incoming', childProfileId: stringValue(row.child_profile_id), displayName: stringValue(row.display_name), createdAt: stringValue(row.created_at) };
}

function run(result: { error: { message?: string } | null }): void {
  if (result.error) throw new Error('好友操作目前無法完成。');
}

function asRecord(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; }
function stringValue(value: unknown): string { return typeof value === 'string' ? value : ''; }
function numberValue(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
