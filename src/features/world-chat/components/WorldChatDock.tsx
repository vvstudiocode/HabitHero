import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { WorldChatMessage } from '../contracts';

interface WorldChatDockProps {
  messages: WorldChatMessage[];
  onOpen: () => void;
  worldOwnerDisplayName?: string;
}

export function WorldChatDock({ messages, onOpen, worldOwnerDisplayName }: WorldChatDockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const latest = messages[messages.length - 1];
  const visibleMessages = messages.slice(-6);
  const worldTitle = worldOwnerDisplayName ? `${worldOwnerDisplayName} 的世界聊天` : '好友即時聊天';
  return (
    <div className={`hh-world-chat-dock fixed z-30 rounded-2xl border border-white/60 shadow-lg transition hover:-translate-y-0.5 ${collapsed ? 'is-collapsed' : ''}`}>
      <button
        type="button"
        className="hh-world-chat-dock-main min-h-11 min-w-0 flex-1 rounded-2xl px-2.5 py-2 text-left focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        aria-label={latest ? `最新訊息：${worldTitle}：${latest.senderDisplayName}：${latest.body}` : `開啟${worldTitle}`}
        onClick={onOpen}
      >
        {collapsed ? <span className="block truncate text-[10px] font-bold leading-3 text-slate-800">{latest ? `${latest.senderDisplayName}：${latest.body}` : worldTitle}</span> : <>
          <span className="block truncate text-[10px] font-black leading-3 uppercase tracking-wide text-indigo-600">{worldTitle}</span>
          <span className="hh-world-chat-dock-messages mt-1 block" aria-live="polite">
            {visibleMessages.length > 0 ? visibleMessages.map((message) => (
              <span key={message.id} className="hh-world-chat-dock-message block truncate text-[10px] font-bold leading-3 text-slate-800">
                <strong className="mr-1 text-indigo-700">{message.senderDisplayName}：</strong>{message.body}
              </span>
            )) : <span className="hh-world-chat-dock-message block text-[10px] font-bold leading-3 text-slate-800">和好友說說話吧！</span>}
          </span>
        </>}
      </button>
      <button
        type="button"
        className="hh-world-chat-dock-toggle min-h-11 min-w-11 rounded-xl text-indigo-800 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        aria-label={collapsed ? '展開聊天摘要' : '收合聊天摘要'}
        aria-expanded={!collapsed}
        title={collapsed ? '展開聊天摘要' : '收合聊天摘要'}
        onClick={() => setCollapsed((current) => !current)}
      >
        <ChevronDown size={18} aria-hidden="true" className={`mx-auto transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
}
