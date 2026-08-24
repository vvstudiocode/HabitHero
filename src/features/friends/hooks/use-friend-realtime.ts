import { useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createFriendRealtimeChannel } from './friend-realtime';

interface UseFriendRealtimeOptions {
  client: SupabaseClient | null;
  childProfileId: string;
  enabled: boolean;
  onChange: () => void | Promise<void>;
}

const FRIEND_REFRESH_DEBOUNCE_MS = 250;

export function useFriendRealtime({ client, childProfileId, enabled, onChange }: UseFriendRealtimeOptions) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!client || !enabled || !childProfileId) return undefined;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void onChangeRef.current();
      }, FRIEND_REFRESH_DEBOUNCE_MS);
    };
    const cleanupChannel = createFriendRealtimeChannel(client, childProfileId, scheduleRefresh, scheduleRefresh);
    const refreshOnResume = () => {
      if (document.visibilityState !== 'hidden') scheduleRefresh();
    };

    window.addEventListener('focus', refreshOnResume);
    window.addEventListener('pageshow', refreshOnResume);
    document.addEventListener('visibilitychange', refreshOnResume);

    return () => {
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      cleanupChannel();
      window.removeEventListener('focus', refreshOnResume);
      window.removeEventListener('pageshow', refreshOnResume);
      document.removeEventListener('visibilitychange', refreshOnResume);
    };
  }, [childProfileId, client, enabled]);
}
