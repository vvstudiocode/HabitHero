import type { GrowthTaskWithChild, TaskCategory } from './types';

export const HISTORY_PAGE_SIZE = 30;

export interface CompletedHistoryFilters {
  category: TaskCategory | 'all';
  from: string;
  to: string;
  page: number;
}

export function filterAndPaginateCompletedTasks(
  tasks: GrowthTaskWithChild[],
  filters: CompletedHistoryFilters,
) {
  const filtered = [...tasks]
    .filter((task) => filters.category === 'all' || task.category === filters.category)
    .filter((task) => {
      const value = task.completedAt ?? task.updatedAt ?? task.createdAt;
      if (!value) return false;
      const date = value.slice(0, 10);
      return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.completedAt ?? a.updatedAt ?? a.createdAt ?? '');
      const bTime = Date.parse(b.completedAt ?? b.updatedAt ?? b.createdAt ?? '');
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });

  const pageCount = Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const start = (page - 1) * HISTORY_PAGE_SIZE;

  return {
    tasks: filtered.slice(start, start + HISTORY_PAGE_SIZE),
    total: filtered.length,
    page,
    pageCount,
  };
}
