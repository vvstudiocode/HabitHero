import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ParentDashboardTab = 'review' | 'tasks' | 'growth' | 'rewards' | 'wishlist';

interface ParentDashboardContentProps {
  heroFeature: ParentDashboardTab | null;
  featureTitle?: string;
  onCloseFeature: () => void;
  isOffline: boolean;
  error: string | null;
  loading: boolean;
  onRetry: () => void;
  children: ReactNode;
}

export function ParentDashboardContent({
  heroFeature,
  featureTitle,
  onCloseFeature,
  isOffline,
  error,
  loading,
  onRetry,
  children,
}: ParentDashboardContentProps) {
  return (
    <main
      className={cn(
        "flex-1 p-6",
        heroFeature ? "hh-parent-content-modal" : "hh-parent-content-hidden"
      )}
      role={heroFeature ? 'dialog' : undefined}
      aria-modal={heroFeature ? true : undefined}
      aria-label={heroFeature ? '家長功能頁面' : undefined}
    >
      {heroFeature && (
        <div className="hh-parent-content-modal-bar">
          <strong>{featureTitle}</strong>
          <button type="button" onClick={onCloseFeature} aria-label="關閉功能頁面" className="hh-character-icon-button">
            <X size={18} />
          </button>
        </div>
      )}
      {isOffline && (
        <div role="status" className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <span>目前離線，尚未同步的變更不會被視為成功。</span>
          <button type="button" onClick={onRetry} disabled={loading} className="shrink-0 font-bold underline disabled:opacity-50">重試</button>
        </div>
      )}
      {error && (
        <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={onRetry} disabled={loading} className="shrink-0 font-bold underline disabled:opacity-50">重試</button>
        </div>
      )}
      {children}
    </main>
  );
}
