import type { AdventureTask } from './types';
import { getAdventureType, getTaipeiDateKey, sortAdventureTasksByStartTime } from './adventure-progress';

export interface AdventureDateGroup {
  dateKey: string;
  tasks: AdventureTask[];
}

export interface TodayAdventureSummary {
  daily: AdventureTask[];
  generalActive: AdventureTask[];
  generalHistoryByDate: AdventureDateGroup[];
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

export function getAdventureHistoryDate(task: Pick<AdventureTask, 'status' | 'completedAt' | 'cancelledAt' | 'reviewedAt' | 'submittedAt' | 'updatedAt' | 'occurrenceDate'>, fallbackDate: string): string {
  const timestamp = task.status === 'cancelled'
    ? task.cancelledAt ?? task.updatedAt
    : task.completedAt ?? task.reviewedAt ?? task.submittedAt ?? task.updatedAt;
  if (timestamp && isValidDate(timestamp)) return getTaipeiDateKey(new Date(timestamp));
  return task.occurrenceDate || fallbackDate;
}

export function getTodayAdventureSummary(
  tasks: ReadonlyArray<AdventureTask>,
  today: string,
): TodayAdventureSummary {
  const daily: AdventureTask[] = [];
  const generalActive: AdventureTask[] = [];
  const completedByDate = new Map<string, AdventureTask[]>();

  for (const task of tasks) {
    const type = getAdventureType(task);
    if (type === 'daily') {
      if (!task.occurrenceDate || task.occurrenceDate === today) daily.push(task);
      continue;
    }

    if (task.status === 'completed' || task.status === 'cancelled') {
      const dateKey = getAdventureHistoryDate(task, today);
      const group = completedByDate.get(dateKey) ?? [];
      group.push(task);
      completedByDate.set(dateKey, group);
    } else {
      generalActive.push(task);
    }
  }

  return {
    daily: sortAdventureTasksByStartTime(daily),
    generalActive: sortAdventureTasksByStartTime(generalActive),
    generalHistoryByDate: [...completedByDate.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([dateKey, groupedTasks]) => ({ dateKey, tasks: sortAdventureTasksByStartTime(groupedTasks) })),
  };
}
