import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const supabaseUrl = viteEnv?.VITE_SUPABASE_URL;
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
