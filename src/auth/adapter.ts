import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import { childAccountEmail, getPasswordRecoveryRedirectUrl } from '../lib/auth-validation';

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

export async function verifyCurrentParentPassword(password: string) {
  const client = getSupabaseClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData.session?.user.email) {
    throw new Error('目前登入狀態已失效，請重新登入。');
  }
  const { data, error } = await signIn({ email: sessionData.session.user.email, password });
  if (error || !data.session) throw new Error(error?.message ?? '家長密碼錯誤。');
  return data.session;
}

export async function updateCurrentParentPassword(password: string) {
  const { error } = await getSupabaseClient().auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function requestParentPasswordReset(email: string) {
  const redirectTo = typeof window === 'undefined'
    ? undefined
    : getPasswordRecoveryRedirectUrl(window.location.origin);
  return getSupabaseClient().auth.resetPasswordForEmail(email.trim(), redirectTo ? { redirectTo } : undefined);
}

export async function resetCurrentParentPassword(password: string) {
  const { error } = await getSupabaseClient().auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function switchChildToParent(password: string) {
  const { data, error } = await getSupabaseClient().functions.invoke('switch-to-parent', { body: { password } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  if (!data?.session) throw new Error('家長模式授權失敗，請稍後再試。');
  const { data: sessionData, error: sessionError } = await getSupabaseClient().auth.setSession(data.session);
  if (sessionError || !sessionData.session) throw new Error(sessionError?.message ?? '家長模式授權失敗，請稍後再試。');
  return sessionData.session;
}

export async function signUp(credentials: AuthCredentials) {
  return getSupabaseClient().auth.signUp(credentials);
}

export async function signOut() {
  return getSupabaseClient().auth.signOut();
}

export async function deleteCurrentAccount() {
  const { data, error } = await getSupabaseClient().functions.invoke('manage-account', { body: { action: 'delete' } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
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
    const rawMessage = error.message;
    if (/[\u3400-\u9fff]/.test(rawMessage)) return rawMessage;
    const message = rawMessage.toLowerCase();
    if (message.includes('invalid login credentials')) return 'Email 或密碼錯誤，請重新輸入。';
    if (message.includes('user already registered') || message.includes('already registered')) return '這個 Email 已經註冊，請直接登入。';
    if (message.includes('invalid email') || message.includes('email address')) return '請輸入有效的 Email。';
    if (message.includes('password should be at least') || message.includes('password is too short')) return '密碼長度不足，請重新輸入。';
    if (message.includes('child account name is already in use') || message.includes('username is already in use') || message.includes('already has an account')) return '這個小孩帳號名稱已被使用，請換一個。';
    if (message.includes('invalid child password') || message.includes('child password must be')) return '小孩密碼格式不正確，請輸入至少 6 碼英數字。';
    if (message.includes('email not confirmed')) return '目前帳號尚未啟用，請重新註冊或聯絡管理者。';
    if (message.includes('anonymous sign-ins are disabled') || message.includes('anonymous sign-in')) return '小孩登入功能尚未在 Supabase 啟用，請稍後再試。';
    if (message.includes('network') || message.includes('fetch')) return '目前無法連線，請檢查網路後重試。';
    return '帳號操作失敗，請稍後再試。';
  }
  return '登入服務暫時無法使用，請稍後重試。';
}
