interface FriendDockProps {
  friendCount: number;
  pendingCount: number;
  onOpen: () => void;
}

export function FriendDock({ friendCount, pendingCount, onOpen }: FriendDockProps) {
  return (
    <button
      type="button"
      className="fixed bottom-[max(16px,calc(env(safe-area-inset-bottom,0px)+16px))] left-4 z-30 inline-flex h-11 min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-emerald-200 bg-white/95 px-3 py-0 font-black text-emerald-800 shadow-lg backdrop-blur transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 max-[760px]:bottom-[max(8px,calc(env(safe-area-inset-bottom,0px)+8px))] max-[760px]:left-auto max-[760px]:right-[calc(50%+64px)]"
      aria-label={`開啟好友列表，目前 ${friendCount} 位好友${pendingCount ? `，${pendingCount} 個待處理邀請` : ''}`}
      onClick={onOpen}
    >
      <span aria-hidden="true">👥</span> 好友
      {pendingCount > 0 && <span className="ml-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">{pendingCount}</span>}
    </button>
  );
}
