import { AuthLinkBridge } from './AuthLinkBridge';
import { AnalyticsLifecycle } from './AnalyticsLifecycle';

interface AuthBridgeWithAnalyticsProps {
  currentView: string;
  onLoginLink: () => void;
  onRecoveryLink: () => void;
  onRecoveryError: (message: string | null) => void;
}

export function AuthBridgeWithAnalytics({ currentView, onLoginLink, onRecoveryLink, onRecoveryError }: AuthBridgeWithAnalyticsProps) {
  return (
    <>
      <AnalyticsLifecycle currentView={currentView} />
      <AuthLinkBridge onLoginLink={onLoginLink} onRecoveryLink={onRecoveryLink} onRecoveryError={onRecoveryError} />
    </>
  );
}
