import type {
  AdventureProgress,
  AdventureTask,
  AdventureTaskVisualState,
  AdventureType,
} from './types';
import { ADVENTURE_ACTIVE_STATUSES } from './types';

export function getAdventureType(task: Pick<AdventureTask, 'adventureType' | 'isDaily'>): AdventureType {
  if (task.adventureType === 'daily' || task.adventureType === 'general') {
    return task.adventureType;
  }
  return task.isDaily ? 'daily' : 'general';
}

export function isLegacyGrowthTask(
  task: Pick<AdventureTask, 'adventureType'>,
): boolean {
  return task.adventureType !== 'daily' && task.adventureType !== 'general';
}

export function getAdventureTaskState(
  task: Pick<AdventureTask, 'status' | 'pendingSync'>,
): AdventureTaskVisualState {
  if (task.pendingSync) return 'syncing';
  switch (task.status) {
    case 'completed':
      return 'completed';
    case 'pending':
      return 'submitted';
    case 'revision_requested':
    case 'proposal_revision_requested':
      return 'revision';
    case 'proposed':
      return 'waiting';
    default:
      return 'available';
  }
}

export function getAdventureProgress(
  tasks: ReadonlyArray<Pick<AdventureTask, 'status' | 'pendingSync'>>,
): AdventureProgress {
  return {
    completed: tasks.filter(({ status, pendingSync }) => pendingSync || status === 'pending' || status === 'completed').length,
    total: tasks.length,
  };
}

export function splitAdventureTasks(
  tasks: ReadonlyArray<AdventureTask>,
  today: string,
  generalGroupId?: string | null,
): { daily: AdventureTask[]; general: AdventureTask[] } {
  const activeTasks = tasks.filter(({ status }) => ADVENTURE_ACTIVE_STATUSES.includes(status));
  const dailyTasks = tasks.filter((task) => {
    if (getAdventureType(task) !== 'daily') return false;
    return !task.occurrenceDate || task.occurrenceDate === today;
  });
  const generalTasks = activeTasks.filter((task) => {
    if (getAdventureType(task) !== 'general') return false;
    return !generalGroupId || !task.adventureGroupId || task.adventureGroupId === generalGroupId;
  });

  return {
    // A daily occurrence is today's checklist. Keep submitted/approved items
    // visible until the Taipei calendar date changes so 1/1 remains visible.
    daily: sortAdventureTasksByStartTime(dailyTasks),
    general: sortAdventureTasksByStartTime(generalTasks),
  };
}

function getTaskStartMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function sortAdventureTasksByStartTime<T>(tasks: ReadonlyArray<T>): T[] {
  return tasks
    .map((task, index) => ({
      task,
      index,
      startMinutes: getTaskStartMinutes((task as { dueTime?: string | null }).dueTime),
    }))
    .sort((left, right) => {
      if (left.startMinutes === null && right.startMinutes === null) return left.index - right.index;
      if (left.startMinutes === null) return 1;
      if (right.startMinutes === null) return -1;
      return left.startMinutes - right.startMinutes || left.index - right.index;
    })
    .map(({ task }) => task);
}

export function getTaipeiDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function getAdventureStatusLabel(state: AdventureTaskVisualState): string {
  switch (state) {
    case 'completed':
      return '已核准完成';
    case 'submitted':
      return '已送出，等待家長確認';
    case 'syncing':
      return '等待同步，點數尚未發放';
    case 'revision':
      return '需要補充';
    case 'waiting':
      return '等待家長確認';
    default:
      return '尚未完成';
  }
}

export function formatAdventureTaskWindow(
  task: Pick<AdventureTask, 'dueTime' | 'endTime'>,
): string {
  const start = task.dueTime?.slice(0, 5) ?? null;
  const end = task.endTime?.slice(0, 5) ?? null;
  if (start && end) return `${start}–${end}`;
  if (start) return `${start} 起`;
  return '隨時';
}

export function getAdventureTaskRemainingSeconds(
  task: Pick<AdventureTask, 'duration' | 'timerEndTime' | 'timerRemainingMs' | 'timerIsRunning'>,
  now: number,
): number {
  if (task.timerIsRunning && task.timerEndTime !== undefined && task.timerEndTime !== null) {
    return Math.max(0, Math.ceil((task.timerEndTime - now) / 1000));
  }
  if (task.timerRemainingMs !== undefined && task.timerRemainingMs !== null) {
    return Math.max(0, Math.ceil(task.timerRemainingMs / 1000));
  }
  return typeof task.duration === 'number' ? task.duration * 60 : 0;
}

export function hasStartedAdventureTimer(
  task: Pick<AdventureTask, 'timerIsRunning' | 'timerRemainingMs'>,
): boolean {
  return task.timerIsRunning === true
    || task.timerRemainingMs !== undefined && task.timerRemainingMs !== null;
}

function formatAdventureSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function getAdventureTaskCountdown(
  task: Pick<AdventureTask, 'duration' | 'timerEndTime' | 'timerRemainingMs' | 'timerIsRunning'>,
  now: number,
): string | null {
  if (!task.timerIsRunning) return null;
  return `剩餘 ${formatAdventureSeconds(getAdventureTaskRemainingSeconds(task, now))}`;
}

export function getAdventureTimerState(
  task: Partial<Pick<AdventureTask, 'duration' | 'requiresTimer' | 'timerIsRunning' | 'timerRemainingMs'>>,
  secondsLeft: number,
): { hasTimer: boolean; started: boolean; complete: boolean } {
  const hasTimer = task.requiresTimer === true || typeof task.duration === 'number';
  const started = hasStartedAdventureTimer(task);
  return {
    hasTimer,
    started,
    complete: !hasTimer || started && secondsLeft === 0,
  };
}

export function canToggleAdventureTimer(
  task: Pick<AdventureTask, 'duration' | 'requiresTimer' | 'timerIsRunning' | 'timerRemainingMs'>,
  secondsLeft: number,
  canExecute: boolean,
): boolean {
  const timerState = getAdventureTimerState(task, secondsLeft);
  if (task.timerIsRunning) return true;
  if (timerState.started && !timerState.complete) return true;
  return canExecute && !timerState.complete;
}
