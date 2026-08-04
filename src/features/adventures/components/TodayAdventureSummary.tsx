import { AlertCircle, CheckCircle2, ChevronDown, Circle, CloudUpload, Clock3 } from 'lucide-react';
import { formatAdventureTaskWindow, getAdventureProgress, getAdventureStatusLabel, getAdventureTaskState } from '../adventure-progress';
import type { AdventureTask, AdventureTaskVisualState } from '../types';
import type { AdventureDateGroup, TodayAdventureSummary } from '../today-adventure-summary';
import { PointValue } from '../../../components/shared/PointValue';

interface TodayAdventureSummaryProps {
  summary: TodayAdventureSummary;
  today: string;
  onTaskSelect: (task: AdventureTask) => void;
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

function formatCompletedTime(task: AdventureTask): string | null {
  const timestamp = task.completedAt ?? task.reviewedAt ?? task.submittedAt;
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function AdventureSummaryTask({ task, completed = false, onSelect }: { key?: string; task: AdventureTask; completed?: boolean; onSelect: (task: AdventureTask) => void }) {
  const state = getAdventureTaskState(task);
  const StateIcon = getStateIcon(state);
  const statusLabel = getAdventureStatusLabel(state);
  const taskWindow = formatAdventureTaskWindow(task);
  const completedTime = completed ? formatCompletedTime(task) : null;
  const reflection = task.reflection ?? task.childReflectionText;
  const parentFeedback = task.parentFeedback ?? task.parentFeedbackText;
  const parentCorrection = task.parentCorrection ?? task.parentCorrectionText;

  return (
    <li>
      <button
        type="button"
        className="w-full rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        onClick={() => onSelect(task)}
        aria-label={`${task.name}，${statusLabel}，時間 ${taskWindow}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <StateIcon
            size={22}
            aria-hidden="true"
            className={state === 'completed' || state === 'submitted' ? 'mt-0.5 shrink-0 text-emerald-500' : 'mt-0.5 shrink-0 text-gray-400'}
          />
          <div className="min-w-0 flex-1">
            <p className="break-words font-black text-gray-900">{task.name}</p>
            <p className="mt-1 text-sm font-bold text-gray-500">
              {state === 'available' ? `時間 ${taskWindow}` : statusLabel}{completedTime ? ` · ${completedTime} 完成` : ''}
            </p>
          </div>
          <PointValue value={task.approvedPoints ?? task.points} className="shrink-0 text-sm font-black text-yellow-600" />
        </div>
        {completed && (reflection || parentFeedback || parentCorrection) && (
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
  return (
    <details className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" open={group.dateKey === today}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-black text-gray-800 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-400 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronDown size={18} aria-hidden="true" />
          <span>{formatDate(group.dateKey, today)}</span>
        </span>
        <span className="shrink-0 text-sm font-bold text-gray-500">完成 {group.tasks.length} 個</span>
      </summary>
      <ul className="space-y-2 border-t border-gray-100 bg-gray-50/70 p-3">
        {group.tasks.map((task) => <AdventureSummaryTask key={task.id} task={task} completed onSelect={onTaskSelect} />)}
      </ul>
    </details>
  );
}

export function TodayAdventureSummary({ summary, today, onTaskSelect }: TodayAdventureSummaryProps) {
  const dailyProgress = getAdventureProgress(summary.daily);

  return (
    <div className="space-y-6" aria-label="今日冒險進度">
      <section className="space-y-3" aria-labelledby="today-daily-adventure-title">
        <div className="flex items-end justify-between gap-3 px-2">
          <div>
            <h2 id="today-daily-adventure-title" className="font-black text-gray-800">每日冒險</h2>
          </div>
          <span className="shrink-0 text-lg font-black tabular-nums text-gray-700">{dailyProgress.completed}/{dailyProgress.total}</span>
        </div>
        {summary.daily.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center text-sm font-bold text-gray-400">今天沒有每日冒險。</p>
        ) : (
          <ul className="space-y-2">
            {summary.daily.map((task) => <AdventureSummaryTask key={task.id} task={task} onSelect={onTaskSelect} />)}
          </ul>
        )}
      </section>

      {(summary.generalActive.length > 0 || summary.generalCompletedByDate.length > 0) && (
        <section className="space-y-3" aria-labelledby="today-general-adventure-title">
          <div className="px-2">
            <h2 id="today-general-adventure-title" className="font-black text-gray-800">一般冒險</h2>
          </div>

          {summary.generalActive.length > 0 && (
            <div className="space-y-2">
              <h3 className="px-2 text-sm font-black text-gray-500">進行中</h3>
              <ul className="space-y-2">
                {summary.generalActive.map((task) => <AdventureSummaryTask key={task.id} task={task} onSelect={onTaskSelect} />)}
              </ul>
            </div>
          )}

          {summary.generalCompletedByDate.length > 0 && (
            <div className="space-y-2">
              <h3 className="px-2 text-sm font-black text-gray-500">完成紀錄</h3>
              {summary.generalCompletedByDate.map((group) => (
                <CompletedDateGroup key={group.dateKey} group={group} today={today} onTaskSelect={onTaskSelect} />
              ))}
            </div>
          )}
        </section>
      )}

    </div>
  );
}
