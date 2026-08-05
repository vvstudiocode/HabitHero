import { CheckCircle2, ChevronDown, Circle, Clock3, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ChildGrowthSummary, GrowthDayProgress, GrowthPeriod, GrowthPeriodStats } from '../growth-stats';
import { getGrowthPeriodStats } from '../growth-stats';
import { TASK_CATEGORIES, getTaskCategoryMeta, getTaskStatusLabel } from '../constants';
import { CategoryBadge } from './CategoryBadge';
import type { GrowthTaskWithChild } from '../types';
import { PointValue } from '../../../components/shared/PointValue';
import { getTaipeiDateKey } from '../../adventures/adventure-progress';

interface GrowthSummaryPanelProps {
  summaries: ChildGrowthSummary[];
  title?: string;
  tasks?: GrowthTaskWithChild[];
}

type SelectedDay = {
  childId: string;
  childName: string;
  day: GrowthDayProgress;
};

const PERIOD_OPTIONS: { id: GrowthPeriod; label: string }[] = [
  { id: 'day', label: '今日' },
  { id: 'week', label: '本週' },
  { id: 'month', label: '本月' },
];

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export function GrowthSummaryPanel({ summaries, title = '成長紀錄', tasks = [] }: GrowthSummaryPanelProps) {
  const [period, setPeriod] = useState<GrowthPeriod>('week');
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);
  const today = getTaipeiDateKey();

  const tasksByChild = useMemo(() => {
    const grouped = new Map<string, GrowthTaskWithChild[]>();
    tasks.forEach((task) => {
      const current = grouped.get(task.childId) ?? [];
      current.push(task);
      grouped.set(task.childId, current);
    });
    return grouped;
  }, [tasks]);

  const statsByChild = useMemo(() => {
    const stats = new Map<string, GrowthPeriodStats>();
    summaries.forEach((summary) => {
      stats.set(summary.childId, getGrowthPeriodStats(tasksByChild.get(summary.childId) ?? [], period, today));
    });
    return stats;
  }, [period, summaries, tasksByChild, today]);

  const toggleChild = (childId: string) => {
    setExpandedChildId((current) => current === childId ? null : childId);
  };

  const handlePeriodChange = (nextPeriod: GrowthPeriod) => {
    setPeriod(nextPeriod);
    setSelectedDay(null);
  };

  return (
    <section className="space-y-5" aria-labelledby="growth-summary-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="growth-summary-title" className="text-xl font-black text-gray-900">{title}</h2>
        </div>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="成長紀錄時間範圍">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={period === option.id}
              onClick={() => handlePeriodChange(option.id)}
              className={`hh-growth-period-control min-h-11 rounded-xl border px-3 text-sm font-black transition-colors ${period === option.id ? 'is-selected border-gray-900 bg-gray-900 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {summaries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm font-bold text-gray-500">
          目前沒有可顯示的成長紀錄。
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map((summary) => {
            const stats = statsByChild.get(summary.childId);
            if (!stats) return null;
            const expanded = expandedChildId === summary.childId;
            return (
              <article key={summary.childId} className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`growth-card-content-${summary.childId}`}
                  onClick={() => toggleChild(summary.childId)}
                  className="flex min-h-20 w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-gray-50 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-black text-gray-900">{summary.childName}</h3>
                      {stats.pendingCount > 0 && <StatusPill label={`待審核 ${stats.pendingCount}`} tone="blue" />}
                      {stats.revisionRequestCount > 0 && <StatusPill label={`需補充 ${stats.revisionRequestCount}`} tone="orange" />}
                    </div>
                    <p className="mt-1 text-sm font-bold text-gray-500">
                      {formatPeriodLabel(stats)} · {stats.plannedCount > 0 ? `已完成 ${stats.completedCount} / ${stats.plannedCount}` : '無安排任務'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <ProgressText stats={stats} />
                    <ChevronDown size={20} aria-hidden="true" className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {expanded && (
                  <div id={`growth-card-content-${summary.childId}`} className="space-y-6 border-t border-gray-100 bg-gray-50/70 p-4 sm:p-5">
                    <PeriodOverview stats={stats} />
                    <DailyProgressSection
                      stats={stats}
                      onSelectDay={(day) => setSelectedDay({ childId: summary.childId, childName: summary.childName, day })}
                    />
                    <CategoryStats stats={stats} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {selectedDay && <GrowthDayDialog selectedDay={selectedDay} onClose={() => setSelectedDay(null)} />}
    </section>
  );
}

function PeriodOverview({ stats }: { stats: GrowthPeriodStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <OverviewTile label="已完成" value={stats.plannedCount > 0 ? `${stats.completedCount} / ${stats.plannedCount}` : '無安排'} />
      <OverviewTile label="完成率" value={stats.plannedCount > 0 ? `${stats.completionRate}%` : '—'} />
      <OverviewTile label="待審核" value={stats.pendingCount} />
      <OverviewTile label="需要補充" value={stats.revisionRequestCount} />
    </div>
  );
}

function DailyProgressSection({ stats, onSelectDay }: { stats: GrowthPeriodStats; onSelectDay: (day: GrowthDayProgress) => void }) {
  const isMonth = stats.range.period === 'month';

  return (
    <section className="space-y-3" aria-labelledby={`daily-progress-${stats.range.period}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 id={`daily-progress-${stats.range.period}`} className="font-black text-gray-900">每日進度</h4>
          <p className="mt-1 text-xs font-bold text-gray-500">點擊日期查看當天任務</p>
        </div>
        {!isMonth && <span className="text-sm font-black text-gray-500">{formatRange(stats.range.startDate, stats.range.throughDate)}</span>}
      </div>

      {isMonth ? (
        <MonthProgressGrid stats={stats} onSelectDay={onSelectDay} />
      ) : (
        <div className="space-y-2">
          {stats.days.map((day) => <DayProgressButton key={day.dateKey} day={day} onSelect={onSelectDay} />)}
        </div>
      )}
    </section>
  );
}

