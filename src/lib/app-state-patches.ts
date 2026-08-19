import type { AppState } from '../types';

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
