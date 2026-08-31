import type { CSSProperties } from 'react';
import { MessageCircle } from 'lucide-react';
import type { AdventureTableScreenPosition } from '../../world/adventure-table';

interface AdventureTableDialogueProps {
  position: AdventureTableScreenPosition;
  onOpenBoard: () => void;
}

export function AdventureTableDialogue({ position, onOpenBoard }: AdventureTableDialogueProps) {
  const style = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    '--hh-adventure-table-prompt-scale': position.scale,
  } as CSSProperties;

  return (
    <button
      type="button"
      className="hh-adventure-table-dialogue"
      style={style}
      aria-label="開始冒險"
      onClick={onOpenBoard}
    >
      <MessageCircle size={18} strokeWidth={2.4} aria-hidden="true" />
      <span>開始冒險</span>
    </button>
  );
}
