import type { WorldChatMessage } from './contracts';

export const BUBBLE_DURATION_MS = 3_000;

export interface ChatBubbleEntry {
  message: WorldChatMessage;
  enqueuedAt: number;
}

export function enqueueChatBubble(
  queue: readonly ChatBubbleEntry[],
  message: WorldChatMessage,
  now: number,
): ChatBubbleEntry[] {
  return [
    ...queue.filter((entry) => entry.message.senderChildProfileId !== message.senderChildProfileId),
    { message, enqueuedAt: now },
  ];
}

export function getVisibleChatBubbles(queue: readonly ChatBubbleEntry[], now: number): ChatBubbleEntry[] {
  return queue.filter((entry) => now < entry.enqueuedAt + BUBBLE_DURATION_MS);
}
