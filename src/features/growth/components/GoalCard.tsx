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

  return (
    <article className={cn('rounded-2xl border bg-white p-4 shadow-sm', task.status === 'revision_requested' ? 'border-orange-200 bg-orange-50/60' : 'border-gray-100')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {childName && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">{childName}</span>}
            <CategoryBadge category={task.category} compact />
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
              <Clock size={12} /> {getTaskStatusLabel(task.status)}
            </span>
          </div>
          <h3 className={cn('break-words font-black text-gray-900', compact ? 'text-base' : 'text-lg')}>{task.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-gray-500">
            <span className="inline-flex items-center gap-1 text-yellow-600">
              <Star size={15} className="fill-yellow-400 text-yellow-400" /> {task.approvedPoints ?? task.points} pt
            </span>
            {task.origin === 'child_proposed' && <span className="text-amber-700">孩子主動提出</span>}
            {task.isDaily && <span className="text-emerald-700">每日</span>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
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
