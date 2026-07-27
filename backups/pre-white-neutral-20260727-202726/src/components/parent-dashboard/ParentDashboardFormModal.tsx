import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ParentDashboardFormModalProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

export function ParentDashboardFormModal({ title, closeLabel, onClose, children }: ParentDashboardFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-[70]">
      <div className="hh-form-modal-panel bg-white w-full max-w-sm rounded-t-3xl p-6 shadow-xl animate-slide-up">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="p-2 text-gray-400 bg-gray-100 rounded-full" aria-label={closeLabel}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
