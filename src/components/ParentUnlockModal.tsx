import { useState } from 'react';
import { LockKeyhole, X } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5" role="dialog" aria-modal="true" aria-labelledby="parent-unlock-title">
      <form
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (password) void onUnlock(password);
        }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600"><LockKeyhole size={22} /></div>
            <h2 id="parent-unlock-title" className="text-xl font-black text-gray-900">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
          </div>
          {onCancel && <button type="button" onClick={onCancel} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500" aria-label="關閉"><X size={20} /></button>}
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-gray-700">家長密碼</span>
          <input
            autoFocus
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-gray-200 p-3 text-base outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
        {error && <p className="mt-2 text-sm font-bold text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={!password || loading} className="mt-5 min-h-12 w-full rounded-2xl bg-blue-500 px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? '驗證中…' : '解鎖'}
        </button>
      </form>
    </div>
  );
}
