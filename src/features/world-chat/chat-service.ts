import { canSendChatMessage, validateChatMessageText } from './limits';
import type { ChatReportInput, WorldChatMessage } from './contracts';
import type { WorldChatRepository } from '../../lib/social-data/world-chat-repository';

export const CANONICAL_SEND_RPC = 'send_friend_world_message';

export interface WorldChatService {
  list(limit?: number): Promise<WorldChatMessage[]>;
  unreadCount(): Promise<number>;
  send(body: string): Promise<WorldChatMessage>;
  markRead(messageId?: string): Promise<void>;
  report(input: ChatReportInput): Promise<void>;
  subscribe(onMessage: (message: WorldChatMessage) => void): () => void;
}

export function createWorldChatService(repository: WorldChatRepository, worldOwnerChildProfileId: string): WorldChatService {
  let sentAt: number[] = [];
  return {
    list: (limit) => repository.list(worldOwnerChildProfileId, limit),
    unreadCount: () => repository.getUnreadCount(worldOwnerChildProfileId),
    async send(body) {
      const validation = validateChatMessageText(body);
      if (!validation.ok) throw new Error(validation.reason);
      const now = Date.now();
      sentAt = sentAt.filter((timestamp) => Number.isFinite(timestamp) && timestamp > now - 60_000 && timestamp <= now);
      if (!canSendChatMessage(sentAt, now)) throw new Error('聊天訊息太頻繁，請稍後再試。');
      const message = await repository.send(worldOwnerChildProfileId, validation.normalized);
      sentAt = [...sentAt, now];
      return message;
    },
    markRead: (messageId) => repository.markRead(worldOwnerChildProfileId, messageId),
    report: (input) => repository.report(input),
    subscribe: (onMessage) => repository.subscribe(worldOwnerChildProfileId, onMessage),
  };
}
