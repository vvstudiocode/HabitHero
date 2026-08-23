import type { WorldChatMessage } from '../contracts';

interface WorldChatDockProps {
  messages: WorldChatMessage[];
  unreadCount: number;
  onOpen: () => void;
}

export function WorldChatDock({ messages, unreadCount, onOpen }: WorldChatDockProps) {
  const latest = messages[messages.length - 1];
  return (
    <button
      type="button"
      className="fixed bottom-4 right-4 z-30 min-h-12 max-w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-indigo-200 bg-white/95 px-4 py-3 text-left shadow-lg backdrop-blur transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      aria-label={latest ? `最新訊息：${latest.senderDisplayName}：${latest.body}` : '開啟世界聊天'}
      onClick={onOpen}
    >
      <span className="block text-xs font-black uppercase tracking-wide text-indigo-600">最新訊息</span>
      <span className="block truncate font-bold text-slate-800">{latest ? `${latest.senderDisplayName}：${latest.body}` : '和好友說說話吧！'}</span>
      {unreadCount > 0 && <span className="mt-1 block text-xs font-bold text-rose-600">未讀 {unreadCount}</span>}
    </button>
  );
}
