import type { Task } from '../types';

export interface TimerSnapshot {
  childId: string;
  taskId: string;
  timerIsRunning: boolean;
  timerEndTime: number | null;
  timerRemainingMs: number | null;
}

export function getTaskTimerRemainingMs(task: Pick<Task, 'duration' | 'timerEndTime' | 'timerRemainingMs' | 'timerIsRunning'>, now = Date.now()) {
  if (task.timerIsRunning && task.timerEndTime) {
    return Math.max(0, task.timerEndTime - now);
  }
  return Math.max(0, task.timerRemainingMs ?? (task.duration ?? 0) * 60 * 1000);
}

export function toTimerSnapshot(childId: string, task: Pick<Task, 'id' | 'timerIsRunning' | 'timerEndTime' | 'timerRemainingMs'>): TimerSnapshot {
  return {
    childId,
    taskId: task.id,
    timerIsRunning: Boolean(task.timerIsRunning),
    timerEndTime: task.timerEndTime ?? null,
    timerRemainingMs: task.timerRemainingMs ?? null,
  };
}

export function applyTimerSnapshot<T extends Pick<Task, 'id' | 'timerIsRunning' | 'timerEndTime' | 'timerRemainingMs'>>(task: T, snapshot: TimerSnapshot): T {
  return {
    ...task,
    timerIsRunning: snapshot.timerIsRunning,
    timerEndTime: snapshot.timerEndTime,
    timerRemainingMs: snapshot.timerRemainingMs,
  };
}
