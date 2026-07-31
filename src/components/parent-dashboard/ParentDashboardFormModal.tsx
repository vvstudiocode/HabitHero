import type { ReactNode } from 'react';
import { ModalShell } from '../shared/ParentDashboardUI';

interface ParentDashboardFormModalProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'bottom' | 'center';
  panelClassName?: string;
}

export function ParentDashboardFormModal({
  title,
  closeLabel,
  onClose,
  children,
  variant = 'bottom',
  panelClassName,
}: ParentDashboardFormModalProps) {
  return (
    <ModalShell
      title={title}
      closeLabel={closeLabel}
      onClose={onClose}
      variant={variant}
      panelClassName={panelClassName}
    >
      {children}
    </ModalShell>
  );
}