function MonthProgressGrid({ stats, onSelectDay }: { stats: GrowthPeriodStats; onSelectDay: (day: GrowthDayProgress) => void }) {
  const leadingEmptyCells = stats.days[0]?.weekdayIndex ?? 0;
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 sm:p-3">
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-black text-gray-400">
        {WEEKDAY_LABELS.map((label) => <span key={label} className="py-1">{label}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingEmptyCells }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" />)}
        {stats.days.map((day) => (
          <DayProgressButton key={day.dateKey} day={day} onSelect={onSelectDay} compact />
        ))}
      </div>
    </div>
  );
}

function DayProgressButton({ day, onSelect, compact = false }: { key?: string; day: GrowthDayProgress; onSelect: (day: GrowthDayProgress) => void; compact?: boolean }) {
  const interactive = day.total > 0;
  const label = `${formatFullDate(day.dateKey)}，${getDayStateLabel(day)}，${day.completed} / ${day.total} 個已完成`;
  const progressText = day.state === 'future'
    ? (compact ? '未開始' : '尚未開始')
    : day.total > 0 ? `${day.completed} / ${day.total}` : '—';
  const content = (
    <>
      <span className={`flex items-center justify-between gap-2 ${compact ? 'flex-col' : ''}`}>
        <span className="font-black text-gray-800">{compact ? day.dayOfMonth : `週${WEEKDAY_LABELS[day.weekdayIndex]}`}</span>
        <span className={`font-black ${day.state === 'complete' ? 'text-emerald-700' : 'text-gray-600'}`}>{progressText}</span>
      </span>
      {!compact && <span className="text-xs font-bold text-gray-500">{getDayStateLabel(day)}</span>}
    </>
  );

  if (!interactive) {
    return <div aria-label={label} className={`flex min-h-14 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-3 py-2 ${compact ? 'min-h-12 px-1.5' : ''}`}>{content}</div>;
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onSelect(day)}
      className={`flex min-h-14 flex-col justify-center rounded-2xl border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-gray-400 hover:bg-gray-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gray-400 ${compact ? 'min-h-12 px-1.5 text-center' : ''}`}
    >
      {content}
    </button>
  );
}

