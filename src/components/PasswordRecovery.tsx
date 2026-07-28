import { FormEvent, useState } from 'react';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { requestParentPasswordReset, resetCurrentParentPassword, signOut, toAuthErrorMessage } from '../auth';
import { validateParentLoginCredentials, validateParentResetPassword } from '../lib/auth-validation';
import { SpriteLoginScene } from './SpriteLoginScene';

interface PasswordRecoveryProps {
  mode: 'request' | 'reset';
  onBack: () => void;
  onResetComplete: () => void;
}

export function PasswordRecovery({ mode, onBack, onResetComplete }: PasswordRecoveryProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (mode === 'request') {
      const validation = validateParentLoginCredentials(email.trim(), 'placeholder');
      if ('message' in validation) { setError(validation.message); return; }
    } else {
      const validation = validateParentResetPassword(password);
      if ('message' in validation) { setError(validation.message); return; }
      if (password !== confirmation) { setError('兩次輸入的密碼不一致。'); return; }
    }

    setSubmitting(true);
    try {
      if (mode === 'request') {
        const { error: resetError } = await requestParentPasswordReset(email);
        if (resetError) setError(toAuthErrorMessage(resetError));
        else setMessage('如果這個 Email 有註冊 HabitHero，重設密碼連結已寄出，請檢查信箱。');
      } else {
        await resetCurrentParentPassword(password);
        await signOut();
        onResetComplete();
      }
    } catch (failure) {
      setError(toAuthErrorMessage(failure));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="hh-login-screen">
      <SpriteLoginScene />
      <div className="hh-login-sun" />
      <div className="hh-login-vignette" />
      <div className="hh-login-grain" />
      <main className="hh-login-shell">
        <section className="hh-login-copy" aria-label="HabitHero 密碼安全">
          <h1>HabitHero</h1>
          <p>找回家長帳號，繼續陪孩子完成每天的小任務。</p>
        </section>
        <section className="hh-login-panel" aria-label={mode === 'request' ? '忘記密碼表單' : '重設密碼表單'}>
          <button type="button" onClick={onBack} className="hh-icon-button mb-5" aria-label="返回登入"><ArrowLeft size={22} /></button>
          <div className="hh-login-panel-head">
            <div className="hh-login-avatar" aria-hidden="true"><KeyRound size={32} /></div>
            <div><h2>{mode === 'request' ? '忘記密碼' : '設定新密碼'}</h2><p>{mode === 'request' ? '輸入家長 Email，我們會寄送安全連結。' : '請設定新的家長登入密碼。'}</p></div>
          </div>
          {mode === 'request' ? (
            <><label htmlFor="recovery-email">家長 Email</label><input id="recovery-email" type="email" required autoComplete="email" placeholder="parent@example.com" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} /></>
          ) : (
            <><label htmlFor="recovery-password">新密碼</label><input id="recovery-password" type="password" required autoComplete="new-password" minLength={8} placeholder="至少 8 碼，含大小寫英文" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} /><label htmlFor="recovery-confirmation">再次輸入新密碼</label><input id="recovery-confirmation" type="password" required autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(''); }} /></>
          )}
          {message && <p className="hh-login-note" role="status">{message}</p>}
          {error && <p className="hh-login-error" role="alert">{error}</p>}
          <button type="submit" disabled={submitting} className="hh-primary-button">{submitting ? '處理中…' : mode === 'request' ? '寄送重設連結' : '更新密碼'}</button>
          {mode === 'request' && <p className="hh-login-note">為保護帳號，即使 Email 不存在也會顯示相同提示。</p>}
        </section>
      </main>
    </form>
  );
}
