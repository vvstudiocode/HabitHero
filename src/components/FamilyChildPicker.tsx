import { Baby, LockKeyhole, User } from 'lucide-react';
import type { Child } from '../types';

interface FamilyChildPickerProps {
  children: Child[];
  onSelect: (childId: string) => void;
  onParentMode: () => void;
}

export function FamilyChildPicker({ children, onSelect, onParentMode }: FamilyChildPickerProps) {
  return (
    <div className="hh-modal-shell hh-switch-modal-shell fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-5" role="dialog" aria-modal="true" aria-labelledby="family-child-picker-title">
      <div className="hh-modal-panel hh-switch-modal-panel w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700"><Baby size={28} /></div>
        <h2 id="family-child-picker-title" className="text-xl font-black text-gray-900">要切換到哪裡？</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">請選擇要使用的孩子視角，或進入家長管理端。</p>
        <div className="mt-5 space-y-2">
          {children.map((child) => (
            <button key={child.id} type="button" onClick={() => onSelect(child.id)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-yellow-100 bg-yellow-50 px-4 text-left font-black text-yellow-950 hover:bg-yellow-100">
              <User size={20} /> {child.name}的任務
            </button>
          ))}
          <button type="button" onClick={onParentMode} className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 text-left font-black text-blue-900 hover:bg-blue-100">
            <LockKeyhole size={20} /> 家長管理端
          </button>
        </div>
      </div>
    </div>
  );
}
