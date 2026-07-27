import type { ReactNode } from 'react';
import { ModalShell } from '../shared/ParentDashboardUI';

interface ParentDashboardFormModalProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

export function ParentDashboardFormModal({ title, closeLabel, onClose, children }: ParentDashboardFormModalProps) {
  return (
    <ModalShell title={title} closeLabel={closeLabel} onClose={onClose}>
      {children}
    </ModalShell>
  );
}