function CategoryStats({ stats }: { stats: GrowthPeriodStats }) {
  return (
    <section className="space-y-3" aria-labelledby={`category-stats-${stats.range.period}`}>
      <div>
        <h4 id={`category-stats-${stats.range.period}`} className="font-black text-gray-900">分類統計</h4>
        <p className="mt-1 text-xs font-bold text-gray-500">已完成 / 已安排</p>
      </div>
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        {TASK_CATEGORIES.map((category) => {
          const progress = stats.categories[category.id];
          const meta = getTaskCategoryMeta(category.id);
          const percentage = progress.planned === 0 ? 0 : Math.round((progress.completed / progress.planned) * 100);
          return (
            <div key={category.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-bold text-gray-700">
                  <CategoryBadge category={category.id} compact />
                  <span className="truncate">{meta.label}</span>
                </span>
                <span className="shrink-0 font-black text-gray-700">{progress.planned > 0 ? `${progress.completed} / ${progress.planned}` : '無安排'}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                <div className="h-full rounded-full bg-gray-700 transition-[width] duration-300" style={{ width: `${percentage}%` }} />
              </div>
              {progress.planned > 0 && (progress.pending > 0 || progress.revisionRequested > 0 || progress.todo > 0) && (
                <p className="text-xs font-bold text-gray-500">
                  {progress.pending > 0 && `待審核 ${progress.pending}`}
                  {progress.pending > 0 && (progress.revisionRequested > 0 || progress.todo > 0) ? ' · ' : ''}
                  {progress.revisionRequested > 0 && `需補充 ${progress.revisionRequested}`}
                  {progress.revisionRequested > 0 && progress.todo > 0 ? ' · ' : ''}
                  {progress.todo > 0 && `尚未開始 ${progress.todo}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GrowthDayDialog({ selectedDay, onClose }: { selectedDay: SelectedDay; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = document.getElementById('growth-day-dialog');
      const focusableNodes = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])');
      const focusable = focusableNodes ? Array.from(focusableNodes) : [];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="hh-growth-day-dialog-layer" role="presentation">
      <section id="growth-day-dialog" className="relative max-h-[calc(100dvh-48px)] w-full max-w-lg animate-slide-up overflow-y-auto rounded-3xl border border-gray-200 bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="growth-day-dialog-title">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-gray-500">{selectedDay.childName}</p>
            <h3 id="growth-day-dialog-title" className="mt-1 text-xl font-black text-gray-900">{formatFullDate(selectedDay.day.dateKey)}</h3>
            <p className="mt-1 text-sm font-bold text-gray-500">已完成 {selectedDay.day.completed} / {selectedDay.day.total} 個任務</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="關閉" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </header>

        <div className="space-y-2">
          {selectedDay.day.tasks.map((task) => <GrowthDayTaskRow key={task.id} task={task} />)}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function GrowthDayTaskRow({ task }: { key?: string; task: GrowthTaskWithChild | GrowthDayProgress['tasks'][number] }) {
  const status = task.status;
  const statusIcon = status === 'completed'
    ? <CheckCircle2 size={18} aria-hidden="true" className="text-emerald-600" />
    : status === 'pending'
      ? <Clock3 size={18} aria-hidden="true" className="text-blue-600" />
      : status === 'revision_requested'
        ? <RotateCcw size={18} aria-hidden="true" className="text-orange-600" />
        : <Circle size={18} aria-hidden="true" className="text-gray-400" />;

  return (
    <article className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{statusIcon}</span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-black text-gray-900">{task.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
            <span>{getTaskStatusLabel(status)}</span>
            <CategoryBadge category={task.category} compact />
            <PointValue value={task.approvedPoints ?? task.points} />
          </div>
        </div>
      </div>
      {(task.reflection || task.childReflectionText || task.parentFeedback || task.parentFeedbackText || task.parentCorrection || task.parentCorrectionText) && (
        <div className="mt-3 space-y-1 rounded-xl bg-white p-3 text-sm leading-6 text-gray-700">
          {(task.reflection || task.childReflectionText) && <p><strong>心得：</strong>{task.reflection ?? task.childReflectionText}</p>}
          {(task.parentFeedback || task.parentFeedbackText) && <p><strong>家長說：</strong>{task.parentFeedback ?? task.parentFeedbackText}</p>}
          {(task.parentCorrection || task.parentCorrectionText) && <p><strong>補充：</strong>{task.parentCorrection ?? task.parentCorrectionText}</p>}
        </div>
      )}
    </article>
  );
}

function ProgressText({ stats }: { stats: GrowthPeriodStats }) {
  return (
    <div className="text-right" aria-label={stats.plannedCount > 0 ? `完成 ${stats.completedCount} / ${stats.plannedCount} 個任務` : '這段期間無安排任務'}>
      <div className="text-lg font-black tabular-nums text-gray-900">{stats.plannedCount > 0 ? `${stats.completedCount}/${stats.plannedCount}` : '—'}</div>
      <div className="text-xs font-bold text-gray-500">{stats.plannedCount > 0 ? '已完成' : '無安排'}</div>
    </div>
  );
}

function OverviewTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3">
      <div className="text-lg font-black tabular-nums text-gray-900">{value}</div>
      <div className="mt-1 text-xs font-bold text-gray-500">{label}</div>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'blue' | 'orange' }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${tone === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>{label}</span>;
}

function formatPeriodLabel(stats: GrowthPeriodStats) {
  if (stats.range.period === 'day') return formatFullDate(stats.range.startDate);
  if (stats.range.period === 'month') return `${stats.range.startDate.slice(0, 7).replace('-', ' 年 ')} 月`;
  return formatRange(stats.range.startDate, stats.range.throughDate);
}

function formatRange(startDate: string, endDate: string) {
  return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
}

function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Taipei' }).format(new Date(`${dateKey}T00:00:00Z`));
}

function formatFullDate(dateKey: string) {
  return new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Taipei' }).format(new Date(`${dateKey}T00:00:00Z`));
}

function getDayStateLabel(day: GrowthDayProgress) {
  if (day.state === 'none') return '無安排';
  if (day.state === 'future') return '尚未開始';
  if (day.state === 'not_started') return '尚未開始';
  if (day.state === 'complete') return '全部完成';
  return '進行中';
}
