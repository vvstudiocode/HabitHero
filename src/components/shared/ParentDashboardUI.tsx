import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalVariant = 'bottom' | 'center';

interface ModalShellProps {
  children: ReactNode;
  variant?: ModalVariant;
  title?: string;
  closeLabel?: string;
  onClose?: () => void;
  panelClassName?: string;
}

/** Shared backdrop and panel geometry for parent dashboard overlays. */
export function ModalShell({
  children,
  variant = 'bottom',
  title,
  closeLabel,
  onClose,
  panelClassName = '',
}: ModalShellProps) {
  const backdropClassName = variant === 'bottom'
    ? 'fixed inset-0 bg-black/40 flex items-end justify-center z-[70]'
    : 'fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[70]';
  const defaultPanelClassName = variant === 'bottom'
    ? 'hh-form-modal-panel bg-white w-full max-w-sm rounded-t-3xl p-6 shadow-xl animate-slide-up'
    : 'hh-parent-confirm-panel bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up';

  return (
    <div className={backdropClassName}>
      <div className={`${defaultPanelClassName} ${panelClassName}`.trim()}>
        {title && (
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">{title}</h3>
            {onClose && closeLabel && (
              <button onClick={onClose} className="p-2 text-gray-400 bg-gray-100 rounded-full" aria-label={closeLabel}>
                <X size={20} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  children: ReactNode;
  className?: string;
}

export function EmptyState({ children, className = '' }: EmptyStateProps) {
  return <div className={`text-center py-8 text-gray-700 text-sm ${className}`.trim()}>{children}</div>;
}
