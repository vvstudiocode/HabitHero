import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { cn } from '../lib/utils';
import { signIn, signUp, toAuthErrorMessage, useAuthSession } from '../auth';
import { validateParentRegistrationCredentials } from '../lib/auth-validation';
import { SpriteLoginScene } from './SpriteLoginScene';
import { ParentConsentModal } from './ParentConsentModal';
import { ParentPrivacyPolicyPage } from './ParentPrivacyPolicyPage';

interface ParentSetupProps {
  onBack: () => void;
  onGoLogin: () => void;
  onComplete: (consentAccepted?: boolean) => void;
}

export function ParentSetup({ onBack, onGoLogin, onComplete }: ParentSetupProps) {
  const { session, loading: sessionLoading, error: sessionError } = useAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  useEffect(() => {
    if (session) onComplete(consentAccepted);
  }, [consentAccepted, onComplete, session]);

  const handleNext = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim();
    const validation = validateParentRegistrationCredentials(normalizedEmail, password);
    if ('message' in validation) {
      setError(validation.message);
      return;
    }
    if (!consentAccepted) {
      setShowConsentModal(true);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: signUpError } = await signUp({ email: normalizedEmail, password });
      if (signUpError) setError(toAuthErrorMessage(signUpError));
      else if (data.session) onComplete(consentAccepted);
      else {
        const signInResult = await signIn({ email: normalizedEmail, password });
        if (signInResult.error) setError(toAuthErrorMessage(signInResult.error));
        else onComplete(consentAccepted);
      }
    } catch (signUpError) {
      setError(toAuthErrorMessage(signUpError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleNext} className="hh-login-screen">
      <SpriteLoginScene />
      <div className="hh-login-sun" />
      <div className="hh-login-vignette" />
      <div className="hh-login-grain" />

      <main className="hh-login-shell">
        <section className="hh-login-copy" aria-label="HabitHero 註冊視覺">
          <h1>HabitHero</h1>
          <p>先建立家長帳號，再替孩子安排每天的任務與獎勵。</p>
        </section>

        <section className="hh-login-panel" aria-label="建立家長帳號表單">
          <div className="mb-5 flex items-center justify-between gap-3">
            <button type="button" onClick={onBack} aria-label="返回" className="hh-icon-button">
              <ArrowLeft size={22} />
            </button>
            <button type="button" onClick={onGoLogin} className="hh-secondary-inline">
              已有帳號？登入
            </button>
          </div>

          <div className="hh-login-panel-head">
            <div className="hh-login-avatar" aria-hidden="true">
              <KeyRound size={32} />
            </div>
            <div>
              <h2>建立家長帳號</h2>
            </div>
          </div>

          <label htmlFor="setup-email">Email</label>
          <input id="setup-email" type="email" required autoComplete="email" placeholder="家長 Email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />

          <label htmlFor="setup-password">通關密語</label>
          <input id="setup-password" type="password" required minLength={8} autoComplete="new-password" placeholder="至少 8 碼，含大小寫英文" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} />

          <label className="hh-parent-consent-check">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={() => { if (consentAccepted) setConsentAccepted(false); else setShowConsentModal(true); setError(''); }}
            />
            <span>
              <strong><CheckCircle2 size={17} aria-hidden="true" /> 我是孩子的家長或合法監護人</strong>
              <small>我已閱讀隱私政策，並同意在建立孩子資料前由我管理其任務、心得、獎勵與刪除權。</small>
            </span>
          </label>

          {(error || sessionError) && <p role="alert" className="hh-login-error">{error || sessionError}</p>}

          <button
            type="submit"
            onClick={() => { if (!consentAccepted) setShowConsentModal(true); }}
            className={cn(
              "hh-primary-button",
              !(email && password && !sessionLoading && !submitting) && "is-disabled"
            )}
            disabled={!email || !password || sessionLoading || submitting}
          >
            {submitting ? '建立中…' : '建立帳號'}
          </button>
        </section>
      </main>
      {showConsentModal && (
        <ParentConsentModal
          onClose={() => setShowConsentModal(false)}
          onOpenPrivacyPolicy={() => setShowPrivacyPolicy(true)}
          onAgree={async () => { setConsentAccepted(true); setShowConsentModal(false); }}
        />
      )}
      {showPrivacyPolicy && <ParentPrivacyPolicyPage onClose={() => setShowPrivacyPolicy(false)} />}
    </form>
  );
}
