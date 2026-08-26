import { useEffect, useRef } from 'react';
import { resumeAuthSessionFromUrl, toAuthErrorMessage } from '../auth';
import { getAppLinkIntent, hasAuthSessionPayload } from '../lib/auth-deep-link';
import { registerAppLinkListener } from '../lib/app-links';

interface AuthLinkBridgeProps {
  onLoginLink: () => void;
  onRecoveryLink: () => void;
  onRecoveryError: (message: string) => void;
}

export function AuthLinkBridge({ onLoginLink, onRecoveryLink, onRecoveryError }: AuthLinkBridgeProps) {
  const callbackRef = useRef({ onLoginLink, onRecoveryLink, onRecoveryError });
  callbackRef.current = { onLoginLink, onRecoveryLink, onRecoveryError };

  useEffect(() => {
    let active = true;
    const handledUrls = new Set<string>();

    const handleAppUrl = async (rawUrl: string) => {
      if (!active || handledUrls.has(rawUrl)) return;
      handledUrls.add(rawUrl);
      const intent = getAppLinkIntent(rawUrl);
      if (!intent) return;

      if (intent === 'login') {
        callbackRef.current.onLoginLink();
        return;
      }

      callbackRef.current.onRecoveryLink();
      if (!hasAuthSessionPayload(rawUrl)) {
        callbackRef.current.onRecoveryError('重設連結無效或已過期，請回到網頁重新寄送重設連結。');
        return;
      }

      try {
        await resumeAuthSessionFromUrl(rawUrl);
      } catch (failure) {
        if (active) callbackRef.current.onRecoveryError(toAuthErrorMessage(failure));
      }
    };

    let removeListener: (() => void) | null = null;
    void registerAppLinkListener(handleAppUrl).then((remove) => {
      if (!active) remove();
      else removeListener = remove;
    }).catch(() => {
      // Browser recovery remains available if the optional native listener fails.
    });

    return () => {
      active = false;
      removeListener?.();
    };
  }, []);

  return null;
}
