import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LockKeyhole, X } from 'lucide-react';
import { dismissWithAnimation } from '../lib/utils';

interface ParentUnlockModalProps {
  title?: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  onCancel?: () => void;
  onUnlock: (password: string) => Promise<void> | void;
}

export function ParentUnlockModal({
  title = '解鎖家長模式',
  description = '請輸入家長密碼繼續。',
  loading = false,
  error = null,
  onCancel,
  onUnlock,
}: ParentUnlockModalProps) {
  const [password, setPassword] = useState('');

  return createPortal(
    <div className="hh-modal-shell hh-switch-modal-shell fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-xs p-5" role="dialog" aria-modal="true" aria-labelledby="parent-unlock-title">
      <form
        className="hh-modal-panel hh-switch-modal-panel hh-parent-unlock-panel w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-slide-up"
        onSubmit={(event) => {
          event.preventDefault();
          if (password) void onUnlock(password);
        }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="hh-parent-unlock-icon mb-2 flex h-11 w-11 items-center justify-center rounded-2xl"><LockKeyhole size={22} /></div>
            <h2 id="parent-unlock-title" className="text-xl font-black text-gray-900">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
          </div>
          {onCancel && <button type="button" onClick={() => dismissWithAnimation(onCancel, '.hh-switch-modal-panel')} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500" aria-label="關閉"><X size={20} /></button>}
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-gray-700">家長密碼</span>
          <input
            autoFocus
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="hh-parent-unlock-input min-h-12 w-full rounded-2xl p-3 text-base outline-none"
          />
        </label>
        {error && <p className="mt-2 text-sm font-bold text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={!password || loading} className="hh-parent-unlock-submit mt-5 min-h-12 w-full rounded-2xl px-4 font-black disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? '驗證中…' : '解鎖'}
        </button>
      </form>
    </div>,
    document.body,
  );
}
