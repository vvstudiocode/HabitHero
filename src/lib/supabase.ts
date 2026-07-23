import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const supabaseUrl = resolveSupabaseUrl(viteEnv?.VITE_SUPABASE_URL);
const supabasePublishableKey = viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigError = getConfigError(supabaseUrl, supabasePublishableKey);

export const supabase: SupabaseClient | null = supabaseConfigError
  ? null
  : createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    });

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new SupabaseConfigError(supabaseConfigError ?? 'Supabase 尚未設定。');
  }
  return supabase;
}

function getConfigError(url: string | undefined, key: string | undefined): string | null {
  if (!url || !key) {
    return '缺少 Supabase 設定，請設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_PUBLISHABLE_KEY。';
  }

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return 'VITE_SUPABASE_URL 必須是 http 或 https 網址。';
    }
  } catch {
    return 'VITE_SUPABASE_URL 不是有效網址。';
  }

  return null;
}

function resolveSupabaseUrl(url: string | undefined): string | undefined {
  if (!url || Capacitor.getPlatform() !== 'android') return url;

  try {
    const parsedUrl = new URL(url);
    // Android's emulator maps 10.0.2.2 to the host machine. Keep browser and
    // iOS simulator development URLs unchanged, and leave remote URLs alone.
    if (parsedUrl.hostname === '127.0.0.1' || parsedUrl.hostname === 'localhost') {
      parsedUrl.hostname = '10.0.2.2';
      return parsedUrl.toString().replace(/\/$/, '');
    }
  } catch {
    // getConfigError() below provides the user-facing validation message.
  }

  return url;
}
