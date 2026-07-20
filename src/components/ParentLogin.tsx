import React, { FormEvent, useState } from 'react';
import { ArrowLeft, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { signIn, toAuthErrorMessage, useAuthSession } from '../auth';

interface ParentLoginProps {
  onBack: () => void;
  onGoSignup: () => void;
  onComplete: () => void;
}

export function ParentLogin({ onBack, onGoSignup, onComplete }: ParentLoginProps) {
  const { session, loading: sessionLoading, error: sessionError } = useAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (session) onComplete();
  }, [onComplete, session]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { error: signInError } = await signIn({ email: email.trim(), password });
      if (signInError) setError(toAuthErrorMessage(signInError));
      else onComplete();
    } catch (signInError) {
      setError(toAuthErrorMessage(signInError));
    }
    setSubmitting(false);
  };

  const displayedError = error || sessionError;
  if (sessionLoading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-blue-50 text-blue-700">正在恢復登入狀態…</div>;
  }

  return (
    <form onSubmit={handleLogin} className="flex flex-col min-h-[100dvh] bg-blue-50 p-6">
      <div className="mb-8 flex items-center justify-between">
        <button type="button" onClick={onBack} aria-label="返回" className="rounded-full p-2 text-blue-600 transition-colors hover:bg-blue-100">
          <ArrowLeft size={24} />
        </button>
        <button type="button" onClick={onGoSignup} className="rounded-xl px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">
          還沒有帳號？註冊
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-sm w-full mx-auto pb-20">
        <div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-6"><User size={40} /></div>
        <h2 className="text-2xl font-bold text-blue-900 mb-2">家長登入</h2>
        <p className="text-blue-600 text-center mb-8">使用 Supabase 帳號登入</p>

        <div className="w-full space-y-4">
          <input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} className="w-full p-4 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <input type="password" required minLength={6} autoComplete="current-password" placeholder="密碼" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} className="w-full p-4 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          {displayedError && <p role="alert" className="text-red-500 text-sm mt-2 px-1 text-center">{displayedError}</p>}
          <button type="submit" className={cn("w-full p-4 rounded-xl text-white font-medium text-lg transition-all", email && password && !submitting ? "bg-blue-500 hover:bg-blue-600 active:scale-[0.98]" : "bg-blue-300 cursor-not-allowed")} disabled={!email || !password || submitting}>
            {submitting ? '登入中…' : '登入家長端'}
          </button>
        </div>
      </div>
    </form>
  );
}
