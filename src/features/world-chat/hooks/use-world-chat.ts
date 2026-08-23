import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WorldChatMessage, WorldChatState } from '../contracts';
import { createWorldChatService } from '../chat-service';
import { MAX_CHAT_HISTORY, MAX_CHAT_PAGE_SIZE } from '../limits';
import type { WorldChatRepository } from '../../../lib/social-data/world-chat-repository';

// The repository owns the private channel and listens for postgres_changes and chat_created_v1.

const initialState: WorldChatState = { messages: [], unreadCount: 0, loading: false, sending: false, error: null };

export function useWorldChat(repository: WorldChatRepository | null, worldOwnerChildProfileId: string | null, enabled = true, currentChildProfileId?: string | null) {
  const service = useMemo(
    () => repository && worldOwnerChildProfileId ? createWorldChatService(repository, worldOwnerChildProfileId) : null,
    [repository, worldOwnerChildProfileId],
  );
  const [state, setState] = useState<WorldChatState>(initialState);
  const reload = useCallback(async () => {
    if (!service) return;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [messages, unreadCount] = await Promise.all([service.list(Math.min(MAX_CHAT_PAGE_SIZE, MAX_CHAT_HISTORY)), service.unreadCount()]);
      setState({ messages: messages.slice(-MAX_CHAT_HISTORY), unreadCount, loading: false, sending: false, error: null });
    } catch {
      setState((current) => ({ ...current, loading: false, error: '聊天資料目前無法取得。' }));
    }
  }, [service]);

  useEffect(() => {
    if (!enabled || !service) return undefined;
    void reload();
    return service.subscribe((message) => {
      setState((current) => {
        if (!message.id || current.messages.some((item) => item.id === message.id)) return current;
        return {
          ...current,
          messages: [...current.messages, message].slice(-MAX_CHAT_HISTORY),
          unreadCount: message.senderChildProfileId === currentChildProfileId ? current.unreadCount : current.unreadCount + 1,
        };
      });
    });
  }, [currentChildProfileId, enabled, reload, service]);

  const send = useCallback(async (body: string) => {
    if (!service) return;
    setState((current) => ({ ...current, sending: true, error: null }));
    try {
      const message = await service.send(body);
      setState((current) => ({
        ...current,
        messages: message.id && !current.messages.some((item) => item.id === message.id)
          ? [...current.messages, message].slice(-MAX_CHAT_HISTORY)
          : current.messages,
        sending: false,
      }));
    } catch (error) {
      setState((current) => ({ ...current, sending: false, error: error instanceof Error ? error.message : '訊息目前無法送出。' }));
      throw error;
    }
  }, [service]);

  const markRead = useCallback(async (messageId?: string) => {
    if (!service) return;
    await service.markRead(messageId);
    setState((current) => ({ ...current, unreadCount: 0 }));
  }, [service]);

  return { ...state, reload, send, markRead, report: service?.report ?? (async () => undefined) };
}
