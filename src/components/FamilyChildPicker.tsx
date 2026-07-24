import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Baby, LockKeyhole, User } from 'lucide-react';
import type { Child } from '../types';
import { dismissWithAnimation } from '../lib/utils';

interface FamilyChildPickerProps {
  children: Child[];
  onSelect: (childId: string) => void;
  onParentMode: () => void;
}

export function FamilyChildPicker({ children, onSelect, onParentMode }: FamilyChildPickerProps) {
  const [closing, setClosing] = useState(false);
  const dismiss = (action: () => void) => {
    if (closing) return;
    setClosing(true);
    dismissWithAnimation(action, '.hh-switch-modal-panel');
  };

  return createPortal(
    <div className="hh-modal-shell hh-switch-modal-shell fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-xs p-5" role="dialog" aria-modal="true" aria-labelledby="family-child-picker-title">
      <div className="hh-modal-panel hh-switch-modal-panel hh-family-picker-panel w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-slide-up">
        <div className="hh-family-picker-icon mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"><Baby size={28} /></div>
        <h2 id="family-child-picker-title" className="text-xl font-black text-gray-900">要切換到哪裡？</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">請選擇要使用的孩子視角，或進入家長管理端。</p>
        <div className="mt-5 space-y-2">
          {children.map((child) => (
            <button key={child.id} type="button" onClick={() => dismiss(() => onSelect(child.id))} className="hh-family-picker-child-option flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left font-black transition-colors">
              <User size={20} /> {child.name}的任務
            </button>
          ))}
          <button type="button" onClick={() => dismiss(onParentMode)} className="hh-family-picker-parent-option flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left font-black transition-colors">
            <LockKeyhole size={20} /> 家長管理端
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
