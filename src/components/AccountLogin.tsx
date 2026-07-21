import React, { FormEvent, useState } from 'react';
import { Baby, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { signIn, signInChild, toAuthErrorMessage } from '../auth';
import { useAppStore } from '../store';
import { validateChildPassword, validateChildUsername, validateParentCredentials } from '../lib/auth-validation';

interface AccountLoginProps {
  onGoSignup: () => void;
  onComplete: (mode: 'parent' | 'child') => void;
  initialMode?: 'parent' | 'child';
}

export function AccountLogin({ onGoSignup, onComplete, initialMode = 'parent' }: AccountLoginProps) {
  const { error: sessionError } = useAppStore();
  const [mode, setMode] = useState<'parent' | 'child'>(initialMode);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const switchMode = (nextMode: 'parent' | 'child') => {
    setMode(nextMode);
    setAccount('');
    setPassword('');
    setError('');
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedAccount = account.trim();
    const validation = mode === 'parent'
      ? validateParentCredentials(normalizedAccount, password)
      : validateChildUsername(normalizedAccount);
    if ('message' in validation) {
      setError(validation.message);
      return;
    }
    const passwordValidation = mode === 'child' ? validateChildPassword(password) : { ok: true as const };
    if ('message' in passwordValidation) {
      setError(passwordValidation.message);
      return;
    }

    setSubmitting(true);
    try {
      const result = mode === 'parent'
        ? await signIn({ email: normalizedAccount, password })
        : await signInChild(normalizedAccount, password);
      if (result.error) setError(toAuthErrorMessage(result.error));
      else onComplete(mode);
    } catch (loginError) {
      setError(toAuthErrorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <form onSubmit={handleLogin} className="flex min-h-[100dvh] flex-col bg-blue-50 p-6">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-12">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            {mode === 'parent' ? <User size={36} /> : <Baby size={36} />}
          </div>
          <h1 className="text-3xl font-bold text-blue-900">HabitHero 習慣小英雄</h1>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-blue-100" role="tablist" aria-label="登入身份">
          <button type="button" role="tab" aria-selected={mode === 'parent'} onClick={() => switchMode('parent')} className={cn('min-h-11 rounded-xl px-3 py-2 text-sm font-bold transition-colors', mode === 'parent' ? 'bg-blue-500 text-white' : 'text-blue-700 hover:bg-blue-50')}>家長登入</button>
          <button type="button" role="tab" aria-selected={mode === 'child'} onClick={() => switchMode('child')} className={cn('min-h-11 rounded-xl px-3 py-2 text-sm font-bold transition-colors', mode === 'child' ? 'bg-yellow-500 text-white' : 'text-blue-700 hover:bg-blue-50')}>小孩登入</button>
        </div>

        <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <div>
            <label htmlFor="login-account" className="mb-1 block px-1 text-sm font-bold text-blue-900">{mode === 'parent' ? '家長 Email' : '小孩帳號名稱'}</label>
            <input id="login-account" type={mode === 'parent' ? 'email' : 'text'} required autoComplete="username" placeholder={mode === 'parent' ? 'parent@example.com' : '例如 leo123'} value={account} onChange={(event) => { setAccount(event.target.value); setError(''); }} className="w-full rounded-xl border border-blue-200 p-4 text-lg outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block px-1 text-sm font-bold text-blue-900">密碼</label>
            <input id="login-password" type="password" required minLength={6} autoComplete="current-password" placeholder="至少 6 碼" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} className="w-full rounded-xl border border-blue-200 p-4 text-lg outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {(error || sessionError) && <p role="alert" className="text-sm leading-6 text-red-600">{error || sessionError}</p>}
          <button type="submit" disabled={!account || !password || submitting} className={cn('w-full rounded-xl p-4 text-lg font-bold text-white transition-colors', account && password && !submitting ? (mode === 'parent' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-yellow-500 hover:bg-yellow-600') : 'cursor-not-allowed bg-blue-300')}>
            {submitting ? '登入中…' : '登入'}
          </button>
          {mode === 'parent' && <button type="button" onClick={onGoSignup} className="w-full rounded-xl p-3 font-bold text-blue-700 hover:bg-blue-50">沒有家長帳號？註冊</button>}
          {mode === 'child' && <p className="text-center text-sm leading-6 text-blue-600">小孩帳號由家長在管理端建立，無法自行註冊。</p>}
        </div>
      </div>
    </form>
  );
}
