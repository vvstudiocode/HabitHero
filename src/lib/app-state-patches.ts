import type { AppState } from '../types';
import type { Task } from '../types';
import { emptyChildGameData } from '../features/world/contracts';
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

export function patchChild(
  previous: AppState,
  childId: string,
  update: (child: AppState['children'][number]) => AppState['children'][number],
): AppState {
  return {
    ...previous,
    children: previous.children.map((child) => child.id === childId ? update(child) : child),
  };
}

export function patchTask(previous: AppState, taskId: string, update: (task: Task) => Task): AppState {
  return {
    ...previous,
    children: previous.children.map((child) => ({
      ...child,
      tasks: child.tasks.map((task) => task.id === taskId ? update(task) : task),
    })),
  };
}

export function patchGameData(
  previous: AppState,
  childId: string,
  update: (gameData: ReturnType<typeof emptyChildGameData>) => ReturnType<typeof emptyChildGameData>,
): AppState {
  const currentGameData = previous.gameDataByChildId[childId] ?? emptyChildGameData();
  return {
    ...previous,
    gameDataByChildId: {
      ...previous.gameDataByChildId,
      [childId]: update(currentGameData),
    },
  };
}
