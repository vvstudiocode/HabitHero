export const CHAT_CREATED_EVENT = 'chat_created_v1' as const;

export type WorldChatMessageStatus = 'visible' | 'hidden';

export interface WorldChatMessage {
  id: string;
  worldOwnerChildProfileId: string;
  senderChildProfileId: string;
  senderDisplayName: string;
  body: string;
  status: WorldChatMessageStatus;
  createdAt: string;
}

export interface ChatReportInput {
  messageId: string;
  reason?: string;
}

export interface WorldChatState {
  messages: WorldChatMessage[];
  unreadCount: number;
  loading: boolean;
  sending: boolean;
  error: string | null;
}
