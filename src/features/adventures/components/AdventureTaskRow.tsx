import { AlertCircle, CheckCircle2, Circle, Clock3, CloudUpload } from 'lucide-react';
import { getAdventureStatusLabel, getAdventureTaskState } from '../adventure-progress';
import type { AdventureTask } from '../types';

interface AdventureTaskRowProps {
  key?: string;
  task: AdventureTask;
  tabIndex?: number;
  onSelect: (task: AdventureTask) => void;
}

export function AdventureTaskRow({ task, tabIndex, onSelect }: AdventureTaskRowProps) {
  const state = getAdventureTaskState(task);
  const statusLabel = getAdventureStatusLabel(state);
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
        aria-label={`${task.name}，${statusLabel}`}
        title={task.name}
        tabIndex={tabIndex}
        onClick={() => onSelect(task)}
      >
        <Icon className="hh-adventure-task-state" size={20} aria-hidden="true" />
        <span>{task.name}</span>
      </button>
    </li>
  );
}
