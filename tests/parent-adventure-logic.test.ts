import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAdventureMonth,
  getBatchReviewableIds,
  getTasksForDate,
} from '../src/features/adventures/components/ParentAdventureCalendar';
import {
  validateAdventureSchedule,
  type ParentAdventureScheduleInput,
} from '../src/features/adventures/components/ParentAdventureScheduleForm';
import {
  validateGeneralAdventure,
  validateGeneralAdventureTitle,
  type ParentGeneralAdventureInput,
} from '../src/features/adventures/components/ParentGeneralAdventureForm';

test('calendar always renders six complete weeks and marks the selected date', () => {
  const days = buildAdventureMonth(2026, 7, '2026-08-12', '2026-08-03');

  assert.equal(days.length, 42);
  assert.equal(days[0]?.dateKey, '2026-07-27');
  assert.equal(days[41]?.dateKey, '2026-09-06');
  assert.equal(days.find(day => day.dateKey === '2026-08-12')?.isToday, true);
  assert.equal(days.find(day => day.dateKey === '2026-08-03')?.isSelected, true);
});

test('calendar date details only include tasks belonging to that occurrence date', () => {
  const tasks = [
    { id: 'daily-late', childId: 'c1', childName: '小宇', name: '晚間任務', occurrenceDate: '2026-08-03', adventureType: 'daily' as const, status: 'pending' as const, dueTime: '20:00' },
    { id: 'daily-early', childId: 'c1', childName: '小宇', name: '早晨任務', occurrenceDate: '2026-08-03', adventureType: 'daily' as const, status: 'pending' as const, dueTime: '08:00' },
    { id: 'daily-anytime', childId: 'c1', childName: '小宇', name: '彈性任務', occurrenceDate: '2026-08-03', adventureType: 'daily' as const, status: 'pending' as const, dueTime: null },
    { id: 'general-1', childId: 'c1', childName: '小宇', name: '看英文', occurrenceDate: '2026-08-04', adventureType: 'general' as const, status: 'todo' as const },
  ];

  assert.deepEqual(getTasksForDate(tasks, '2026-08-03').map(task => task.id), ['daily-early', 'daily-late', 'daily-anytime']);
});

test('batch review accepts only pending daily adventures', () => {
  const tasks = [
    { id: 'daily-pending', childId: 'c1', childName: '小宇', name: '刷牙', occurrenceDate: '2026-08-03', adventureType: 'daily' as const, status: 'pending' as const },
    { id: 'general-pending', childId: 'c1', childName: '小宇', name: '作業', occurrenceDate: '2026-08-03', adventureType: 'general' as const, status: 'pending' as const },
    { id: 'daily-todo', childId: 'c1', childName: '小宇', name: '運動', occurrenceDate: '2026-08-03', adventureType: 'daily' as const, status: 'todo' as const },
  ];

  assert.deepEqual(getBatchReviewableIds(tasks), ['daily-pending']);
});

test('daily schedule requires a child, weekday, valid time range and timer duration', () => {
  const valid: ParentAdventureScheduleInput = {
    name: '刷牙',
    description: '',
    childIds: ['c1'],
    category: 'life_habit',
    weekdays: [1, 2, 3, 4, 5],
    startTime: '07:00',
    endTime: '08:00',
    requiresTimer: true,
    durationMinutes: 2,
    requiresReview: true,
    points: 5,
  };

  assert.equal(validateAdventureSchedule(valid), null);
  assert.match(validateAdventureSchedule({ ...valid, weekdays: [] }) ?? '', /重複日期/);
  assert.match(validateAdventureSchedule({ ...valid, endTime: '06:00' }) ?? '', /結束時間/);
  assert.match(validateAdventureSchedule({ ...valid, durationMinutes: 0 }) ?? '', /計時分鐘/);
});

test('general adventure can never use none reporting and validates its group title', () => {
  const valid: ParentGeneralAdventureInput = {
    name: '完成英文作業',
    description: '',
    childIds: ['c1'],
    category: 'learning',
    dueOn: '2026-08-03',
    startTime: '19:00',
    endTime: '20:30',
    reportMode: 'quick',
    requiresTimer: false,
    durationMinutes: null,
    points: 10,
  };

  assert.equal(validateGeneralAdventure(valid), null);
  assert.match(validateGeneralAdventure({ ...valid, reportMode: 'none' as never }) ?? '', /回報/);
  assert.equal(validateGeneralAdventureTitle(' 星球挑戰 '), null);
  assert.match(validateGeneralAdventureTitle('每日冒險') ?? '', /每日冒險/);
  assert.match(validateGeneralAdventureTitle('★★★') ?? '', /文字或數字/);
});
