import { useEffect } from 'react';
import { useAppStore } from '../store';
import { useAuthSession } from '../auth';
import { configureAnalytics, trackAnalyticsScreen } from '../lib/analytics';

export function AnalyticsLifecycle({ currentView }: { currentView: string }) {
  const { state, role } = useAppStore();
  const { session } = useAuthSession();
  const childProfileId = role === 'parent' ? state.parentActiveChildId : state.childLoggedInId;

  useEffect(() => {
    configureAnalytics(session ? {
      userId: session.user.id,
      childProfileId,
    } : null);
  }, [childProfileId, session?.user.id]);

  useEffect(() => {
    if (session && currentView) trackAnalyticsScreen(currentView);
  }, [currentView, session?.user.id]);

  return null;
}
