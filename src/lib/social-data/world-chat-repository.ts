import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ChatReportInput, WorldChatMessage } from '../../features/world-chat/contracts';
import { MAX_CHAT_PAGE_SIZE } from '../../features/world-chat/limits';

export const WORLD_CHAT_TABLES = {
  messages: 'friend_world_messages',
  reads: 'friend_world_message_reads',
  reports: 'friend_world_message_reports',
} as const;

export interface WorldChatRepository {
  list(worldOwnerChildProfileId: string, limit?: number): Promise<WorldChatMessage[]>;
  getUnreadCount(worldOwnerChildProfileId: string): Promise<number>;
  send(worldOwnerChildProfileId: string, body: string): Promise<WorldChatMessage>;
  markRead(worldOwnerChildProfileId: string, messageId?: string): Promise<void>;
  report(input: ChatReportInput): Promise<void>;
  subscribe(worldOwnerChildProfileId: string, onMessage: (message: WorldChatMessage) => void): () => void;
}

interface SharedWorldChatChannel {
  channel: RealtimeChannel;
  listeners: Set<(message: WorldChatMessage) => void>;
  active: boolean;
  subscribed: boolean;
}

const sharedWorldChatChannels = new WeakMap<SupabaseClient, Map<string, SharedWorldChatChannel>>();

export function createWorldChatRepository(client: SupabaseClient): WorldChatRepository {
  return {
    list: (owner, limit) => listMessages(client, owner, limit),
    getUnreadCount: (owner) => getUnreadCount(client, owner),
    send: (owner, body) => sendMessage(client, owner, body),
    markRead: (owner, messageId) => markRead(client, owner, messageId),
    report: (input) => reportMessage(client, input),
    subscribe: (owner, onMessage) => subscribeToMessages(client, owner, onMessage),
  };
}

async function listMessages(client: SupabaseClient, owner: string, limit = MAX_CHAT_PAGE_SIZE): Promise<WorldChatMessage[]> {
  const result = await client
    .from(WORLD_CHAT_TABLES.messages)
    .select('id, world_owner_child_profile_id, sender_child_profile_id, sender_display_name, body, status, created_at')
    .eq('world_owner_child_profile_id', owner)
    .eq('status', 'visible')
    .order('created_at', { ascending: false })
    .limit(Math.min(MAX_CHAT_PAGE_SIZE, Math.max(1, limit)));
  if (result.error) throw new Error('聊天記錄目前無法取得。');
  return (result.data ?? []).map(mapMessage).reverse();
}

async function getUnreadCount(client: SupabaseClient, owner: string): Promise<number> {
  const result = await client.rpc('get_friend_world_message_unread_count', {
    target_world_owner_child_profile_id: owner,
  });
  if (result.error) throw new Error('未讀訊息目前無法取得。');
  return typeof result.data === 'number' ? result.data : 0;
}

async function sendMessage(client: SupabaseClient, owner: string, body: string): Promise<WorldChatMessage> {
  const result = await client.rpc('send_friend_world_message', {
    target_world_owner_child_profile_id: owner,
    message_text: body,
  });
  if (result.error) throw new Error('訊息目前無法送出。');
  return mapMessage(result.data);
}

async function markRead(client: SupabaseClient, owner: string, messageId?: string): Promise<void> {
  const result = await client.rpc('mark_friend_world_messages_read', {
    target_world_owner_child_profile_id: owner,
    target_message_id: messageId ?? null,
  });
  if (result.error) throw new Error('聊天已讀狀態目前無法更新。');
}

async function reportMessage(client: SupabaseClient, input: ChatReportInput): Promise<void> {
  const result = await client.rpc('report_friend_world_message', {
    target_message_id: input.messageId,
    report_reason: input.reason ?? '未提供原因',
  });
  if (result.error) throw new Error('檢舉目前無法送出。');
}

function subscribeToMessages(client: SupabaseClient, owner: string, onMessage: (message: WorldChatMessage) => void): () => void {
  let channels = sharedWorldChatChannels.get(client);
  if (!channels) {
    channels = new Map();
    sharedWorldChatChannels.set(client, channels);
  }

  let entry = channels.get(owner);
  if (!entry) {
    const channel = client.channel(`friend-world:${owner}`, { config: { private: true } });
    entry = {
      channel,
      listeners: new Set(),
      active: true,
      subscribed: false,
    };
    channels.set(owner, entry);
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'friend_world_messages',
      filter: `world_owner_child_profile_id=eq.${owner}`,
    }, (payload) => {
      const message = mapMessage((payload as { new?: unknown }).new);
      // Postgres Changes is the canonical row stream. Broadcast is reserved
      // for hints and must never be treated as chat data.
      if (!message.id || message.status !== 'visible') return;
      [...entry.listeners].forEach((listener) => listener(message));
    });
    void Promise.resolve()
      .then(() => client.realtime.setAuth())
      .then(() => {
        if (!entry?.active || entry.listeners.size === 0 || channels?.get(owner) !== entry) return;
        entry.subscribed = true;
        entry.channel.subscribe();
      })
      .catch(() => {
        if (channels?.get(owner) === entry) channels.delete(owner);
        if (channels?.size === 0) sharedWorldChatChannels.delete(client);
        entry.active = false;
      });
  }

  entry.listeners.add(onMessage);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry?.listeners.delete(onMessage);
    if (!entry || entry.listeners.size > 0) return;
    entry.active = false;
    channels?.delete(owner);
    if (channels?.size === 0) sharedWorldChatChannels.delete(client);
    if (entry.subscribed) void client.removeChannel(entry.channel).catch(() => undefined);
  };
}

function mapMessage(value: unknown): WorldChatMessage {
  const row = asRecord(value);
  return {
    id: stringValue(row.id),
    worldOwnerChildProfileId: stringValue(row.world_owner_child_profile_id),
    senderChildProfileId: stringValue(row.sender_child_profile_id),
    senderDisplayName: stringValue(row.sender_display_name),
    body: stringValue(row.body),
    status: row.status === 'hidden' ? 'hidden' : 'visible',
    createdAt: stringValue(row.created_at),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string { return typeof value === 'string' ? value : ''; }
