import { CheckCircle2, MessageSquareText, RotateCcw, Sparkles, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ChildGrowthSummary } from '../growth-stats';
import { TASK_CATEGORIES, getTaskCategoryMeta } from '../constants';

interface GrowthSummaryPanelProps {
  summaries: ChildGrowthSummary[];
  title?: string;
}

export function GrowthSummaryPanel({ summaries, title = '成長紀錄' }: GrowthSummaryPanelProps) {
  const totals = summaries.reduce(
    (acc, item) => ({
      totalGoals: acc.totalGoals + item.totalGoals,
      childProposedGoals: acc.childProposedGoals + item.childProposedGoals,
      completedGoals: acc.completedGoals + item.completedGoals,
      pendingReviews: acc.pendingReviews + item.pendingReviews,
      feedbackCount: acc.feedbackCount + item.feedbackCount,
      correctionCount: acc.correctionCount + item.correctionCount,
      earnedPoints: acc.earnedPoints + item.earnedPoints,
    }),
    { totalGoals: 0, childProposedGoals: 0, completedGoals: 0, pendingReviews: 0, feedbackCount: 0, correctionCount: 0, earnedPoints: 0 },
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-gray-900">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">固定分類會保留統計口徑，孩子仍可自由寫自己的目標。</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile icon={<Sparkles size={20} />} label="自主目標" value={totals.childProposedGoals} tone="text-amber-700 bg-amber-50 border-amber-100" />
        <SummaryTile icon={<CheckCircle2 size={20} />} label="已完成" value={totals.completedGoals} tone="text-emerald-700 bg-emerald-50 border-emerald-100" />
        <SummaryTile icon={<MessageSquareText size={20} />} label="家長回饋" value={totals.feedbackCount} tone="text-blue-700 bg-blue-50 border-blue-100" />
        <SummaryTile icon={<Star size={20} />} label="成長點數" value={totals.earnedPoints} tone="text-yellow-700 bg-yellow-50 border-yellow-100" suffix="pt" />
      </div>

      <div className="space-y-3">
        {summaries.map((summary) => (
          <div key={summary.childId} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-gray-900">{summary.childName}</h3>
                <p className="text-xs font-bold text-gray-500">完成率 {summary.completionRate}% · 待審核 {summary.pendingReviews}</p>
              </div>
              {summary.revisionRequests > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                  <RotateCcw size={13} /> 需補充 {summary.revisionRequests}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {TASK_CATEGORIES.map((category) => {
                const count = summary.categoryCounts[category.id];
                const width = summary.totalGoals === 0 ? 0 : Math.max(8, Math.round((count / summary.totalGoals) * 100));
                const meta = getTaskCategoryMeta(category.id);
                return (
                  <div key={category.id} className="grid grid-cols-[76px_1fr_28px] items-center gap-2 text-xs">
                    <span className="font-bold text-gray-600">{meta.shortLabel}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-blue-400" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-right font-black text-gray-500">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryTile({ icon, label, value, suffix, tone }: { icon: ReactNode; label: string; value: number; suffix?: string; tone: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="mb-2">{icon}</div>
      <div className="text-2xl font-black">
        {value}
        {suffix && <span className="ml-1 text-sm">{suffix}</span>}
      </div>
      <div className="text-xs font-bold opacity-80">{label}</div>
    </div>
  );
}
