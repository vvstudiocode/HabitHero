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

  return {
    daily: activeTasks.filter((task) => {
      if (getAdventureType(task) !== 'daily') return false;
      return !task.occurrenceDate || task.occurrenceDate === today;
    }),
    general: activeTasks.filter((task) => {
      if (getAdventureType(task) !== 'general') return false;
      return !generalGroupId || !task.adventureGroupId || task.adventureGroupId === generalGroupId;
    }),
  };
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
