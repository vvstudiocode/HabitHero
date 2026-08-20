import assert from 'node:assert/strict';
import test from 'node:test';
import { toParentCalendarTaskGroup } from '../src/components/parent-dashboard/parent-dashboard-selectors';
import type { ParentCalendarAdventureTask } from '../src/features/adventures/components/ParentAdventureCalendar';

const calendarTask = (overrides: Partial<ParentCalendarAdventureTask> = {}): ParentCalendarAdventureTask => ({
  id: 'task-1',
  childId: 'child-1',
  childName: '小宣',
  name: '整理書包',
  occurrenceDate: '2026-08-20',
  adventureType: 'general',
  status: 'todo',
  ...overrides,
});

test('maps calendar task fields and default values to a grouped task', () => {
  const group = toParentCalendarTaskGroup(calendarTask({ points: undefined, duration: null }), 'life_habit');

  assert.deepEqual(group, {
    id: 'task-1',
    name: '整理書包',
    points: 0,
    duration: undefined,
    dueTime: undefined,
    endTime: undefined,
    category: 'life_habit',
    isDaily: false,
    requiresReviewBeforeNextTask: undefined,
    children: [{ childId: 'child-1', childName: '小宣', taskId: 'task-1', taskIds: ['task-1'] }],
  });
});

test('preserves explicit category, duration, time window, review flag, and daily state', () => {
  const group = toParentCalendarTaskGroup(calendarTask({
    points: 8,
    duration: 15,
    dueTime: '09:30:00',
    endTime: '10:00:00',
    category: 'learning',
    adventureType: 'daily',
    isDaily: false,
    requiresReviewBeforeNextTask: true,
  }), 'life_habit');

  assert.deepEqual(group, {
    id: 'task-1',
    name: '整理書包',
    points: 8,
    duration: 15,
    dueTime: '09:30:00',
    endTime: '10:00:00',
    category: 'learning',
    isDaily: false,
    requiresReviewBeforeNextTask: true,
    children: [{ childId: 'child-1', childName: '小宣', taskId: 'task-1', taskIds: ['task-1'] }],
  });
});

test('derives daily state from adventure type only when isDaily is absent', () => {
  assert.equal(toParentCalendarTaskGroup(calendarTask({ adventureType: 'daily' }), 'life_habit').isDaily, true);
  assert.equal(toParentCalendarTaskGroup(calendarTask({ adventureType: 'general' }), 'life_habit').isDaily, false);
});
