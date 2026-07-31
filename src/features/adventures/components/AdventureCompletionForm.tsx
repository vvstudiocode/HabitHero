import { useMemo, useState } from 'react';
import {
  createAdventureIdempotencyKey,
  getCompletionValidationError,
  normalizeCompletionReportMode,
} from '../adventure-completion';
import { getAdventureType } from '../adventure-progress';
import type {
  AdventureCompletionInput,
  AdventureTask,
  QuickAdventureReport,
} from '../types';

interface AdventureCompletionFormProps {
  key?: string;
  task: AdventureTask;
  loading?: boolean;
  onSubmit: (input: AdventureCompletionInput) => Promise<void>;
}

const quickChoices: Array<{ value: QuickAdventureReport; label: string }> = [
  { value: 'smooth', label: '很順利' },
  { value: 'hard', label: '有點難' },
  { value: 'help', label: '我需要幫忙' },
];

const moodChoices = [
  { value: 'happy', label: '很開心' },
  { value: 'proud', label: '很有成就' },
  { value: 'tired', label: '有點累' },
  { value: 'frustrated', label: '有點挫折' },
];

const difficultyChoices = [
  { value: 1, label: '很輕鬆' },
  { value: 3, label: '剛剛好' },
  { value: 5, label: '有挑戰' },
];

export function AdventureCompletionForm({
  task,
  loading = false,
  onSubmit,
}: AdventureCompletionFormProps) {
  const adventureType = getAdventureType(task);
  const completionReportMode = normalizeCompletionReportMode(adventureType, task.completionReportMode);
  const idempotencyKey = useMemo(() => createAdventureIdempotencyKey(task.id), [task.id]);
  const [quickReport, setQuickReport] = useState<QuickAdventureReport>();
  const [reflection, setReflection] = useState('');
  const [mood, setMood] = useState('');
  const [difficulty, setDifficulty] = useState<number>();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isBusy = loading || submitting;

  const submit = async () => {
    const input: AdventureCompletionInput = {
      idempotencyKey,
      quickReport,
      reflection: reflection.trim() || undefined,
      mood: mood || undefined,
      difficulty,
    };
    const validationError = getCompletionValidationError(adventureType, completionReportMode, input);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(input);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '送出失敗，請再試一次。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hh-adventure-completion">
      {completionReportMode === 'quick' && (
        <fieldset className="hh-adventure-choice-group">
          <legend>這次冒險怎麼樣？</legend>
          <div className="hh-adventure-choice-grid">
            {quickChoices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                className={`hh-adventure-button${quickReport === choice.value ? ' is-selected' : ''}`}
                aria-pressed={quickReport === choice.value}
                disabled={isBusy}
                onClick={() => setQuickReport(choice.value)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {completionReportMode === 'reflection' && (
        <>
          <fieldset className="hh-adventure-choice-group">
            <legend>現在的心情</legend>
            <div className="hh-adventure-choice-grid">
              {moodChoices.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  className={`hh-adventure-button${mood === choice.value ? ' is-selected' : ''}`}
                  aria-pressed={mood === choice.value}
                  disabled={isBusy}
                  onClick={() => setMood(choice.value)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="hh-adventure-choice-group">
            <legend>這次的難度</legend>
            <div className="hh-adventure-choice-grid">
              {difficultyChoices.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  className={`hh-adventure-button${difficulty === choice.value ? ' is-selected' : ''}`}
                  aria-pressed={difficulty === choice.value}
                  disabled={isBusy}
                  onClick={() => setDifficulty(choice.value)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="hh-adventure-reflection">
            <span>我想告訴爸媽</span>
            <textarea
              value={reflection}
              disabled={isBusy}
              maxLength={500}
              rows={4}
              onChange={(event) => setReflection(event.target.value)}
            />
          </label>
        </>
      )}

      {error && <p className="hh-adventure-form-error" role="alert">{error}</p>}
      <div className="hh-adventure-completion-actions">
        <button
          type="button"
          className="hh-adventure-button hh-adventure-complete-button"
          disabled={isBusy}
          onClick={() => void submit()}
        >
          {isBusy ? '送出中…' : completionReportMode === 'none' ? '我完成了' : '送出完成'}
        </button>
      </div>
    </div>
  );
}
