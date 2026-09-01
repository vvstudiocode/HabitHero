import type { CSSProperties } from 'react';
import { DoorOpen } from 'lucide-react';
import type { ForestValleyGateScreenPosition } from '../forest-valley';

interface ForestValleyGateDialogueProps {
  position: ForestValleyGateScreenPosition;
  onEnter: () => void;
  label?: string;
}

export function ForestValleyGateDialogue({ position, onEnter, label = '進入森語谷' }: ForestValleyGateDialogueProps) {
  const style = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    '--hh-adventure-table-prompt-scale': position.scale,
  } as CSSProperties;

  return (
    <button
      type="button"
      className="hh-world-gate-dialogue"
      style={style}
      aria-label={label}
      onClick={onEnter}
    >
      <DoorOpen size={18} strokeWidth={2.4} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
