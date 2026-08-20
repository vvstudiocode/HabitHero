import type { AppState } from '../types';

export function startTaskTimerInState(previous: AppState, childId: string, taskId: string, now: number): AppState {
  return {
    ...previous,
    children: previous.children.map((child) => child.id !== childId ? child : {
      ...child,
      tasks: child.tasks.map((task) => {
        if (task.id === taskId) {
          const remaining = task.timerRemainingMs ?? (task.duration ?? 0) * 60 * 1000;
          return { ...task, timerIsRunning: true, timerEndTime: now + remaining, timerRemainingMs: null };
        }
        if (task.timerIsRunning) {
          const remaining = task.timerEndTime ? Math.max(0, task.timerEndTime - now) : 0;
          return { ...task, timerIsRunning: false, timerEndTime: null, timerRemainingMs: remaining };
        }
        return task;
      }),
    }),
  };
}

export function pauseTaskTimerInState(previous: AppState, childId: string, taskId: string, now: number): AppState {
  return {
    ...previous,
    children: previous.children.map((child) => child.id !== childId ? child : {
      ...child,
      tasks: child.tasks.map((task) => task.id !== taskId || !task.timerIsRunning ? task : {
        ...task,
        timerIsRunning: false,
        timerEndTime: null,
        timerRemainingMs: task.timerEndTime ? Math.max(0, task.timerEndTime - now) : 0,
      }),
    }),
  };
}
