import type { CSSProperties } from 'react';
import { DoorOpen } from 'lucide-react';
import type { TideglowGateScreenPosition } from '../tideglow-archipelago';

interface TideglowGateDialogueProps {
  position: TideglowGateScreenPosition;
  onEnter: () => void;
  label?: string;
}

export function TideglowGateDialogue({ position, onEnter, label = '前往潮光群島' }: TideglowGateDialogueProps) {
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
