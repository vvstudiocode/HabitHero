import React, { FormEvent, useState } from 'react';
import { Baby, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { signIn, signInChild, toAuthErrorMessage } from '../auth';
import { useAppStore } from '../store';
import { validateChildPassword, validateChildUsername, validateParentCredentials } from '../lib/auth-validation';
import { SpriteLoginScene } from './SpriteLoginScene';

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
    <form onSubmit={handleLogin} className="hh-login-screen">
      <SpriteLoginScene />
      <div className="hh-login-sun" />
      <div className="hh-login-vignette" />
      <div className="hh-login-grain" />

      <main className="hh-login-shell">
        <section className="hh-login-copy" aria-label="HabitHero 登入視覺">
          <h1>HabitHero</h1>
          <p>讓孩子每天的小任務，像走進一座會發光的森林。</p>
        </section>

        <section className="hh-login-panel" aria-label="登入表單">
          <div className="hh-login-panel-head">
            <div className="hh-login-avatar" aria-hidden="true">
              {mode === 'parent' ? <User size={32} /> : <Baby size={32} />}
            </div>
            <div>
              <h2>回到你的冒險</h2>
              <p>{mode === 'parent' ? '家長管理端登入' : '小孩任務森林登入'}</p>
            </div>
          </div>

          <div className="hh-login-tabs" role="tablist" aria-label="登入身份">
            <button type="button" role="tab" aria-selected={mode === 'parent'} onClick={() => switchMode('parent')} className={cn(mode === 'parent' && 'is-active')}>家長登入</button>
            <button type="button" role="tab" aria-selected={mode === 'child'} onClick={() => switchMode('child')} className={cn(mode === 'child' && 'is-active')}>小孩登入</button>
          </div>

          <label htmlFor="login-account">{mode === 'parent' ? '家長 Email' : '小孩帳號名稱'}</label>
          <input id="login-account" type={mode === 'parent' ? 'email' : 'text'} required autoComplete="username" placeholder={mode === 'parent' ? 'parent@example.com' : '例如 leo123'} value={account} onChange={(event) => { setAccount(event.target.value); setError(''); }} />

          <label htmlFor="login-password">通關密語</label>
          <input id="login-password" type="password" required minLength={6} autoComplete="current-password" placeholder="至少 6 碼" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} />

          {(error || sessionError) && <p role="alert" className="hh-login-error">{error || sessionError}</p>}

          <button type="submit" disabled={!account || !password || submitting} className="hh-primary-button">
            {submitting ? '登入中…' : '登入任務森林'}
          </button>
          {mode === 'parent' && <button type="button" onClick={onGoSignup} className="hh-secondary-button">沒有家長帳號？註冊</button>}
          {mode === 'child' && <p className="hh-login-note">小孩帳號由家長在管理端建立，無法自行註冊。</p>}
        </section>
      </main>
    </form>
  );
}
