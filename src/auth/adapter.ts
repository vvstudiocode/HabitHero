import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import { childAccountEmail } from '../lib/auth-validation';

export interface AuthCredentials {
  email: string;
  password: string;
}

export type AuthStateListener = (event: AuthChangeEvent, session: Session | null) => void;

export async function signIn(credentials: AuthCredentials) {
  return getSupabaseClient().auth.signInWithPassword(credentials);
}

export async function signInChild(loginName: string, password: string) {
  return signIn({ email: childAccountEmail(loginName), password });
}

export async function signUp(credentials: AuthCredentials) {
  return getSupabaseClient().auth.signUp(credentials);
}

export async function signOut() {
  return getSupabaseClient().auth.signOut();
}

export async function getSession() {
  return getSupabaseClient().auth.getSession();
}

export function onAuthStateChange(listener: AuthStateListener): () => void {
  const { data } = getSupabaseClient().auth.onAuthStateChange(listener);
  return () => data.subscription.unsubscribe();
}

export function toAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    const message = error.message.toLowerCase();
    if (message.includes('invalid login credentials')) return 'Email 或密碼錯誤，請重新輸入。';
    if (message.includes('email not confirmed')) return '目前帳號尚未啟用，請重新註冊或聯絡管理者。';
    if (message.includes('anonymous sign-ins are disabled') || message.includes('anonymous sign-in')) return '小孩登入功能尚未在 Supabase 啟用，請稍後再試。';
    if (message.includes('network') || message.includes('fetch')) return '目前無法連線，請檢查網路後重試。';
    return error.message;
  }
  return '登入服務暫時無法使用，請稍後重試。';
}
