import { useState } from 'react';
import { MOOD_CHOICES } from '../constants';
import type { GoalReflectionInput, GrowthMood, GrowthTask } from '../types';

interface GoalSubmissionFormProps {
  task: GrowthTask;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (input: GoalReflectionInput) => Promise<void> | void;
}

export function GoalSubmissionForm({ task, loading = false, onCancel, onSubmit }: GoalSubmissionFormProps) {
  const [reflection, setReflection] = useState(task.reflection ?? task.childReflectionText ?? '');
  const [mood, setMood] = useState<GrowthMood>((task.mood as GrowthMood) || (task.childMood as GrowthMood) || 'proud');
  const [difficulty, setDifficulty] = useState(task.difficulty ?? task.childDifficulty ?? 3);

  const submit = async () => {
    const trimmed = reflection.trim();
    if (!trimmed) return;
    await onSubmit({ reflection: trimmed, mood, difficulty });
  };

  return (
    <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-xl">
      <h3 className="text-xl font-black text-gray-900">完成心得</h3>
      <p className="mt-1 text-sm font-bold text-green-700">{task.name}</p>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-gray-700">我完成後發現</span>
          <textarea
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-gray-200 p-3 text-base leading-6 outline-none focus:ring-2 focus:ring-green-400"
            placeholder="寫下你怎麼完成、遇到什麼、下次想怎麼做"
          />
        </label>
        <div>
          <span className="mb-2 block text-sm font-bold text-gray-700">完成時的心情</span>
          <div className="grid grid-cols-2 gap-2">
            {MOOD_CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => setMood(choice.id)}
                className={`min-h-11 rounded-2xl border px-3 text-sm font-bold transition-colors ${mood === choice.id ? 'border-green-400 bg-green-50 text-green-800 ring-2 ring-green-100' : 'border-gray-100 bg-gray-50 text-gray-600'}`}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-gray-700">難度：{difficulty} / 5</span>
          <input
            type="range"
            min="1"
            max="5"
            value={difficulty}
            onChange={(event) => setDifficulty(Number(event.target.value))}
            className="w-full accent-green-500"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl bg-gray-100 px-4 font-black text-gray-600">取消</button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={loading || !reflection.trim()}
            className="flex min-h-12 items-center justify-center rounded-2xl bg-green-500 px-4 font-black text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            送出
          </button>
        </div>
      </div>
    </div>
  );
}
