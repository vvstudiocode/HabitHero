import type { AppState } from '../types';
import { applyTimerSnapshot, type TimerSnapshot } from './task-timer';

export function replaceOptimisticTaskId(
  state: AppState,
  childId: string,
  localId: string,
  taskId: string,
): AppState {
  if (!taskId) return state;
  return {
    ...state,
    children: state.children.map((child) => child.id !== childId ? child : {
      ...child,
      tasks: child.tasks.map((task) => task.id === localId ? { ...task, id: taskId } : task),
    }),
  };
}

export function mergeTimerSnapshots(appState: AppState, snapshots: TimerSnapshot[]) {
  const byTaskId = new Map(snapshots.map((snapshot) => [snapshot.taskId, snapshot]));
  return {
    ...appState,
    children: appState.children.map((child) => ({
      ...child,
      tasks: child.tasks.map((task) => {
        const snapshot = byTaskId.get(task.id);
        return snapshot && snapshot.childId === child.id ? applyTimerSnapshot(task, snapshot) : task;
      }),
    })),
  };
}
