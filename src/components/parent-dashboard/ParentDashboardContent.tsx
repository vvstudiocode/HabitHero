import type { CSSProperties, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ParentDashboardTab = 'review' | 'tasks' | 'growth' | 'rewards' | 'wishlist';

interface ParentDashboardContentProps {
  activeTab: ParentDashboardTab;
  onTabChange: (tab: ParentDashboardTab) => void;
  proposedTaskCount: number;
  pendingTicketCount: number;
  wishlistCount: number;
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
  activeTab,
  onTabChange,
  proposedTaskCount,
  pendingTicketCount,
  wishlistCount,
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
        "flex-1 p-6 pb-28",
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
      <ParentDashboardTabBar
        activeTab={activeTab}
        onTabChange={onTabChange}
        proposedTaskCount={proposedTaskCount}
        pendingTicketCount={pendingTicketCount}
        wishlistCount={wishlistCount}
      />
      {children}
    </main>
  );
}

interface ParentDashboardTabBarProps {
  activeTab: ParentDashboardTab;
  onTabChange: (tab: ParentDashboardTab) => void;
  proposedTaskCount: number;
  pendingTicketCount: number;
  wishlistCount: number;
}

function ParentDashboardTabBar({ activeTab, onTabChange, proposedTaskCount, pendingTicketCount, wishlistCount }: ParentDashboardTabBarProps) {
  const tabs: { id: ParentDashboardTab; label: string; tour?: string }[] = [
    { id: 'review', label: '審核', tour: 'review-tab' },
    { id: 'tasks', label: '任務', tour: 'tasks-tab' },
    { id: 'growth', label: '成長', tour: 'growth-tab' },
    { id: 'rewards', label: '獎勵', tour: 'rewards-tab' },
    { id: 'wishlist', label: '許願', tour: 'wishlist-tab' },
  ];

  return (
    <nav
      aria-label="家長選單分頁"
      className="hh-bottom-nav hh-bottom-nav--parent"
      style={{ '--active-index': tabs.findIndex(tab => tab.id === activeTab), '--item-count': 5 } as CSSProperties}
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          data-tour={tab.tour}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn("hh-bottom-nav-button", activeTab === tab.id && "is-active")}
        >
          {tab.label}
          {tab.id === 'review' && proposedTaskCount > 0 && (
            <span className="absolute top-1 right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center transform scale-90 leading-none">{proposedTaskCount}</span>
          )}
          {tab.id === 'rewards' && pendingTicketCount > 0 && <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />}
          {tab.id === 'wishlist' && wishlistCount > 0 && (
            <span className="absolute top-1 right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center transform scale-90 leading-none">{wishlistCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
