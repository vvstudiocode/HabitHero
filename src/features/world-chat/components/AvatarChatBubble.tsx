import type { CSSProperties } from 'react';
import type { ChatBubbleEntry } from '../chat-bubble-queue';
import { BUBBLE_DURATION_MS } from '../chat-bubble-queue';

interface AvatarChatBubbleProps {
  entry: ChatBubbleEntry;
  style?: CSSProperties;
}

export function AvatarChatBubble({ entry, style }: AvatarChatBubbleProps) {
  return (
    <div className="hh-world-chat-bubble" data-bubble-duration={BUBBLE_DURATION_MS} style={style} role="status" aria-label={`${entry.message.senderDisplayName} 的訊息`}>
      <div className="hh-world-chat-bubble-content">
        <span className="hh-world-chat-bubble-text line-clamp-2">{entry.message.body}</span>
      </div>
    </div>
  );
}
