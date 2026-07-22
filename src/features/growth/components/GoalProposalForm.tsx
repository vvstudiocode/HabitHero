import { useState } from 'react';
import { Plus } from 'lucide-react';
import { TASK_CATEGORIES, DEFAULT_TASK_CATEGORY } from '../constants';
import type { GoalProposalInput, GrowthTaskTemplate, TaskCategory } from '../types';
import { CategoryBadge } from './CategoryBadge';

interface GoalProposalFormProps {
  templates?: GrowthTaskTemplate[];
  loading?: boolean;
  onSubmit: (input: GoalProposalInput) => Promise<void> | void;
}

export function GoalProposalForm({ templates = [], loading = false, onSubmit }: GoalProposalFormProps) {
  const [name, setName] = useState('');
  const [points, setPoints] = useState(5);
  const [category, setCategory] = useState<TaskCategory>(DEFAULT_TASK_CATEGORY);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onSubmit({ name: trimmed, points: Math.max(1, points), category });
    setName('');
    setPoints(5);
    setCategory(DEFAULT_TASK_CATEGORY);
  };

  return (
    <section className="rounded-3xl border border-yellow-100 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-black text-gray-900">新增今日目標</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">目標名稱可以自由寫，分類用來幫你看到自己的成長方向。</p>
      </div>

      {templates.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {templates.slice(0, 8).map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                setName(template.name);
                setPoints(template.points);
                setCategory(template.category ?? DEFAULT_TASK_CATEGORY);
              }}
              className="min-h-11 shrink-0 rounded-full border border-yellow-200 bg-yellow-50 px-3 text-sm font-bold text-yellow-800 transition-colors hover:bg-yellow-100"
            >
              {template.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-gray-700">我今天想做到</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-gray-200 p-3 text-base outline-none focus:ring-2 focus:ring-yellow-400"
            placeholder="例如：自己整理明天的書包"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_132px]">
          <div>
            <span className="mb-2 block text-sm font-bold text-gray-700">目標分類</span>
            <div className="grid grid-cols-2 gap-2">
              {TASK_CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={`min-h-11 rounded-2xl border p-2 text-left transition-colors ${category === item.id ? 'border-yellow-400 bg-yellow-50 ring-2 ring-yellow-100' : 'border-gray-100 bg-gray-50'}`}
                >
                  <CategoryBadge category={item.id} compact />
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-700">預估點數</span>
            <input
              type="number"
              min="1"
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
              className="min-h-12 w-full rounded-2xl border border-gray-200 p-3 text-base outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !name.trim()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 font-black text-yellow-950 transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={20} /> 送給爸媽確認
        </button>
      </div>
    </section>
  );
}
