import { useMemo, useState } from 'react';
import { CheckCircle2, MessageSquareText, RotateCcw, Sparkles, Star, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ChildGrowthSummary } from '../growth-stats';
import { TASK_CATEGORIES, getMoodLabel, getTaskCategoryMeta } from '../constants';
import { CategoryBadge } from './CategoryBadge';
import type { GrowthTaskWithChild, TaskCategory } from '../types';

interface GrowthSummaryPanelProps {
  summaries: ChildGrowthSummary[];
  title?: string;
  completedTasks?: GrowthTaskWithChild[];
  showChildFilter?: boolean;
}

const HISTORY_PAGE_SIZE = 12;

export function GrowthSummaryPanel({ summaries, title = '成長紀錄', completedTasks = [], showChildFilter = false }: GrowthSummaryPanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'all'>('all');
  const [childFilter, setChildFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const [selectedTask, setSelectedTask] = useState<GrowthTaskWithChild | null>(null);
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
  const childOptions = useMemo(() => summaries.map((summary) => ({ id: summary.childId, name: summary.childName })), [summaries]);
  const filteredCompletedTasks = useMemo(() => {
    return [...completedTasks]
      .filter((task) => categoryFilter === 'all' || task.category === categoryFilter)
      .filter((task) => !showChildFilter || childFilter === 'all' || task.childId === childFilter)
      .sort((a, b) => {
        const aTime = Date.parse(a.completedAt ?? a.updatedAt ?? a.createdAt ?? '');
        const bTime = Date.parse(b.completedAt ?? b.updatedAt ?? b.createdAt ?? '');
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
      });
  }, [categoryFilter, childFilter, completedTasks, showChildFilter]);
  const visibleTasks = filteredCompletedTasks.slice(0, visibleCount);

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

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-gray-900">完成任務</h3>
            <p className="mt-1 text-sm text-gray-500">預設只載入近期紀錄，點卡片查看細節。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {showChildFilter && (
              <select
                value={childFilter}
                onChange={(event) => {
                  setChildFilter(event.target.value);
                  setVisibleCount(HISTORY_PAGE_SIZE);
                }}
                className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="all">全部孩子</option>
                {childOptions.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
              </select>
            )}
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value as TaskCategory | 'all');
                setVisibleCount(HISTORY_PAGE_SIZE);
              }}
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">全部分類</option>
              {TASK_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
          </div>
        </div>

        {visibleTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm font-bold text-gray-400">目前沒有符合條件的完成任務。</div>
        ) : (
          <div className="space-y-3">
            {visibleTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setSelectedTask(task)}
                className="w-full rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {showChildFilter && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">{task.childName}</span>}
                  <CategoryBadge category={task.category} compact />
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{task.approvedPoints ?? task.points} pt</span>
                </div>
                <div className="font-black text-gray-900">{task.name}</div>
                <div className="mt-1 text-xs font-bold text-gray-400">{formatDate(task.completedAt ?? task.updatedAt ?? task.createdAt)}</div>
              </button>
            ))}
          </div>
        )}

        {filteredCompletedTasks.length > visibleTasks.length && (
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + HISTORY_PAGE_SIZE)}
            className="min-h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 font-black text-gray-700"
          >
            顯示更多
          </button>
        )}
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  {showChildFilter && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">{selectedTask.childName}</span>}
                  <CategoryBadge category={selectedTask.category} compact />
                </div>
                <h3 className="text-xl font-black text-gray-900">{selectedTask.name}</h3>
              </div>
              <button type="button" onClick={() => setSelectedTask(null)} aria-label="關閉" className="flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <DetailItem label="完成時間" value={formatDate(selectedTask.completedAt ?? selectedTask.updatedAt ?? selectedTask.createdAt)} />
              <DetailItem label="獲得點數" value={`${selectedTask.approvedPoints ?? selectedTask.points} pt`} />
              <DetailItem label="心情" value={getMoodLabel(selectedTask.mood ?? selectedTask.childMood)} />
              <DetailItem label="難度" value={`${selectedTask.difficulty ?? selectedTask.childDifficulty ?? '-'} / 5`} />
            </dl>
            {(selectedTask.reflection || selectedTask.childReflectionText || selectedTask.parentFeedback || selectedTask.parentFeedbackText || selectedTask.parentCorrection || selectedTask.parentCorrectionText) && (
              <div className="mt-4 space-y-3 rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                {(selectedTask.reflection || selectedTask.childReflectionText) && <p><strong>心得：</strong>{selectedTask.reflection ?? selectedTask.childReflectionText}</p>}
                {(selectedTask.parentFeedback || selectedTask.parentFeedbackText) && <p><strong>家長說：</strong>{selectedTask.parentFeedback ?? selectedTask.parentFeedbackText}</p>}
                {(selectedTask.parentCorrection || selectedTask.parentCorrectionText) && <p><strong>補充：</strong>{selectedTask.parentCorrection ?? selectedTask.parentCorrectionText}</p>}
              </div>
            )}
          </div>
        </div>
      )}
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-3">
      <dt className="text-xs font-bold text-gray-400">{label}</dt>
      <dd className="mt-1 font-black text-gray-800">{value}</dd>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '未記錄';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
}
