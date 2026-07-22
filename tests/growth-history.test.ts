import assert from 'node:assert/strict';
import test from 'node:test';
import { filterAndPaginateCompletedTasks, HISTORY_PAGE_SIZE } from '../src/features/growth/growth-history';
import type { GrowthTaskWithChild } from '../src/features/growth/types';

const task = (id: string, completedAt: string, category: GrowthTaskWithChild['category'] = 'life_habit') => ({
  id,
  name: id,
  category,
  completedAt,
  childId: 'child-1',
  childName: '小明',
} as GrowthTaskWithChild);

test('completed history filters by category and date range, then paginates at 30', () => {
  const tasks = Array.from({ length: 65 }, (_, index) => task(`task-${index}`, `2026-07-${String((index % 31) + 1).padStart(2, '0')}T09:00:00.000Z`));
  tasks[0].category = 'learning';

  const result = filterAndPaginateCompletedTasks(tasks, {
    category: 'learning',
    from: '2026-07-01',
    to: '2026-07-31',
    page: 1,
  });

  assert.equal(HISTORY_PAGE_SIZE, 30);
  assert.equal(result.total, 1);
  assert.equal(result.tasks[0]?.id, 'task-0');
});

test('returns the correct page and total page count', () => {
  const tasks = Array.from({ length: 65 }, (_, index) => task(`task-${index}`, `2026-07-${String((index % 31) + 1).padStart(2, '0')}T09:00:00.000Z`));
  const result = filterAndPaginateCompletedTasks(tasks, { category: 'all', from: '', to: '', page: 2 });

  assert.equal(result.total, 65);
  assert.equal(result.pageCount, 3);
  assert.equal(result.tasks.length, 30);
  assert.equal(result.tasks[0]?.id, 'task-15');
});
