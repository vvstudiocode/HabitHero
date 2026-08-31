import { useEffect, useRef, useState, type AnimationEvent, type FormEvent, type MouseEvent } from 'react';
import { X } from 'lucide-react';
import type { ChatReportInput, WorldChatMessage } from '../contracts';

interface WorldChatSheetProps {
  title?: string;
  messages: WorldChatMessage[];
  loading?: boolean;
  sending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSend: (body: string) => Promise<void>;
  onReport: (input: ChatReportInput) => Promise<void> | void;
}

export function WorldChatSheet({ title = '好友世界聊天', messages, loading = false, sending = false, error, onClose, onSend, onReport }: WorldChatSheetProps) {
  const [draft, setDraft] = useState('');
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => { closeButtonRef.current?.focus(); }, []);
  useEffect(() => {
    const messageList = messageListRef.current;
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
  }, [loading, messages.length, messages.at(-1)?.id]);

  const requestClose = () => {
    if (!closing) setClosing(true);
  };

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) requestClose();
  };

  const finishClose = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.animationName === 'hh-modal-overlay-out' && closing) onClose();
  };

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
    <div className={`hh-world-chat-sheet-layer fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4${closing ? ' is-leaving' : ''}`} role="dialog" aria-modal="true" aria-label="世界聊天" onClick={closeFromBackdrop} onAnimationEnd={finishClose}>
      <section className="hh-world-chat-sheet flex max-h-[min(42rem,90vh)] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl">
        <header className="hh-world-chat-sheet-header flex items-center justify-between gap-3 p-4">
          <h2 className="hh-world-chat-sheet-title">{title}</h2>
          <button ref={closeButtonRef} type="button" className="hh-world-chat-sheet-close min-h-11 min-w-11 rounded-xl font-black" aria-label="關閉聊天" title="關閉" onClick={requestClose}><X size={22} aria-hidden="true" /></button>
        </header>
        <div ref={messageListRef} className="hh-world-chat-messages min-h-48 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {loading && <p className="hh-world-chat-empty text-sm font-bold">聊天載入中…</p>}
          {!loading && messages.length === 0 && <p className="hh-world-chat-empty text-sm font-bold">尚無訊息，打個招呼吧！</p>}
          {messages.map((message) => (
            <article key={message.id} className="hh-world-chat-message rounded-2xl p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="hh-world-chat-message-line min-w-0 flex-1 break-words"><strong className="hh-world-chat-message-sender">{message.senderDisplayName}：</strong>{message.body}</p>
                <button type="button" className="hh-world-chat-report rounded-lg text-xs font-bold" aria-label={`檢舉 ${message.senderDisplayName} 的訊息`} disabled={reportingId === message.id} onClick={() => void report(message.id)}>檢舉</button>
              </div>
            </article>
          ))}
        </div>
        {(error || reportMessage) && <p className="hh-world-chat-feedback px-4 text-sm font-bold" role="alert">{error ?? reportMessage}</p>}
        <form className="hh-world-chat-composer flex gap-2 p-4" onSubmit={(event) => void submit(event)}>
          <label className="sr-only" htmlFor="world-chat-message">輸入聊天訊息</label>
          <input id="world-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={120} className="hh-world-chat-input min-h-12 min-w-0 flex-1 rounded-xl px-3 outline-none" placeholder="說點什麼…" aria-label="聊天訊息" />
          <button type="submit" className="hh-world-chat-send min-h-12 rounded-xl px-4 font-black disabled:opacity-50" disabled={sending || !draft.trim()}>{sending ? '送出中…' : '送出'}</button>
        </form>
      </section>
    </div>
  );
}
