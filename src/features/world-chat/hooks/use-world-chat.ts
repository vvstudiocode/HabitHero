import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WorldChatMessage, WorldChatState } from '../contracts';
import { createWorldChatService } from '../chat-service';
import { MAX_CHAT_HISTORY } from '../limits';
import type { WorldChatRepository } from '../../../lib/social-data/world-chat-repository';

// The repository owns the private channel and listens for postgres_changes and chat_created_v1.

const initialState: WorldChatState = { messages: [], unreadCount: 0, loading: false, sending: false, error: null };

export function useWorldChat(repository: WorldChatRepository | null, worldOwnerChildProfileId: string | null, enabled = true, currentChildProfileId?: string | null) {
  const service = useMemo(
    () => repository && worldOwnerChildProfileId ? createWorldChatService(repository, worldOwnerChildProfileId) : null,
    [repository, worldOwnerChildProfileId],
  );
  const [state, setState] = useState<WorldChatState>(initialState);
  const [latestMessage, setLatestMessage] = useState<WorldChatMessage | null>(null);
  const deliveredMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    setState(initialState);
    setLatestMessage(null);
    deliveredMessageIdRef.current = null;
  }, [enabled, service]);

  useEffect(() => {
    if (!enabled || !service) return undefined;
    return service.subscribe((message) => {
      if (!message.id || deliveredMessageIdRef.current === message.id) return;
      deliveredMessageIdRef.current = message.id;
      setLatestMessage(message);
      setState((current) => {
        if (current.messages.some((item) => item.id === message.id)) return current;
        return {
          ...current,
          messages: [...current.messages, message].slice(-MAX_CHAT_HISTORY),
          unreadCount: message.senderChildProfileId === currentChildProfileId ? current.unreadCount : current.unreadCount + 1,
        };
      });
    });
  }, [currentChildProfileId, enabled, service]);

  const send = useCallback(async (body: string) => {
    if (!service) return;
    setState((current) => ({ ...current, sending: true, error: null }));
    try {
      const message = await service.send(body);
      if (message.id && deliveredMessageIdRef.current !== message.id) {
        deliveredMessageIdRef.current = message.id;
        setLatestMessage(message);
      }
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

  return { ...state, latestMessage, send, report: service?.report ?? (async () => undefined) };
}
