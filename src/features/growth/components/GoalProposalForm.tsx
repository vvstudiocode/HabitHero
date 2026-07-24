import { useState } from 'react';
import { Plus } from 'lucide-react';
import { TASK_CATEGORIES, DEFAULT_TASK_CATEGORY } from '../constants';
import type { GoalProposalInput, GrowthTaskTemplate, TaskCategory } from '../types';

interface GoalProposalFormProps {
  templates?: GrowthTaskTemplate[];
  loading?: boolean;
  onSubmit: (input: GoalProposalInput) => Promise<void> | void;
}

export function GoalProposalForm({ templates = [], loading = false, onSubmit }: GoalProposalFormProps) {
  const [name, setName] = useState('');
  const [points, setPoints] = useState(5);
  const [category, setCategory] = useState<TaskCategory>(DEFAULT_TASK_CATEGORY);
  const [dueTime, setDueTime] = useState('');
  const [duration, setDuration] = useState<number | ''>('');

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || !dueTime) return;
    await onSubmit({ name: trimmed, points: Math.max(1, points), category, dueTime, duration: duration || undefined });
    setName('');
    setPoints(5);
    setCategory(DEFAULT_TASK_CATEGORY);
    setDueTime('');
    setDuration('');
  };

  return (
    <section className="rounded-3xl border border-yellow-100 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-black text-gray-900">新增今日目標</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">目標名稱可以自由寫，分類用來幫你看到自己的成長方向。</p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-gray-700">我今天想做到</span>
          <textarea
            value={name}
            onChange={(event) => setName(event.target.value)}
            rows={2}
            className="min-h-12 w-full resize-y rounded-2xl border border-gray-200 p-3 text-base leading-6 outline-none focus:ring-2 focus:ring-yellow-400"
            placeholder="例如：自己整理明天的書包"
          />
        </label>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,132px)_minmax(0,132px)_minmax(0,132px)]">
          <label className="block min-w-0 w-full">
            <span className="mb-2 block text-sm font-bold text-gray-700">目標分類</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as TaskCategory)}
              className="min-h-12 w-full rounded-2xl border border-gray-200 bg-white p-3 text-base font-bold text-gray-800 outline-none focus:ring-2 focus:ring-yellow-400"
            >
              {TASK_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 w-full">
            <span className="mb-2 block text-sm font-bold text-gray-700">預估點數</span>
            <input
              type="number"
              min="1"
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
              className="min-h-12 w-full rounded-2xl border border-gray-200 p-3 text-base outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </label>
          <label className="block min-w-0 w-full">
            <span className="mb-2 block text-sm font-bold text-gray-700 truncate">什麼時候開始？</span>
            <input
              type="time"
              value={dueTime}
              onChange={(event) => setDueTime(event.target.value)}
              className="hh-time-input min-h-12 w-full min-w-0 max-w-full rounded-2xl border border-gray-200 p-3 text-base outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </label>
          <label className="block min-w-0 w-full">
            <span className="mb-2 block text-sm font-bold text-gray-700">想做多久？</span>
            <input
              type="number"
              min="1"
              value={duration}
              onChange={(event) => setDuration(event.target.value ? Number(event.target.value) : '')}
              placeholder="分鐘"
              className="min-h-12 w-full rounded-2xl border border-gray-200 p-3 text-base outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !name.trim() || !dueTime}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 font-black text-yellow-950 transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={20} /> 建立並開始
        </button>
      </div>
    </section>
  );
}
