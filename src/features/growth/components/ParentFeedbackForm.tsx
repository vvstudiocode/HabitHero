import { useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { FEEDBACK_TONE_CHOICES } from '../constants';
import type { FeedbackTone, GoalReviewInput, GrowthTask } from '../types';

interface ParentFeedbackFormProps {
  task: GrowthTask;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (input: GoalReviewInput) => Promise<void> | void;
}

export function ParentFeedbackForm({ task, loading = false, onCancel, onSubmit }: ParentFeedbackFormProps) {
  const [approvedPoints, setApprovedPoints] = useState(task.approvedPoints ?? task.points);
  const [feedback, setFeedback] = useState(task.parentFeedback ?? task.parentFeedbackText ?? '');
  const [correction, setCorrection] = useState(task.parentCorrection ?? task.parentCorrectionText ?? '');
  const [revisionNote, setRevisionNote] = useState(task.revisionNote ?? '');
  const [tone, setTone] = useState<FeedbackTone>((task.feedbackTone as FeedbackTone) || 'encouraging');

  const submit = async (approved: boolean) => {
    await onSubmit({
      approved,
      approvedPoints: approved ? Math.max(1, approvedPoints) : Math.max(0, approvedPoints),
      feedback: feedback.trim(),
      correction: correction.trim(),
      tone,
      revisionNote: revisionNote.trim(),
    });
  };

  return (
    <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-xl">
      <h3 className="text-xl font-black text-gray-900">家長審核</h3>
      <p className="mt-1 text-sm font-bold text-blue-700">{task.name}</p>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-gray-700">實發點數</span>
          <input
            type="number"
            min="1"
            value={approvedPoints}
            onChange={(event) => setApprovedPoints(Number(event.target.value))}
            className="min-h-12 w-full rounded-2xl border border-gray-200 p-3 text-base outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
        <div>
          <span className="mb-2 block text-sm font-bold text-gray-700">回饋語氣</span>
          <div className="grid grid-cols-2 gap-2">
            {FEEDBACK_TONE_CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => setTone(choice.id)}
                className={`min-h-11 rounded-2xl border px-3 text-sm font-bold transition-colors ${tone === choice.id ? 'border-blue-400 bg-blue-50 text-blue-800 ring-2 ring-blue-100' : 'border-gray-100 bg-gray-50 text-gray-600'}`}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-gray-700">鼓勵留言</span>
          <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={3} className="w-full rounded-2xl border border-gray-200 p-3 leading-6 outline-none focus:ring-2 focus:ring-blue-400" placeholder="讓孩子知道你看見了哪一個努力" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-gray-700">批改或下次建議</span>
          <textarea value={correction} onChange={(event) => setCorrection(event.target.value)} rows={3} className="w-full rounded-2xl border border-gray-200 p-3 leading-6 outline-none focus:ring-2 focus:ring-blue-400" placeholder="可選填，指出可再補充或下次調整的地方" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-gray-700">要求補充時的留言</span>
          <textarea value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} rows={2} className="w-full rounded-2xl border border-gray-200 p-3 leading-6 outline-none focus:ring-2 focus:ring-orange-400" placeholder="例如：請再寫清楚你怎麼完成的" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl bg-gray-100 px-4 font-black text-gray-600">取消</button>
          <button
            type="button"
            onClick={() => void submit(false)}
            disabled={loading || !revisionNote.trim()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 font-black text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw size={18} /> 請補充
          </button>
          <button
            type="button"
            onClick={() => void submit(true)}
            disabled={loading || approvedPoints < 1}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 font-black text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 size={18} /> 通過
          </button>
        </div>
      </div>
    </div>
  );
}
