import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Baby } from 'lucide-react';
import { cn } from '../lib/utils';
import { signIn, signOut, toAuthErrorMessage, useAuthSession } from '../auth';
import { getSupabaseClient } from '../lib/supabase';
import { useAppStore } from '../store';

interface ChildLoginProps {
  onBack: () => void;
  onComplete: () => void;
}

export function ChildLogin({ onBack, onComplete }: ChildLoginProps) {
  const { session, loading: sessionLoading, error: sessionError } = useAuthSession();
  const { retry } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const handledExistingSession = useRef(false);

  useEffect(() => {
    if (session && !sessionLoading && !handledExistingSession.current && !submitting) {
      handledExistingSession.current = true;
      onComplete();
    }
  }, [onComplete, session, sessionLoading, submitting]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data, error: signInError } = await signIn({ email: email.trim(), password });
      if (signInError) {
        setError(toAuthErrorMessage(signInError));
        return;
      }

      const token = inviteToken.trim();
      if (token) {
        if (!/^[0-9a-fA-F]{64}$/.test(token)) {
          await signOut();
          setError('加入碼格式不正確，請貼上 64 碼邀請 token。');
          return;
        }
        if (!data.session) {
          await signOut();
          setError('登入 session 尚未建立，請重試。');
          return;
        }
        const { error: redeemError } = await getSupabaseClient().rpc('redeem_family_child_invite', { invite_token: token });
        if (redeemError) {
          await signOut();
          setError(redeemError.message || '加入家庭失敗，請確認邀請仍有效。');
          return;
        }
        setInviteToken('');
        // The provider may have attempted its first load before redemption.
        // Wait for that attempt, then force a second load with the new membership.
        await retry();
        await retry();
      }
      onComplete();
    } catch (signInError) {
      setError(toAuthErrorMessage(signInError));
    } finally {
      setSubmitting(false);
    }
  };

  const displayedError = error || sessionError;

  return (
    <form onSubmit={handleLogin} className="flex flex-col min-h-[100dvh] bg-blue-50 p-6">
      <button type="button" onClick={onBack} className="self-start p-2 text-blue-600 mb-8 rounded-full hover:bg-blue-100 transition-colors">
        <ArrowLeft size={24} />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        <div className="bg-yellow-100 p-4 rounded-full text-yellow-600 mb-6"><Baby size={40} /></div>
        <h2 className="text-2xl font-bold text-blue-900 mb-2">孩子登入</h2>
        <p className="text-blue-600 text-center mb-8">使用自己的 Supabase 帳號登入</p>
        <div className="w-full space-y-4">
          <input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} className="w-full p-4 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <input type="password" required minLength={6} autoComplete="current-password" placeholder="密碼" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} className="w-full p-4 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <input type="text" inputMode="text" autoComplete="off" spellCheck={false} placeholder="家庭邀請 token（加入新家庭時填寫）" value={inviteToken} onChange={(e) => { setInviteToken(e.target.value); setError(''); }} className="w-full p-4 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          {displayedError && <p role="alert" className="text-red-500 text-sm mt-2 px-1 text-center">{displayedError}</p>}
          <button type="submit" className={cn("w-full p-4 rounded-xl text-white font-medium text-lg transition-all", email && password && !sessionLoading && !submitting ? "bg-blue-500 hover:bg-blue-600 active:scale-[0.98]" : "bg-blue-300 cursor-not-allowed")} disabled={!email || !password || sessionLoading || submitting}>
            {submitting ? '登入中…' : '進入我的任務'}
          </button>
        </div>
      </div>
    </form>
  );
}
