import type { CSSProperties } from 'react';
import type { ChatBubbleEntry } from '../chat-bubble-queue';
import { BUBBLE_DURATION_MS } from '../chat-bubble-queue';

interface AvatarChatBubbleProps {
  entry: ChatBubbleEntry;
  style?: CSSProperties;
}

export function AvatarChatBubble({ entry, style }: AvatarChatBubbleProps) {
  return (
    <div className="pointer-events-none fixed z-35 max-w-48 rounded-2xl border border-white/80 bg-white/95 px-3 py-2 shadow-lg motion-safe:animate-[fade-in_.2s_ease-out] motion-reduce:transition-none" data-bubble-duration={BUBBLE_DURATION_MS} style={style} role="status" aria-label={`${entry.message.senderDisplayName} 的訊息`}>
      <strong className="block text-xs font-black text-indigo-700">{entry.message.senderDisplayName}</strong>
      <span className="line-clamp-2 break-words text-sm font-bold text-slate-800">{entry.message.body}</span>
    </div>
  );
}
