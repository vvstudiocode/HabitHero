import { applyServerTimerSession } from './data-contracts';
import type { AppState, Child, TaskTimerSession } from '../types';

export const createEmptyAppState = (): AppState => ({
  parentPin: null,
  parentConsentVersion: null,
  children: [],
  parentActiveChildId: null,
  childLoggedInId: null,
  taskTemplates: [],
  ledger: [],
  lastResetDate: null,
  familyTheme: { accentColor: 'amber', mobileBackgroundImageUrl: null, desktopBackgroundImageUrl: null },
  adventureGroups: [],
  taskSchedules: [],
  timerSessions: [],
  gameDataByChildId: {},
});

export function applyTimerSessionsToChildren(
  children: Child[],
  timerSessions: TaskTimerSession[],
): Child[] {
  const timerByTaskId = new Map(timerSessions.map((session) => [session.taskId, session]));
  return children.map((child) => ({
    ...child,
    tasks: child.tasks.map((task) => {
      const timer = timerByTaskId.get(task.id);
      return timer ? applyServerTimerSession(task, timer) : task;
    }),
  }));
}
