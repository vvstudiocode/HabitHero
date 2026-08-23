import { useState, type FormEvent } from 'react';
import type { FriendRequest, FriendSummary } from '../contracts';

interface FriendListSheetProps {
  code: string | null;
  friends: FriendSummary[];
  requests: FriendRequest[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSendRequest: (code: string) => Promise<void>;
  onAccept: (requestId: string) => Promise<void>;
  onDecline: (requestId: string) => Promise<void>;
  onVisit: (friend: FriendSummary) => Promise<void> | void;
  onRemove: (childProfileId: string) => Promise<void>;
}

export function FriendListSheet({ code, friends, requests, loading = false, error, onClose, onSendRequest, onAccept, onDecline, onVisit, onRemove }: FriendListSheetProps) {
  const [friendCode, setFriendCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!friendCode.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSendRequest(friendCode);
      setFriendCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const removeFriend = async (childProfileId: string) => {
    if (removingFriendId !== childProfileId || submitting) {
      setRemovingFriendId(childProfileId);
      return;
    }
    setSubmitting(true);
    try {
      await onRemove(childProfileId);
    } finally {
      setSubmitting(false);
      setRemovingFriendId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="好友列表">
      <section className="max-h-[min(44rem,92vh)] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-900">我的好友</h2>
          <button type="button" className="min-h-11 min-w-11 rounded-xl font-black text-slate-600 hover:bg-slate-100" aria-label="關閉好友列表" onClick={onClose}>關閉</button>
        </header>
        <form className="mt-4 rounded-2xl bg-emerald-50 p-4" onSubmit={(event) => void submitRequest(event)}>
          <label className="block text-sm font-black text-emerald-950" htmlFor="friend-code">輸入好友代碼</label>
          <div className="mt-2 flex gap-2">
            <input id="friend-code" value={friendCode} onChange={(event) => setFriendCode(event.target.value)} className="min-h-12 min-w-0 flex-1 rounded-xl border border-emerald-200 px-3 outline-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-emerald-500" autoComplete="off" aria-label="好友代碼" placeholder="32 碼好友代碼" />
            <button type="submit" className="min-h-12 rounded-xl bg-emerald-600 px-4 font-black text-white disabled:opacity-50" disabled={submitting || !friendCode.trim()}>送出</button>
          </div>
          {code && <p className="mt-2 break-all text-xs font-bold text-emerald-800">我的好友代碼：{code}</p>}
        </form>
        {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700" role="alert">{error}</p>}
        {loading && <p className="mt-4 text-sm font-bold text-slate-500">好友資料載入中…</p>}
        {!loading && requests.length > 0 && <section className="mt-5" aria-labelledby="friend-requests-title">
          <h3 id="friend-requests-title" className="font-black text-slate-900">待處理邀請</h3>
          <ul className="mt-2 space-y-2">
            {requests.map((request) => request.direction === 'incoming' ? (
              <li key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><span className="min-w-0 truncate font-bold">{request.displayName}</span><span className="flex shrink-0 gap-2"><button type="button" className="min-h-11 rounded-lg bg-emerald-600 px-3 text-sm font-black text-white" onClick={() => void onAccept(request.id)}>接受</button><button type="button" className="min-h-11 rounded-lg px-3 text-sm font-black text-slate-600 hover:bg-white" onClick={() => void onDecline(request.id)}>拒絕</button></span></li>
            ) : null)}
          </ul>
        </section>}
        <section className="mt-5" aria-labelledby="friends-title">
          <h3 id="friends-title" className="font-black text-slate-900">好友 {friends.length}/50</h3>
          {friends.length === 0 ? <p className="mt-2 text-sm font-bold text-slate-500">尚無好友，輸入代碼開始邀請吧！</p> : <ul className="mt-2 space-y-2">{friends.map((friend) => {
            const isRemoving = removingFriendId === friend.childProfileId;
            return <li key={friend.childProfileId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><span className="min-w-0"><strong className="block truncate">{friend.displayName}</strong><small className={friend.isOnline ? 'text-emerald-600' : 'text-slate-500'}>{friend.isOnline ? '在線' : '離線世界'}</small></span><span className="flex shrink-0 gap-2">{isRemoving && <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-black text-slate-600 hover:bg-slate-100" onClick={() => setRemovingFriendId(null)}>取消</button>}<button type="button" className={`min-h-11 rounded-lg px-3 text-sm font-black ${isRemoving ? 'bg-rose-600 text-white' : 'border border-rose-200 text-rose-700'}`} aria-label={`${isRemoving ? '確認刪除' : '刪除'}好友${friend.displayName}`} onClick={() => void removeFriend(friend.childProfileId)}>{isRemoving ? '確認刪除' : '刪除'}</button>{!isRemoving && <button type="button" className="min-h-11 rounded-lg bg-indigo-600 px-3 text-sm font-black text-white" onClick={() => void onVisit(friend)}>參觀</button>}</span></li>;
          })}</ul>}
        </section>
      </section>
    </div>
  );
}
