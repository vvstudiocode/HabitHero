import type { CSSProperties } from 'react';
import { MessageCircle } from 'lucide-react';
import type { WorldNpcScreenPosition, WorldNpcSelection } from '../world-npc-runtime';

interface WorldNpcDialoguePromptProps {
  position: WorldNpcScreenPosition;
  onOpen: (selection: WorldNpcSelection) => void;
}

export function WorldNpcDialoguePrompt({ position, onOpen }: WorldNpcDialoguePromptProps) {
  const style = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    '--hh-world-npc-prompt-scale': position.scale,
  } as CSSProperties;

  return (
    <button
      type="button"
      className="hh-world-npc-dialogue-trigger"
      style={style}
      aria-label={`與${position.npcName}對話`}
      title={`與${position.npcName}對話`}
      onClick={() => onOpen(position)}
    >
      <MessageCircle size={23} strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
}
