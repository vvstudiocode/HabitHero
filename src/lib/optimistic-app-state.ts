import type { AppState } from '../types';
import { resolveActiveChildId } from './family-switch';

export function patchDeletedChild(state: AppState, childId: string): AppState {
  if (!state.children.some((child) => child.id === childId)) return state;
  const children = state.children.filter((child) => child.id !== childId);
  const gameDataByChildId = { ...state.gameDataByChildId };
  delete gameDataByChildId[childId];
  return {
    ...state,
    children,
    parentActiveChildId: state.parentActiveChildId === childId
      ? resolveActiveChildId(null, children)
      : state.parentActiveChildId,
    childLoggedInId: state.childLoggedInId === childId ? null : state.childLoggedInId,
    gameDataByChildId,
  };
}

export function rollbackDeletedChild(current: AppState, previous: AppState, childId: string): AppState {
  if (current.children.some((child) => child.id === childId)) return current;
  const previousChildIndex = previous.children.findIndex((child) => child.id === childId);
  const previousChild = previous.children[previousChildIndex];
  if (!previousChild) return current;
  const children = [...current.children];
  children.splice(Math.min(previousChildIndex, children.length), 0, previousChild);
  const gameDataByChildId = { ...current.gameDataByChildId };
  const previousGameData = previous.gameDataByChildId[childId];
  if (previousGameData) gameDataByChildId[childId] = previousGameData;

  const optimisticFallback = resolveActiveChildId(null, current.children);
  return {
    ...current,
    children,
    parentActiveChildId: current.parentActiveChildId === optimisticFallback
      ? previous.parentActiveChildId
      : current.parentActiveChildId,
    childLoggedInId: current.childLoggedInId === null && previous.childLoggedInId === childId
      ? childId
      : current.childLoggedInId,
    gameDataByChildId,
  };
}
