import assert from 'node:assert/strict';
import test from 'node:test';
import type { GrowthTask } from '../src/features/growth/types';
import { selectChildAdventureState } from '../src/lib/child-dashboard-adventure-state';

const task = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: id,
  points: 5,
  icon: 'Star',
  status: 'todo' as const,
  isDaily: false,
  adventureType: 'general' as const,
  duration: null,
  requiresTimer: false,
  timerIsRunning: false,
  timerRemainingMs: null,
  ...overrides,
}) as unknown as GrowthTask;

test('selects current child adventures and Taipei summary from dashboard tasks', () => {
  const state = selectChildAdventureState([
    task('legacy', { adventureType: undefined }),
    task('daily', { adventureType: 'daily', isDaily: true, occurrenceDate: '2026-08-20' }),
    task('general'),
  ], Date.UTC(2026, 7, 20, 0, 0, 0));

  assert.equal(state.adventureDate, '2026-08-20');
  assert.deepEqual(state.adventureTasks.map(({ id }) => id), ['daily', 'general']);
  assert.deepEqual(state.todayAdventureSummary.daily.map(({ id }) => id), ['daily']);
  assert.deepEqual(state.todayAdventureSummary.generalActive.map(({ id }) => id), ['general']);
});
