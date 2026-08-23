import type { CoopAdventureSummary } from '../contracts';

interface CoopAdventureCardProps {
  adventure?: CoopAdventureSummary;
  loading?: boolean;
  error?: string | null;
  onJoin?: (adventureId: string) => Promise<void> | void;
  onCreate?: () => Promise<void> | void;
}

export function CoopAdventureCard({ adventure, loading = false, error = null, onJoin, onCreate }: CoopAdventureCardProps) {
  if (loading) return <section className="rounded-2xl bg-white p-4 shadow" aria-label="合作冒險載入中">合作冒險載入中…</section>;
  if (error) return <section className="rounded-2xl bg-rose-50 p-4 text-rose-700" aria-label="合作冒險錯誤">{error}</section>;
  if (!adventure) return <section className="rounded-2xl bg-white p-4 text-slate-500" aria-label="合作冒險空白狀態"><p>尚無合作冒險。</p>{onCreate && <button type="button" className="mt-3 min-h-11 rounded-xl bg-indigo-600 px-4 font-black text-white" onClick={() => void onCreate()}>建立合作冒險</button>}</section>;
  return (
    <article className="rounded-2xl border border-indigo-100 bg-white p-4 shadow" aria-labelledby={`coop-adventure-${adventure.id}`}>
      <h3 id={`coop-adventure-${adventure.id}`} className="font-black text-slate-900">{adventure.title}</h3>
      {adventure.description && <p className="mt-1 text-sm text-slate-600">{adventure.description}</p>}
      <p className="mt-2 text-sm font-bold text-indigo-700">已加入 {adventure.participantCount} 人</p>
      {onJoin && adventure.status === 'active' && <button type="button" className="mt-3 min-h-11 rounded-xl bg-indigo-600 px-4 font-black text-white" aria-label={`加入${adventure.title}`} onClick={() => void onJoin(adventure.id)}>加入冒險</button>}
      {onCreate && adventure.status === 'active' && <button type="button" className="mt-3 min-h-11 rounded-xl border border-indigo-200 px-4 font-black text-indigo-700" onClick={() => void onCreate()}>建立另一個合作冒險</button>}
    </article>
  );
}
