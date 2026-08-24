import { useState } from 'react';
import type { FriendSummary } from '../friends/contracts';
import type { GameCatalogItem } from '../world/contracts';

interface SharedDecorationShareDialogProps {
  item: GameCatalogItem;
  friends: readonly FriendSummary[];
  onClose: () => void;
  onShare: (friend: FriendSummary) => Promise<void>;
}

export function SharedDecorationShareDialog({ item, friends, onClose, onShare }: SharedDecorationShareDialogProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const share = async (friend: FriendSummary) => {
    if (pendingId) return;
    setPendingId(friend.childProfileId);
    setError(null);
    try {
      await onShare(friend);
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '共享裝飾目前無法放置。');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`分享${item.name}`}>
      <section className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between gap-3">
          <div><h2 className="text-xl font-black text-slate-900">分享裝飾</h2><p className="mt-1 text-sm font-bold text-slate-500">{item.name}會保留在你的背包，也能出現在多位好友的世界。</p></div>
          <button type="button" className="min-h-11 min-w-11 rounded-xl font-black text-slate-600 hover:bg-slate-100" onClick={onClose}>關閉</button>
        </header>
        {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700" role="alert">{error}</p>}
        {friends.length === 0 ? <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">先新增好友，才能分享裝飾。</p> : <ul className="mt-5 space-y-2">{friends.map((friend) => <li key={friend.childProfileId} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3"><span className="min-w-0 truncate font-black text-slate-800">{friend.displayName}</span><button type="button" className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-50" disabled={pendingId !== null} onClick={() => void share(friend)}>{pendingId === friend.childProfileId ? '放置中…' : '分享'}</button></li>)}</ul>}
      </section>
    </div>
  );
}
