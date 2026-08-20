interface AppLoadingGateInput {
  sessionLoading: boolean;
  dataLoading: boolean;
  hasSession: boolean;
  dataReady: boolean;
}

export function shouldBlockAppForDataLoad({ sessionLoading, dataLoading, hasSession, dataReady }: AppLoadingGateInput) {
  // Block UI only during initial load. Once data is ready, background
  // refreshes (realtime, reconnect) should NOT replace the dashboard
  // with a loading screen.
  if (sessionLoading) return true;
  if (hasSession && !dataReady) return true;
  if (dataLoading && !dataReady) return true;
  return false;
}

export function shouldRefreshAppDataOnResume({
  visibilityState,
  isOnline,
}: {
  visibilityState: 'visible' | 'hidden';
  isOnline: boolean;
}) {
  return visibilityState === 'visible' && isOnline;
}

interface InitialLoadDoneInput {
  initialLoadDone: boolean;
  sessionLoading: boolean;
  hasSession: boolean;
  dataReady: boolean;
  hasDataError: boolean;
}

export function shouldMarkInitialLoadDone({
  initialLoadDone,
  sessionLoading,
  hasSession,
  dataReady,
  hasDataError,
}: InitialLoadDoneInput) {
  if (initialLoadDone) return false;
  if (sessionLoading) return false;
  if (!hasSession) return true;
  return dataReady || hasDataError;
}
