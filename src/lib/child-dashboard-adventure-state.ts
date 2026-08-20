import type { AdventureTask } from '../features/adventures/types';
import { getTaipeiDateKey, isLegacyGrowthTask } from '../features/adventures/adventure-progress';
import { getTodayAdventureSummary, type TodayAdventureSummary } from '../features/adventures/today-adventure-summary';
import type { GrowthTask } from '../features/growth/types';

export interface ChildDashboardAdventureState {
  adventureTasks: AdventureTask[];
  adventureDate: string;
  todayAdventureSummary: TodayAdventureSummary;
}

export function selectChildAdventureState(tasks: readonly GrowthTask[], now: number): ChildDashboardAdventureState {
  const adventureTasks = tasks.filter((task) => !isLegacyGrowthTask(task)) as AdventureTask[];
  const adventureDate = getTaipeiDateKey(new Date(now));
  return {
    adventureTasks,
    adventureDate,
    todayAdventureSummary: getTodayAdventureSummary(adventureTasks, adventureDate),
  };
}
