import { Users } from 'lucide-react';

interface FriendDockProps {
  friendCount: number;
  pendingCount: number;
  unreadChatCount?: number;
  onOpen: () => void;
}

export function FriendDock({ friendCount, pendingCount, unreadChatCount = 0, onOpen }: FriendDockProps) {
  return (
    <button
      type="button"
      className="hh-friend-dock z-30 inline-flex h-11 min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-emerald-200 px-3 py-0 font-black text-emerald-800 shadow-lg backdrop-blur transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      aria-label={`開啟好友列表，目前 ${friendCount} 位好友${pendingCount ? `，${pendingCount} 個待處理邀請` : ''}${unreadChatCount ? `，${unreadChatCount} 則未讀聊天` : ''}`}
      title="好友"
      onClick={onOpen}
    >
      <Users size={18} strokeWidth={2.4} aria-hidden="true" />
      {pendingCount > 0 && <span className="ml-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">{pendingCount}</span>}
      {unreadChatCount > 0 && <span className="hh-friend-dock-unread" aria-label={`未讀聊天 ${unreadChatCount}`} />}
    </button>
  );
}
