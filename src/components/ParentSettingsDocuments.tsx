import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, HelpCircle, ShieldCheck, Trash2 } from 'lucide-react';
import { PARENT_CONSENT_VERSION, PRIVACY_POLICY_VERSION, parentalConsentChecklist, privacyPolicySections, supportTopics } from '../lib/legal-content';

export type ParentSettingsDocument = 'privacy' | 'support' | 'consent' | 'delete-account';

interface ParentSettingsDocumentsProps {
  document: ParentSettingsDocument;
  consentRecorded: boolean;
  onClose: () => void;
  onConsent: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
}

const documentMeta: Record<ParentSettingsDocument, { title: string; eyebrow: string }> = {
  privacy: { title: '隱私政策', eyebrow: 'HabitHero · Privacy' },
  support: { title: '支援中心', eyebrow: 'HabitHero · Support' },
  consent: { title: '兒童與家長同意', eyebrow: 'HabitHero · Family safety' },
  'delete-account': { title: '刪除帳號與資料', eyebrow: 'HabitHero · Data deletion' },
};

export function ParentSettingsDocuments({ document, consentRecorded, onClose, onConsent, onDeleteAccount }: ParentSettingsDocumentsProps) {
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) onClose();
    };
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDeleting, onClose]);

  const meta = documentMeta[document];
  const recordConsent = async () => {
    setActionError('');
    setIsSavingConsent(true);
    try {
      await onConsent();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '儲存同意紀錄失敗，請稍後再試。');
    } finally {
      setIsSavingConsent(false);
    }
  };

  const deleteAccount = async () => {
    if (!deleteConfirmed) return;
    setActionError('');
    setIsDeleting(true);
    try {
      await onDeleteAccount();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '刪除帳號失敗，請聯絡支援。');
      setIsDeleting(false);
    }
  };

  return (
    <div className="hh-document-shell" role="dialog" aria-modal="true" aria-labelledby="parent-document-title">
      <header className="hh-document-header">
        <button type="button" onClick={onClose} className="hh-document-back" aria-label="返回設定" disabled={isDeleting}>
          <ArrowLeft size={22} aria-hidden="true" />
          <span>設定</span>
        </button>
        <span className="hh-document-eyebrow">{meta.eyebrow}</span>
        <div className="hh-document-header-spacer" aria-hidden="true" />
      </header>

      <main className="hh-document-content">
        <div className="hh-document-title-row">
          <div className="hh-document-icon" aria-hidden="true">
            {document === 'privacy' && <ShieldCheck size={28} />}
            {document === 'support' && <HelpCircle size={28} />}
            {document === 'consent' && <CheckCircle2 size={28} />}
            {document === 'delete-account' && <Trash2 size={28} />}
          </div>
          <div>
            <p className="hh-document-kicker">家長專區</p>
            <h1 id="parent-document-title">{meta.title}</h1>
          </div>
        </div>

        {document === 'privacy' && (
          <article className="hh-document-article">
            <p className="hh-document-lead">這份政策說明 HabitHero 如何處理家庭與兒童資料。版本日期：{PRIVACY_POLICY_VERSION}。</p>
            {privacyPolicySections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </section>
            ))}
            <a className="hh-document-link" href="mailto:support@habithero.app">
              聯絡支援 Email <ExternalLink size={16} aria-hidden="true" />
            </a>
          </article>
        )}

        {document === 'support' && (
          <article className="hh-document-article">
            <p className="hh-document-lead">遇到問題時，先查看以下快速處理方式；不要重複送出尚未確認的點數或任務變更。</p>
            {supportTopics.map((topic) => (
              <section className="hh-support-card" key={topic.title}>
                <h2>{topic.title}</h2>
                <p>{topic.body}</p>
              </section>
            ))}
            <section>
              <h2>聯絡支援</h2>
              <p>請寄信至 support@habithero.app，並附上家長帳號 Email、發生時間與不含敏感資料的錯誤描述。請不要寄送密碼或孩子的完整個人資料。</p>
              <a className="hh-document-link" href="mailto:support@habithero.app?subject=HabitHero%20支援請求">寄送支援請求 <ExternalLink size={16} aria-hidden="true" /></a>
            </section>
          </article>
        )}

        {document === 'consent' && (
          <article className="hh-document-article">
            <p className="hh-document-lead">HabitHero 由家長建立家庭與孩子帳號。家長必須先了解資料用途，再讓孩子使用任務、心得與獎勵功能。</p>
            <section>
              <h2>家長確認事項</h2>
              <ul className="hh-document-checklist">
                {parentalConsentChecklist.map((item) => <li key={item}><CheckCircle2 size={18} aria-hidden="true" /><span>{item}</span></li>)}
              </ul>
            </section>
            <section>
              <h2>家長控制</h2>
              <p>家長可以管理孩子登入、重設密碼、建立與核准任務、核准點數、刪除孩子帳號，並在任何時候刪除家庭資料。</p>
            </section>
            <section className="hh-consent-status" aria-live="polite">
              <div>
                <h2>同意狀態</h2>
                <p>{consentRecorded ? `已記錄本版本家長同意（${PARENT_CONSENT_VERSION}）。` : '尚未記錄本版本家長同意。'}</p>
              </div>
              <button type="button" onClick={() => void recordConsent()} disabled={isSavingConsent || consentRecorded} className="hh-document-primary-button">
                {isSavingConsent ? '儲存中…' : consentRecorded ? '已完成確認' : '我已閱讀並同意'}
              </button>
            </section>
            {actionError && <p className="hh-document-error" role="alert">{actionError}</p>}
          </article>
        )}

        {document === 'delete-account' && (
          <article className="hh-document-article">
            <div className="hh-danger-panel">
              <Trash2 size={24} aria-hidden="true" />
              <div>
                <h2>這是永久操作</h2>
                <p>刪除會移除家長帳號、家庭、孩子帳號、任務、心得、獎勵、點數與兌換紀錄。刪除後無法復原。</p>
              </div>
            </div>
            <section>
              <h2>刪除前請確認</h2>
              <p>如果只是暫時不使用，請先登出。若你要行使資料刪除權，請勾選下方確認並繼續。</p>
              <label className="hh-delete-confirm">
                <input type="checkbox" checked={deleteConfirmed} onChange={(event) => setDeleteConfirmed(event.target.checked)} disabled={isDeleting} />
                <span>我確認要永久刪除我的 HabitHero 帳號與家庭資料。</span>
              </label>
            </section>
            {actionError && <p className="hh-document-error" role="alert">{actionError}</p>}
            <button type="button" onClick={() => void deleteAccount()} disabled={!deleteConfirmed || isDeleting} className="hh-document-danger-button">
              {isDeleting ? '刪除中…' : '永久刪除帳號'}
            </button>
          </article>
        )}
      </main>
    </div>
  );
}
