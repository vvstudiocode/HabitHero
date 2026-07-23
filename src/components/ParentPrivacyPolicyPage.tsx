import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { PRIVACY_POLICY_VERSION, privacyPolicySections } from '../lib/legal-content';

interface ParentPrivacyPolicyPageProps {
  onClose: () => void;
}

export function ParentPrivacyPolicyPage({ onClose }: ParentPrivacyPolicyPageProps) {
  return (
    <div className="hh-document-shell is-consent-policy" role="dialog" aria-modal="true" aria-labelledby="parent-privacy-policy-title">
      <header className="hh-document-header">
        <button type="button" onClick={onClose} className="hh-document-back" aria-label="返回同意視窗">
          <ArrowLeft size={22} aria-hidden="true" />
          <span>返回同意視窗</span>
        </button>
        <span className="hh-document-eyebrow">HabitHero · Privacy</span>
        <div className="hh-document-header-spacer" aria-hidden="true" />
      </header>

      <main className="hh-document-content">
        <div className="hh-document-title-row">
          <div className="hh-document-icon" aria-hidden="true"><ShieldCheck size={28} /></div>
          <div>
            <p className="hh-document-kicker">家長專區</p>
            <h1 id="parent-privacy-policy-title">隱私政策</h1>
          </div>
        </div>

        <article className="hh-document-article">
          <p className="hh-document-lead">這份政策說明 HabitHero 如何處理家庭與兒童資料。版本日期：{PRIVACY_POLICY_VERSION}。</p>
          {privacyPolicySections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </article>
      </main>
    </div>
  );
}
