import { AlertCircle, CheckCircle2, Circle, Clock3, CloudUpload } from 'lucide-react';
import { getAdventureStatusLabel, getAdventureTaskCountdown, getAdventureTaskState } from '../adventure-progress';
import type { AdventureTask } from '../types';

interface AdventureTaskRowProps {
  key?: string;
  task: AdventureTask;
  now: number;
  tabIndex?: number;
  onSelect: (task: AdventureTask) => void;
}

export function AdventureTaskRow({ task, now, tabIndex, onSelect }: AdventureTaskRowProps) {
  const state = getAdventureTaskState(task);
  const statusLabel = getAdventureStatusLabel(state);
  const countdown = getAdventureTaskCountdown(task, now);
  const accessibleStatus = countdown ? `${statusLabel}，${countdown}` : statusLabel;
  const Icon = state === 'completed' || state === 'submitted'
    ? CheckCircle2
    : state === 'syncing'
      ? CloudUpload
    : state === 'revision'
      ? AlertCircle
      : state === 'waiting'
        ? Clock3
        : Circle;

  return (
    <li className="hh-adventure-task-item">
      <button
        type="button"
        className={`hh-adventure-button hh-adventure-task-control hh-adventure-task-row is-${state}`}
        aria-label={`${task.name}，${accessibleStatus}`}
        title={task.name}
        tabIndex={tabIndex}
        onClick={() => onSelect(task)}
      >
        <Icon className="hh-adventure-task-state" size={20} aria-hidden="true" />
        <span className="hh-adventure-task-copy">
          <span className="hh-adventure-task-name">{task.name}</span>
          {countdown && <small className="hh-adventure-task-countdown">{countdown}</small>}
        </span>
      </button>
    </li>
  );
}
