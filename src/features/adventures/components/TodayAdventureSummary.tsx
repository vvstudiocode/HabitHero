import { AlertCircle, CheckCircle2, ChevronDown, Circle, CloudUpload, Clock3 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { formatAdventureTaskWindow, getAdventureProgress, getAdventureStatusLabel, getAdventureTaskState } from '../adventure-progress';
import type { AdventureProgress, AdventureTask, AdventureTaskVisualState } from '../types';
import type { AdventureDateGroup, TodayAdventureSummary } from '../today-adventure-summary';
import { PointValue } from '../../../components/shared/PointValue';

interface TodayAdventureSummaryProps {
  summary: TodayAdventureSummary;
  today: string;
  onTaskSelect: (task: AdventureTask) => void;
}

interface CollapsibleAdventureSectionProps {
  id: string;
  title: string;
  progress: AdventureProgress;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function CollapsibleAdventureSection({
  id,
  title,
  progress,
  expanded,
  onToggle,
  children,
}: CollapsibleAdventureSectionProps) {
  const instanceId = useId().replaceAll(':', '');
  const titleId = `${id}-title-${instanceId}`;
  const contentId = `${id}-content-${instanceId}`;

  return (
    <section className="hh-child-feature-section hh-child-adventure-section" aria-labelledby={titleId}>
      <div className="hh-child-adventure-section-header">
        <h2 id={titleId} className="hh-child-adventure-section-heading">
          <button
            type="button"
            className="hh-child-adventure-section-toggle"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={onToggle}
          >
            <ChevronDown
              className={`hh-child-adventure-section-chevron${expanded ? ' is-expanded' : ''}`}
              size={20}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">{title}</span>
            <span className="hh-child-adventure-section-progress" aria-label={`完成 ${progress.completed} 個，共 ${progress.total} 個`}>
              {progress.completed}/{progress.total}
            </span>
          </button>
        </h2>
      </div>
      <div id={contentId} className="hh-child-adventure-section-content" hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}

function getStateIcon(state: AdventureTaskVisualState) {
  if (state === 'completed' || state === 'submitted') return CheckCircle2;
  if (state === 'syncing') return CloudUpload;
  if (state === 'revision') return AlertCircle;
  if (state === 'waiting') return Clock3;
  return Circle;
}

function formatDate(dateKey: string, today: string): string {
  if (dateKey === today) return `今天 · ${dateKey.replaceAll('-', '/')}`;
  return dateKey.replaceAll('-', '/');
}

function formatHistoryTime(task: AdventureTask): string | null {
  const timestamp = task.status === 'cancelled'
    ? task.cancelledAt
    : task.completedAt ?? task.reviewedAt ?? task.submittedAt;
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function AdventureSummaryTask({ task, historical = false, onSelect }: { key?: string; task: AdventureTask; historical?: boolean; onSelect: (task: AdventureTask) => void }) {
  const state = getAdventureTaskState(task);
  const StateIcon = getStateIcon(state);
  const statusLabel = getAdventureStatusLabel(state);
  const taskWindow = formatAdventureTaskWindow(task);
  const historyTime = historical ? formatHistoryTime(task) : null;
  const reflection = task.reflection ?? task.childReflectionText;
  const parentFeedback = task.parentFeedback ?? task.parentFeedbackText;
  const parentCorrection = task.parentCorrection ?? task.parentCorrectionText;

  return (
    <li>
      <button
        type="button"
        className="hh-child-feature-task w-full rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        onClick={() => onSelect(task)}
        aria-label={`${task.name}，${statusLabel}，時間 ${taskWindow}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <StateIcon
            size={22}
            aria-hidden="true"
            className={state === 'cancelled'
              ? 'mt-0.5 shrink-0 text-amber-600'
              : state === 'completed' || state === 'submitted'
                ? 'mt-0.5 shrink-0 text-emerald-500'
                : 'mt-0.5 shrink-0 text-gray-400'}
          />
          <div className="min-w-0 flex-1">
            <p className="hh-child-feature-task-name break-words font-black text-gray-900">{task.name}</p>
            <p className="hh-child-feature-task-status mt-1 text-sm font-bold text-gray-500">
              {state === 'available' ? `時間 ${taskWindow}` : statusLabel}{historyTime ? ` · ${historyTime} ${state === 'cancelled' ? '放棄' : '完成'}` : ''}
            </p>
          </div>
          <PointValue value={task.approvedPoints ?? task.points} className="shrink-0 text-sm font-black text-yellow-600" />
        </div>
        {historical && (reflection || parentFeedback || parentCorrection) && (
          <div className="mt-3 space-y-1 rounded-xl bg-gray-50 p-3 text-sm leading-6 text-gray-600">
            {reflection && <p><strong className="text-gray-800">我的心得：</strong>{reflection}</p>}
            {parentFeedback && <p><strong className="text-gray-800">爸媽鼓勵：</strong>{parentFeedback}</p>}
            {parentCorrection && <p><strong className="text-gray-800">批改建議：</strong>{parentCorrection}</p>}
          </div>
        )}
      </button>
    </li>
  );
}

function CompletedDateGroup({ group, today, onTaskSelect }: { key?: string; group: AdventureDateGroup; today: string; onTaskSelect: (task: AdventureTask) => void }) {
  const completedCount = group.tasks.filter(({ status }) => status === 'completed').length;
  const cancelledCount = group.tasks.filter(({ status }) => status === 'cancelled').length;
  const countLabel = [
    completedCount > 0 ? `完成 ${completedCount} 個` : null,
    cancelledCount > 0 ? `放棄 ${cancelledCount} 個` : null,
  ].filter(Boolean).join(' · ');

  return (
    <details className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" open={group.dateKey === today}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-black text-gray-800 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-400 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronDown size={18} aria-hidden="true" />
          <span>{formatDate(group.dateKey, today)}</span>
        </span>
        <span className="shrink-0 text-sm font-bold text-gray-500">{countLabel}</span>
      </summary>
      <ul className="space-y-2 border-t border-gray-100 bg-gray-50/70 p-3">
        {group.tasks.map((task) => <AdventureSummaryTask key={task.id} task={task} historical onSelect={onTaskSelect} />)}
      </ul>
    </details>
  );
}

export function TodayAdventureSummary({ summary, today, onTaskSelect }: TodayAdventureSummaryProps) {
  const dailyProgress = getAdventureProgress(summary.daily);
  const generalProgress = getAdventureProgress(summary.generalActive);
  const [dailyExpanded, setDailyExpanded] = useState(true);
  const [generalExpanded, setGeneralExpanded] = useState(false);

  return (
    <div className="hh-child-feature-page hh-child-feature-page--adventure space-y-6" aria-label="今日冒險進度">
      <CollapsibleAdventureSection
        id="today-daily-adventure"
        title="每日冒險"
        progress={dailyProgress}
        expanded={dailyExpanded}
        onToggle={() => setDailyExpanded((current) => !current)}
      >
        {summary.daily.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center text-sm font-bold text-gray-400">今天沒有每日冒險。</p>
        ) : (
          <ul className="space-y-2">
            {summary.daily.map((task) => <AdventureSummaryTask key={task.id} task={task} onSelect={onTaskSelect} />)}
          </ul>
        )}
      </CollapsibleAdventureSection>

      <CollapsibleAdventureSection
        id="today-general-adventure"
        title="一般冒險"
        progress={generalProgress}
        expanded={generalExpanded}
        onToggle={() => setGeneralExpanded((current) => !current)}
      >
        {summary.generalActive.length > 0 && (
          <div className="space-y-2">
            <h3 className="px-2 text-sm font-black text-gray-500">進行中</h3>
            <ul className="space-y-2">
              {summary.generalActive.map((task) => <AdventureSummaryTask key={task.id} task={task} onSelect={onTaskSelect} />)}
            </ul>
          </div>
        )}

        {summary.generalHistoryByDate.length > 0 && (
          <div className="space-y-2">
            <h3 className="px-2 text-sm font-black text-gray-500">完成紀錄</h3>
            {summary.generalHistoryByDate.map((group) => (
              <CompletedDateGroup key={group.dateKey} group={group} today={today} onTaskSelect={onTaskSelect} />
            ))}
          </div>
        )}

        {summary.generalActive.length === 0 && summary.generalHistoryByDate.length === 0 && (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center text-sm font-bold text-gray-400">目前沒有一般冒險。</p>
        )}
      </CollapsibleAdventureSection>

    </div>
  );
}
