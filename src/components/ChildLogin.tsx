import React, { FormEvent, useState } from 'react';
import { ArrowLeft, Baby } from 'lucide-react';
import { cn } from '../lib/utils';
import { signInAnonymously, signOut, toAuthErrorMessage } from '../auth';
import { getSupabaseClient } from '../lib/supabase';
import { isAnonymousAuthError, validateChildPassword } from '../lib/auth-validation';
import { useAppStore } from '../store';

interface ChildLoginProps {
  onBack: () => void;
  onComplete: () => void;
}

export function ChildLogin({ onBack, onComplete }: ChildLoginProps) {
  const { retry, loading: appLoading } = useAppStore();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const validation = validateChildPassword(password);
    if ('message' in validation) {
      setError(validation.message);
      return;
    }

    setSubmitting(true);
    try {
      await signOut();
      const { error: anonymousError } = await signInAnonymously();
      if (anonymousError) {
        setError(isAnonymousAuthError(anonymousError) ? '小孩登入功能尚未啟用，請聯絡家長。' : toAuthErrorMessage(anonymousError));
        return;
      }

      const { error: authenticateError } = await getSupabaseClient().rpc('authenticate_child', { child_password: password });
      if (authenticateError) {
        await signOut();
        const message = authenticateError.message.toLowerCase();
        if (message.includes('already bound')) {
          setError('這組密碼已綁定其他裝置，請家長重設小孩密碼後再登入。');
        } else if (message.includes('anonymous session')) {
          setError('小孩登入連線已失效，請重新按「進入我的任務」。');
        } else {
          setError('密碼錯誤或尚未由家長建立，請重新輸入。');
        }
        return;
      }

      // The provider may have started its anonymous-session load before the
      // RPC finished. The second retry guarantees the new child membership is
      // read after that stale attempt has settled.
      await retry();
      await retry();
      setPassword('');
      onComplete();
    } catch (loginError) {
      await signOut();
      setError(toAuthErrorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="flex min-h-[100dvh] flex-col bg-blue-50 p-6">
      <button type="button" onClick={onBack} aria-label="返回" className="self-start rounded-full p-2 text-blue-600 transition-colors hover:bg-blue-100">
        <ArrowLeft size={24} />
      </button>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center pb-20">
        <div className="mb-6 rounded-full bg-yellow-100 p-4 text-yellow-600"><Baby size={40} /></div>
        <h2 className="mb-2 text-2xl font-bold text-blue-900">小孩登入</h2>
        <p className="mb-8 text-center text-blue-600">輸入家長為你設定的密碼即可進入</p>
        <div className="w-full space-y-4">
          <label className="block text-sm font-bold text-blue-900" htmlFor="child-password">小孩密碼</label>
          <input id="child-password" type="password" required minLength={6} autoComplete="current-password" placeholder="至少 6 碼英數密碼" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} className="w-full rounded-xl border border-blue-200 p-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          {error && <p role="alert" className="px-1 text-center text-sm text-red-500">{error}</p>}
          <button type="submit" className={cn('w-full rounded-xl p-4 text-lg font-medium text-white transition-all', password && !appLoading && !submitting ? 'bg-blue-500 hover:bg-blue-600 active:scale-[0.98]' : 'cursor-not-allowed bg-blue-300')} disabled={!password || appLoading || submitting}>
            {submitting ? '確認中…' : '進入我的任務'}
          </button>
        </div>
      </div>
    </form>
  );
}
