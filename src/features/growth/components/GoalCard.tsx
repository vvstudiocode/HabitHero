import { CheckCircle2, Clock, MessageSquareText, RotateCcw, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { getMoodLabel, getTaskStatusLabel } from '../constants';
import type { GrowthTask } from '../types';
import { CategoryBadge } from './CategoryBadge';

interface GoalCardProps {
  key?: string;
  task: GrowthTask;
  childName?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function GoalCard({ task, childName, action, compact = false }: GoalCardProps) {
  const reflection = task.reflection ?? task.childReflectionText;
  const mood = task.mood ?? task.childMood;
  const difficulty = task.difficulty ?? task.childDifficulty;
  const parentFeedback = task.parentFeedback ?? task.parentFeedbackText;
  const parentCorrection = task.parentCorrection ?? task.parentCorrectionText;
  const isAwaitingParentConfirmation = task.origin === 'child_proposed' && task.status === 'todo' && !task.confirmedAt;
  const displayStatus = isAwaitingParentConfirmation ? '可先開始，待家長確認點數' : getTaskStatusLabel(task.status);
  const dueTime = task.dueTime ? task.dueTime.slice(0, 5) : null;

  return (
    <article className={cn('rounded-2xl border bg-white p-4 shadow-sm', task.status === 'revision_requested' ? 'border-orange-200 bg-orange-50/60' : 'border-gray-100')}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {childName && <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">{childName}</span>}
            <CategoryBadge category={task.category} compact />
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
              <Clock size={12} /> {displayStatus}
            </span>
          </div>

          <h3 className={cn('whitespace-pre-wrap break-words font-black text-gray-900 leading-snug', compact ? 'text-base' : 'text-lg')}>{task.name}</h3>

          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold text-gray-500">
            <span className="inline-flex items-center gap-1 text-yellow-600">
              <Star size={15} className="fill-yellow-400 text-yellow-400" /> {task.approvedPoints ?? task.points} pt
            </span>
            {task.origin === 'child_proposed' && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-700">孩子主動提出</span>}
            {task.isDaily && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-700">每日</span>}
            {dueTime && <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-blue-600">{dueTime} 開始</span>}
          </div>
        </div>

        {action && <div className="shrink-0 self-end sm:self-start">{action}</div>}
      </div>

      {(task.revisionNote || reflection || parentFeedback || parentCorrection) && (
        <div className="mt-4 space-y-2 rounded-xl bg-white/70 p-3 text-sm leading-6 text-gray-700">
          {task.revisionNote && (
            <p className="flex gap-2">
              <RotateCcw size={16} className="mt-1 shrink-0 text-orange-500" />
              <span><strong>補充提醒：</strong>{task.revisionNote}</span>
            </p>
          )}
          {reflection && (
            <p className="flex gap-2">
              <MessageSquareText size={16} className="mt-1 shrink-0 text-blue-500" />
              <span><strong>我的心得：</strong>{reflection}</span>
            </p>
          )}
          {(mood || difficulty) && (
            <p className="pl-6 text-xs font-bold text-gray-500">心情 {getMoodLabel(mood)} · 難度 {difficulty ?? '-'} / 5</p>
          )}
          {parentFeedback && (
            <p className="flex gap-2">
              <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-500" />
              <span><strong>爸媽鼓勵：</strong>{parentFeedback}</span>
            </p>
          )}
          {parentCorrection && (
            <p className="pl-6"><strong>批改建議：</strong>{parentCorrection}</p>
          )}
        </div>
      )}
    </article>
  );
}
