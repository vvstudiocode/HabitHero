import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { PARENT_CONSENT_VERSION, parentalConsentChecklist, privacyPolicySections } from '../lib/legal-content';
import { dismissWithAnimation } from '../lib/utils';

interface ParentConsentModalProps {
  onClose: () => void;
  onAgree: () => Promise<void>;
  onOpenPrivacyPolicy: () => void;
  canClose?: boolean;
}

export function ParentConsentModal({ onClose, onAgree, onOpenPrivacyPolicy, canClose = true }: ParentConsentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canClose) onClose();
    };
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canClose, onClose]);

  const handleAgree = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await onAgree();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '同意紀錄儲存失敗，請稍後重試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="hh-consent-modal-shell" role="dialog" aria-modal="true" aria-labelledby="parent-consent-modal-title">
      <section className="hh-consent-modal-panel">
        <header className="hh-consent-modal-header">
          <div className="flex items-center gap-3">
            <div className="hh-consent-modal-icon" aria-hidden="true"><ShieldCheck size={24} /></div>
            <div>
              <p className="hh-document-kicker">HabitHero · Family safety</p>
              <h2 id="parent-consent-modal-title">兒童與家長同意</h2>
            </div>
          </div>
          {canClose && <button type="button" onClick={() => dismissWithAnimation(onClose, '.hh-consent-modal-panel')} className="hh-consent-modal-close" aria-label="關閉同意說明"><X size={22} /></button>}
        </header>

        <div className="hh-consent-modal-content">
          <p className="hh-document-lead">建立家長帳號或孩子資料前，請由家長閱讀並確認資料用途。版本：{PARENT_CONSENT_VERSION}。</p>
          <section>
            <h3>家長確認事項</h3>
            <ul className="hh-document-checklist">
              {parentalConsentChecklist.map((item) => <li key={item}><CheckCircle2 size={18} aria-hidden="true" /><span>{item}</span></li>)}
            </ul>
          </section>
          <section>
            <h3>隱私政策</h3>
            <p>HabitHero 會處理家長 Email、孩子顯示名稱、任務、心得、心情與獎勵紀錄，用於家庭同步、任務管理、帳號安全與資料刪除。</p>
            <button type="button" className="hh-document-link" onClick={onOpenPrivacyPolicy}>
              查看完整隱私政策 <ArrowRight size={16} aria-hidden="true" />
            </button>
            <div className="hh-consent-policy-preview">
              {privacyPolicySections.slice(0, 2).map((section) => (
                <div key={section.title}>
                  <h4>{section.title}</h4>
                  <p>{section.paragraphs[0]}</p>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3>家長控制</h3>
            <p>家長可以管理孩子登入、重設密碼、建立與核准任務、核准點數，並在任何時候刪除孩子資料。</p>
          </section>
        </div>

        <footer className="hh-consent-modal-actions">
          {error && <p className="hh-document-error mb-3" role="alert">{error}</p>}
          <button type="button" onClick={() => void handleAgree()} disabled={isSubmitting} className="hh-document-primary-button w-full disabled:cursor-wait disabled:opacity-60">
            {isSubmitting ? '儲存中…' : '我已閱讀並同意'}
          </button>
        </footer>
      </section>
    </div>
  );
}
