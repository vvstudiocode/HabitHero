import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getGrowthPeriodRange,
  getGrowthPeriodStats,
} from '../src/features/growth/growth-stats';
import type { GrowthTaskWithChild } from '../src/features/growth/types';

const task = (
  id: string,
  status: GrowthTaskWithChild['status'],
  overrides: Partial<GrowthTaskWithChild> = {},
) => ({
  id,
  name: id,
  points: 5,
  icon: 'Star',
  status,
  category: 'life_habit' as const,
  childId: 'child-1',
  childName: '小明',
  ...overrides,
} as GrowthTaskWithChild);

test('growth period range uses Monday as the week start and excludes future dates', () => {
  assert.deepEqual(getGrowthPeriodRange('week', '2026-08-05'), {
    period: 'week',
    startDate: '2026-08-03',
    endDate: '2026-08-09',
    throughDate: '2026-08-05',
  });
  assert.deepEqual(getGrowthPeriodRange('month', '2026-08-05'), {
    period: 'month',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    throughDate: '2026-08-05',
  });
});

test('growth stats count dated task occurrences, keep review states separate, and ignore proposals', () => {
  const stats = getGrowthPeriodStats([
    task('monday-completed', 'completed', { dueOn: '2026-08-03', category: 'life_habit' }),
    task('monday-pending', 'pending', { dueOn: '2026-08-03', category: 'health' }),
    task('tuesday-todo', 'todo', { dueOn: '2026-08-04', category: 'learning' }),
    task('tuesday-revision', 'revision_requested', { dueOn: '2026-08-04', category: 'learning' }),
    task('future-task', 'completed', { dueOn: '2026-08-06' }),
    task('not-confirmed', 'proposed', { dueOn: '2026-08-03' }),
    task('undated-todo', 'todo'),
  ], 'week', '2026-08-05');

  assert.equal(stats.plannedCount, 4);
  assert.equal(stats.completedCount, 1);
  assert.equal(stats.pendingCount, 1);
  assert.equal(stats.revisionRequestCount, 1);
  assert.equal(stats.todoCount, 1);
  assert.equal(stats.completionRate, 25);
  assert.deepEqual(stats.days.map(({ dateKey, total, completed, state }) => ({ dateKey, total, completed, state })), [
    { dateKey: '2026-08-03', total: 2, completed: 1, state: 'in_progress' },
    { dateKey: '2026-08-04', total: 2, completed: 0, state: 'in_progress' },
    { dateKey: '2026-08-05', total: 0, completed: 0, state: 'none' },
    { dateKey: '2026-08-06', total: 1, completed: 1, state: 'future' },
    { dateKey: '2026-08-07', total: 0, completed: 0, state: 'none' },
    { dateKey: '2026-08-08', total: 0, completed: 0, state: 'none' },
    { dateKey: '2026-08-09', total: 0, completed: 0, state: 'none' },
  ]);
  assert.deepEqual(stats.categories.learning, {
    category: 'learning',
    planned: 2,
    completed: 0,
    pending: 0,
    revisionRequested: 1,
    todo: 1,
  });
});

test('completed undated general tasks use their activity date, while undated unfinished tasks stay out of progress', () => {
  const stats = getGrowthPeriodStats([
    task('completed-without-due-date', 'completed', { completedAt: '2026-08-04T12:00:00.000Z' }),
    task('pending-without-due-date', 'pending', { submittedAt: '2026-08-04T12:00:00.000Z' }),
    task('todo-without-due-date', 'todo', { createdAt: '2026-08-04T12:00:00.000Z' }),
  ], 'day', '2026-08-04');

  assert.equal(stats.plannedCount, 2);
  assert.equal(stats.completedCount, 1);
  assert.equal(stats.pendingCount, 1);
  assert.equal(stats.days[0]?.total, 2);
});

test('period stats mark a day with no task as none and never present it as a failed day', () => {
  const stats = getGrowthPeriodStats([
    task('monday', 'completed', { dueOn: '2026-08-03' }),
  ], 'week', '2026-08-05');

  assert.equal(stats.days[0]?.state, 'complete');
  assert.equal(stats.days[1]?.state, 'none');
  assert.equal(stats.days[2]?.state, 'none');
});

test('future dates remain visible without affecting the current period denominator', () => {
  const stats = getGrowthPeriodStats([
    task('future', 'todo', { dueOn: '2026-08-06' }),
  ], 'week', '2026-08-05');

  assert.equal(stats.plannedCount, 0);
  assert.equal(stats.days[3]?.state, 'future');
  assert.equal(stats.days[3]?.total, 1);
});
