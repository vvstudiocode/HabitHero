import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatReportInput, WorldChatMessage } from '../contracts';

interface WorldChatSheetProps {
  messages: WorldChatMessage[];
  loading?: boolean;
  sending?: boolean;
  error?: string | null;
  onClose: () => void;
  onBack?: () => void;
  onSend: (body: string) => Promise<void>;
  onReport: (input: ChatReportInput) => Promise<void> | void;
}

export function WorldChatSheet({ messages, loading = false, sending = false, error, onClose, onBack, onSend, onReport }: WorldChatSheetProps) {
  const [draft, setDraft] = useState('');
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { closeButtonRef.current?.focus(); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    await onSend(draft);
    setDraft('');
  };

  const report = async (messageId: string) => {
    setReportingId(messageId);
    try {
      await onReport({ messageId });
      setReportMessage('已收到檢舉，謝謝你的提醒。');
    } finally {
      setReportingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="世界聊天">
      <section className="flex max-h-[min(42rem,90vh)] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            {onBack && <button type="button" className="min-h-11 rounded-xl px-3 font-bold text-slate-600 hover:bg-slate-100" aria-label="返回" onClick={onBack}>返回</button>}
            <h2 className="text-lg font-black text-slate-900">好友世界聊天</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="min-h-11 min-w-11 rounded-xl font-black text-slate-600 hover:bg-slate-100" aria-label="關閉聊天" onClick={onClose}>關閉</button>
        </header>
        <div className="min-h-48 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {loading && <p className="text-sm font-bold text-slate-500">聊天載入中…</p>}
          {!loading && messages.length === 0 && <p className="text-sm font-bold text-slate-500">尚無訊息，打個招呼吧！</p>}
          {messages.map((message) => (
            <article key={message.id} className="rounded-2xl bg-indigo-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-black text-indigo-950">{message.senderDisplayName}</p>
                <button type="button" className="min-h-11 rounded-lg px-2 text-xs font-bold text-slate-500 hover:bg-white" aria-label={`檢舉 ${message.senderDisplayName} 的訊息`} disabled={reportingId === message.id} onClick={() => void report(message.id)}>檢舉</button>
              </div>
              <p className="whitespace-pre-wrap break-words text-slate-800">{message.body}</p>
            </article>
          ))}
        </div>
        {(error || reportMessage) && <p className="px-4 text-sm font-bold text-rose-600" role="alert">{error ?? reportMessage}</p>}
        <form className="flex gap-2 border-t border-slate-100 p-4" onSubmit={(event) => void submit(event)}>
          <label className="sr-only" htmlFor="world-chat-message">輸入聊天訊息</label>
          <input id="world-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={120} className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 outline-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-indigo-500" placeholder="說點什麼…" aria-label="聊天訊息" />
          <button type="submit" className="min-h-12 rounded-xl bg-indigo-600 px-4 font-black text-white disabled:opacity-50" disabled={sending || !draft.trim()}>{sending ? '送出中…' : '送出'}</button>
        </form>
      </section>
    </div>
  );
}
