import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSession, onAuthStateChange, toAuthErrorMessage } from './adapter';
import { supabaseConfigError } from '../lib/supabase';

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!supabaseConfigError);
  const [error, setError] = useState<string | null>(supabaseConfigError);

  useEffect(() => {
    if (supabaseConfigError) return;

    let active = true;
    const unsubscribe = onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    void getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) setError(toAuthErrorMessage(sessionError));
        setSession(data.session);
      })
      .catch((sessionError: unknown) => {
        if (active) setError(toAuthErrorMessage(sessionError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { session, loading, error };
}
