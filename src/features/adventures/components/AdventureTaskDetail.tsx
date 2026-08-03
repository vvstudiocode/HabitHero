import { CheckCircle2, Clock3, Pause, Play, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getAdventureStatusLabel, getAdventureTaskState, getAdventureType } from '../adventure-progress';
import type { AdventureCompletionInput, AdventureTask } from '../types';
import { AdventureCompletionForm } from './AdventureCompletionForm';
import { PointValue } from '../../../components/shared/PointValue';

interface AdventureTaskDetailProps {
  task: AdventureTask;
  now: number;
  canExecute: boolean;
  blockedReason?: string | null;
  loading?: boolean;
  onTimerToggle: (task: AdventureTask) => void;
  onComplete: (task: AdventureTask, input: AdventureCompletionInput) => Promise<void>;
  onRequestClose: () => void;
}

function getRemainingSeconds(task: AdventureTask, now: number): number {
  if (task.timerIsRunning && task.timerEndTime) {
    return Math.max(0, Math.ceil((task.timerEndTime - now) / 1000));
  }
  if (task.timerRemainingMs !== undefined && task.timerRemainingMs !== null) {
    return Math.max(0, Math.ceil(task.timerRemainingMs / 1000));
  }
  return typeof task.duration === 'number' ? task.duration * 60 : 0;
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function AdventureTaskDetail({
  task,
  now,
  canExecute,
  blockedReason,
  loading = false,
  onTimerToggle,
  onComplete,
  onRequestClose,
}: AdventureTaskDetailProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [closing, setClosing] = useState(false);
  const visualState = getAdventureTaskState(task);
  const readOnly = visualState === 'syncing' || visualState === 'submitted' || visualState === 'completed' || visualState === 'waiting';
  const hasTimer = task.requiresTimer ?? typeof task.duration === 'number';
  const secondsLeft = getRemainingSeconds(task, now);
  const timerComplete = !hasTimer || secondsLeft === 0;
  const canSubmit = !readOnly && canExecute && timerComplete;
  const dueTime = task.dueTime?.slice(0, 5);
  const endTime = task.endTime?.slice(0, 5);
  const requestClose = () => setClosing(true);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusableNodes = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      const focusable: HTMLElement[] = focusableNodes ? Array.from(focusableNodes) : [];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      className={`hh-adventure-detail-overlay${closing ? ' is-leaving' : ''}`}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === 'opacity' && closing) {
          onRequestClose();
        }
      }}
    >
      <button type="button" className="hh-adventure-button hh-adventure-detail-backdrop" aria-label="關閉冒險詳情" onClick={requestClose} />
      <section
        ref={dialogRef}
        className="hh-adventure-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hh-adventure-detail-title"
      >
        <header className="hh-adventure-detail-header">
          <div>
            <p>{getAdventureType(task) === 'daily' ? '每日冒險' : '一般冒險'}</p>
            <h2 id="hh-adventure-detail-title">{task.name}</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="hh-adventure-button hh-adventure-detail-close" aria-label="關閉冒險詳情" onClick={requestClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {task.description && <p className="hh-adventure-detail-description">{task.description}</p>}
        <dl className="hh-adventure-detail-meta">
          <div>
            <dt>時間</dt>
            <dd>{dueTime ?? '隨時'}{endTime ? `–${endTime}` : ''}</dd>
          </div>
          <div>
            <dt>點數</dt>
            <dd><PointValue value={task.points} /></dd>
          </div>
        </dl>

        {task.revisionNote && (
          <p className="hh-adventure-detail-notice" role="status">
            家長請你補充：{task.revisionNote}
          </p>
        )}

        {hasTimer && !readOnly && (
          <div className="hh-adventure-timer">
            <Clock3 size={20} aria-hidden="true" />
            <strong>{formatSeconds(secondsLeft)}</strong>
            <button
              type="button"
              className="hh-adventure-button"
              disabled={!canExecute || timerComplete}
              onClick={() => onTimerToggle(task)}
            >
              {task.timerIsRunning ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
              {task.timerIsRunning ? '暫停' : timerComplete ? '計時完成' : '開始計時'}
            </button>
          </div>
        )}

        {readOnly ? (
          <div className={`hh-adventure-readonly-state is-${visualState}`}>
            <CheckCircle2 size={22} aria-hidden="true" />
            <p>{getAdventureStatusLabel(visualState)}</p>
          </div>
        ) : canSubmit ? (
          <AdventureCompletionForm
            key={`${task.id}-${task.status}`}
            task={task}
            loading={loading}
            onSubmit={async (input) => {
              await onComplete(task, input);
              requestClose();
            }}
          />
        ) : (
          <p className="hh-adventure-detail-notice" role="status">
            {blockedReason ?? (timerComplete ? '目前還不能完成這個冒險。' : '完成計時後，才可以送出冒險。')}
          </p>
        )}
      </section>
    </div>
  );
}
