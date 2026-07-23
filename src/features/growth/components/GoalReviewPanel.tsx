import { Fragment, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { TASK_CATEGORIES } from '../constants';
import type { GoalConfirmationInput, GoalReviewInput, GrowthTaskWithChild, TaskCategory } from '../types';
import { CategoryBadge } from './CategoryBadge';
import { GoalCard } from './GoalCard';
import { ParentFeedbackForm } from './ParentFeedbackForm';

interface GoalReviewPanelProps {
  proposedTasks: GrowthTaskWithChild[];
  pendingTasks: GrowthTaskWithChild[];
  loading?: boolean;
  onConfirmGoal: (childId: string, taskId: string, input: GoalConfirmationInput) => Promise<void> | void;
  onReturnGoal: (childId: string, taskId: string, revisionNote: string) => Promise<void> | void;
  onReviewCompletion: (childId: string, taskId: string, input: GoalReviewInput) => Promise<void> | void;
}

export function GoalReviewPanel({ proposedTasks, pendingTasks, loading = false, onConfirmGoal, onReturnGoal, onReviewCompletion }: GoalReviewPanelProps) {
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [resolvedProposalIds, setResolvedProposalIds] = useState<Set<string>>(() => new Set());
  const [resolvedCompletionIds, setResolvedCompletionIds] = useState<Set<string>>(() => new Set());
  const visibleProposedTasks = proposedTasks.filter((task) => !resolvedProposalIds.has(task.id));
  const visiblePendingTasks = pendingTasks.filter((task) => !resolvedCompletionIds.has(task.id));

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">待確認目標 ({visibleProposedTasks.length})</h2>
          <p className="mt-1 text-sm text-gray-500">可以校準名稱、分類與點數，也可以退回請孩子寫清楚。</p>
        </div>
        {visibleProposedTasks.map((task) => (
          <Fragment key={task.id}>
            {editingProposalId === task.id ? (
              <ProposalEditor
              task={task}
              loading={loading}
              onCancel={() => setEditingProposalId(null)}
              onConfirm={async (input) => {
                await onConfirmGoal(task.childId, task.id, input);
                setResolvedProposalIds((ids) => new Set(ids).add(task.id));
                setEditingProposalId(null);
              }}
              onReturn={async (note) => {
                await onReturnGoal(task.childId, task.id, note);
                setResolvedProposalIds((ids) => new Set(ids).add(task.id));
                setEditingProposalId(null);
              }}
            />
          ) : (
            <GoalCard
              task={task}
              childName={task.childName}
              action={(
                <button type="button" onClick={() => setEditingProposalId(task.id)} className="min-h-11 rounded-xl bg-blue-500 px-3 text-sm font-black text-white">
                  處理
                </button>
              )}
            />
          )}
          </Fragment>
        ))}
        {visibleProposedTasks.length === 0 && <EmptyState text="沒有等待確認的新目標。" />}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">待審核完成 ({visiblePendingTasks.length})</h2>
          <p className="mt-1 text-sm text-gray-500">看孩子心得後，留下鼓勵、批改或請他補充。</p>
        </div>
        {visiblePendingTasks.map((task) => (
          <Fragment key={task.id}>
            {reviewingTaskId === task.id ? (
              <ParentFeedbackForm
              task={task}
              childName={task.childName}
              loading={loading}
              onCancel={() => setReviewingTaskId(null)}
              onSubmit={async (input) => {
                await onReviewCompletion(task.childId, task.id, input);
                setResolvedCompletionIds((ids) => new Set(ids).add(task.id));
                setReviewingTaskId(null);
              }}
            />
          ) : (
            <GoalCard
              task={task}
              childName={task.childName}
              action={(
                <button type="button" onClick={() => setReviewingTaskId(task.id)} className="min-h-11 rounded-xl bg-green-500 px-3 text-sm font-black text-white">
                  審核
                </button>
              )}
            />
          )}
          </Fragment>
        ))}
        {visiblePendingTasks.length === 0 && <EmptyState text="沒有等待審核的完成心得。" />}
      </section>
    </div>
  );
}

function ProposalEditor({ task, loading, onCancel, onConfirm, onReturn }: {
  task: GrowthTaskWithChild;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (input: GoalConfirmationInput) => Promise<void>;
  onReturn: (revisionNote: string) => Promise<void>;
}) {
  const [name, setName] = useState(task.name);
  const [points, setPoints] = useState(task.points);
  const [category, setCategory] = useState<TaskCategory>(task.category ?? 'life_habit');
  const [revisionNote, setRevisionNote] = useState(task.revisionNote ?? '');

  return (
    <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{task.childName}</span>
        <CategoryBadge category={category} />
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-gray-700">確認後名稱</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className="min-h-12 w-full rounded-2xl border border-gray-200 p-3 outline-none focus:ring-2 focus:ring-blue-400" />
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_132px]">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-700">分類</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as TaskCategory)}
              className="min-h-12 w-full rounded-2xl border border-gray-200 bg-white p-3 text-base font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-400"
            >
              {TASK_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-700">點數</span>
            <input type="number" min="1" value={points} onChange={(event) => setPoints(Number(event.target.value))} className="min-h-12 w-full rounded-2xl border border-gray-200 p-3 outline-none focus:ring-2 focus:ring-blue-400" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-gray-700">退回留言</span>
          <textarea value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} rows={2} className="w-full rounded-2xl border border-gray-200 p-3 outline-none focus:ring-2 focus:ring-orange-400" placeholder="需要孩子補充時填寫" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl bg-gray-100 px-4 font-black text-gray-600">取消</button>
          <button type="button" onClick={() => void onReturn(revisionNote.trim())} disabled={loading || !revisionNote.trim()} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
            <RotateCcw size={18} /> 退回
          </button>
          <button type="button" onClick={() => void onConfirm({ name: name.trim(), points: Math.max(1, points), category })} disabled={loading || !name.trim() || points < 1} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
            <CheckCircle2 size={18} /> 確認
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm font-bold text-gray-400">{text}</div>;
}
