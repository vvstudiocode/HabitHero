import { useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import type { GoalReviewInput, GrowthTask } from '../types';

interface ParentFeedbackFormProps {
  task: GrowthTask;
  childName: string;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (input: GoalReviewInput) => Promise<void> | void;
}

export function ParentFeedbackForm({ task, childName, loading = false, onCancel, onSubmit }: ParentFeedbackFormProps) {
  const [approvedPoints, setApprovedPoints] = useState(task.approvedPoints ?? task.points);
  const [message, setMessage] = useState(task.parentFeedback ?? task.parentFeedbackText ?? '');
  const [revisionNote, setRevisionNote] = useState(task.revisionNote ?? '');

  const submit = async (approved: boolean) => {
    await onSubmit({
      approved,
      approvedPoints: approved ? Math.max(1, approvedPoints) : Math.max(0, approvedPoints),
      feedback: message.trim(),
      correction: '',
      tone: null,
      revisionNote: revisionNote.trim(),
    });
  };

  return (
    <div className="hh-review-dialog-card">
      <h3 className="hh-review-dialog-title">家長審核</h3>
      <p className="hh-review-dialog-task">{task.name}</p>
      <div className="hh-review-dialog-fields">
        <label className="hh-review-dialog-field-group">
          <span className="hh-review-dialog-label">實發點數</span>
          <input
            type="number"
            min="1"
            value={approvedPoints}
            onChange={(event) => setApprovedPoints(Number(event.target.value))}
            className="hh-review-dialog-input"
          />
        </label>
        <label className="hh-review-dialog-field-group">
          <span className="hh-review-dialog-label">對{childName}說</span>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} className="hh-review-dialog-input hh-review-dialog-textarea" placeholder={`想對${childName}說的話`} />
        </label>
        <label className="hh-review-dialog-field-group">
          <span className="hh-review-dialog-label">請{childName}補充</span>
          <textarea value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} rows={2} className="hh-review-dialog-input hh-review-dialog-textarea" placeholder={`需要${childName}補充時填寫`} />
        </label>
        <div className="hh-review-dialog-actions">
          <button type="button" onClick={onCancel} className="hh-review-dialog-action hh-review-dialog-cancel">取消</button>
          <button
            type="button"
            data-analytics-id="parent-review-request"
            onClick={() => void submit(false)}
            disabled={loading || !revisionNote.trim()}
            className="hh-review-dialog-action hh-review-dialog-request"
          >
            <RotateCcw size={18} /> 請補充
          </button>
          <button
            type="button"
            data-analytics-id="parent-review-approve"
            onClick={() => void submit(true)}
            disabled={loading || approvedPoints < 1}
            className="hh-review-dialog-action hh-review-dialog-approve"
          >
            <CheckCircle2 size={18} /> 通過
          </button>
        </div>
      </div>
    </div>
  );
}
