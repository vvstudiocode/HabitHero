import type { CoopCompletionSummary as Summary } from '../contracts';

interface CoopCompletionSummaryProps {
  summary?: Summary | null;
  loading?: boolean;
  error?: string | null;
  currentParticipantId?: string;
  onSubmit?: () => Promise<void> | void;
}

export function CoopCompletionSummary({ summary, loading = false, error = null, currentParticipantId, onSubmit }: CoopCompletionSummaryProps) {
  if (loading) return <section className="rounded-2xl bg-white p-4 shadow" aria-label="合作完成狀態載入中">完成狀態載入中…</section>;
  if (error) return <section className="rounded-2xl bg-rose-50 p-4 text-rose-700" aria-label="合作完成狀態錯誤">{error}</section>;
  if (!summary) return <section className="rounded-2xl bg-white p-4 text-slate-500" aria-label="合作完成狀態空白">尚無完成回報。</section>;
  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow" aria-labelledby={`coop-summary-${summary.adventureId}`}>
      <h3 id={`coop-summary-${summary.adventureId}`} className="font-black text-slate-900">{summary.title} · 完成狀態</h3>
      <ul className="mt-3 space-y-2">
        {summary.participants.map((participant) => {
          const completion = summary.completions.find((item) => item.participantId === participant.id);
          return <li key={participant.id} className="flex items-center justify-between gap-3 text-sm"><span>{participant.displayName}</span><span className="flex items-center gap-2"><span className="font-bold text-emerald-700">{completion?.status ?? '尚未回報'}</span>{participant.id === currentParticipantId && completion?.status !== 'completed' && onSubmit && <button type="button" className="min-h-11 rounded-xl bg-emerald-600 px-3 font-black text-white" onClick={() => void onSubmit()}>回報完成</button>}</span></li>;
        })}
      </ul>
    </section>
  );
}
