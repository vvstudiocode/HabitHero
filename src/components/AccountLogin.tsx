import React, { FormEvent, useState } from 'react';
import { Baby, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { signIn, signInChild, toAuthErrorMessage } from '../auth';
import { useAppStore } from '../store';
import { validateChildPassword, validateChildUsername, validateParentLoginCredentials } from '../lib/auth-validation';
import { SpriteLoginScene } from './SpriteLoginScene';

interface AccountLoginProps {
  onGoSignup: () => void;
  onComplete: (mode: 'parent' | 'child') => void;
  initialMode?: 'parent' | 'child';
}

export function AccountLogin({ onGoSignup, onComplete, initialMode = 'parent' }: AccountLoginProps) {
  const { error: sessionError } = useAppStore();
  const [mode, setMode] = useState<'parent' | 'child'>(initialMode);
  const [revealed, setRevealed] = useState(false);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const switchMode = (nextMode: 'parent' | 'child') => {
    setMode(nextMode);
    setRevealed(true);
    setAccount('');
    setPassword('');
    setError('');
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedAccount = account.trim();
    const validation = mode === 'parent'
      ? validateParentLoginCredentials(normalizedAccount, password)
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
    <form onSubmit={handleLogin} className="hh-login-screen hh-login-screen--entry">
      <SpriteLoginScene />
      <div className="hh-login-sun" />
      <div className="hh-login-vignette" />
      <div className="hh-login-grain" />

      <main className="hh-login-shell">
        <section className="hh-login-copy" aria-label="HabitHero 登入視覺">
          <h1>HabitHero</h1>
          <p>
            把每天的小任務
            <br />
            變成孩子看得見
            <br />
            也想完成的成就旅程
          </p>
        </section>

        <section className={cn('hh-login-panel', revealed && 'is-revealed')} aria-label="登入表單">
          <div className="hh-login-tabs" role="tablist" aria-label="登入身份">
            <button type="button" role="tab" aria-selected={revealed && mode === 'parent'} onClick={() => switchMode('parent')} className={cn(revealed && mode === 'parent' && 'is-active')}>
              <User size={20} />
              <span>家長登入</span>
            </button>
            <button type="button" role="tab" aria-selected={revealed && mode === 'child'} onClick={() => switchMode('child')} className={cn(revealed && mode === 'child' && 'is-active')}>
              <Baby size={20} />
              <span>小孩登入</span>
            </button>
          </div>

          {revealed && (
            <div className="hh-login-fields">
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
            </div>
          )}
        </section>
      </main>
    </form>
  );
}
