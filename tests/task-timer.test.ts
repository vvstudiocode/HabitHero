import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTimerSnapshot, getTaskTimerRemainingMs, toTimerSnapshot } from '../src/lib/task-timer';
import { mergeTimerSnapshots } from '../src/store';
import type { AppState } from '../src/types';

test('running timers calculate remaining time from their end time', () => {
  assert.equal(getTaskTimerRemainingMs({ duration: 10, timerIsRunning: true, timerEndTime: 13000, timerRemainingMs: null }, 10000), 3000);
});

test('paused timers keep their remaining duration', () => {
  assert.equal(getTaskTimerRemainingMs({ duration: 10, timerIsRunning: false, timerEndTime: null, timerRemainingMs: 4200 }, 10000), 4200);
});

test('timer snapshots can restore a task after a view remount', () => {
  const snapshot = toTimerSnapshot('child-1', { id: 'task-1', timerIsRunning: true, timerEndTime: 20000, timerRemainingMs: null });
  assert.deepEqual(applyTimerSnapshot({ id: 'task-1', name: 'Read', points: 1, status: 'todo', icon: 'BookOpen' }, snapshot), {
    id: 'task-1', name: 'Read', points: 1, status: 'todo', icon: 'BookOpen',
    timerIsRunning: true, timerEndTime: 20000, timerRemainingMs: null,
  });
});

test('timer snapshots merge only into the matching child task', () => {
  const matchingTask = { id: 'task-1', name: 'Read', points: 1, status: 'todo', icon: 'BookOpen', timerIsRunning: false, timerEndTime: null, timerRemainingMs: 10_000 };
  const sameTaskIdOtherChild = { id: 'task-1', name: 'Write', points: 1, status: 'todo', icon: 'Pencil', timerIsRunning: false, timerEndTime: null, timerRemainingMs: 5_000 };
  const state = {
    children: [
      { id: 'child-1', tasks: [matchingTask] },
      { id: 'child-2', tasks: [sameTaskIdOtherChild] },
    ],
  } as unknown as AppState;

  const merged = mergeTimerSnapshots(state, [{
    childId: 'child-1',
    taskId: 'task-1',
    timerIsRunning: true,
    timerEndTime: 20_000,
    timerRemainingMs: null,
  }]);

  assert.deepEqual(merged.children[0].tasks[0], {
    ...matchingTask,
    timerIsRunning: true,
    timerEndTime: 20_000,
    timerRemainingMs: null,
  });
  assert.equal(merged.children[1].tasks[0], sameTaskIdOtherChild);
});

test('later timer snapshots win when the same task appears more than once', () => {
  const task = { id: 'task-1', name: 'Read', points: 1, status: 'todo', icon: 'BookOpen', timerIsRunning: false, timerEndTime: null, timerRemainingMs: 10_000 };
  const state = {
    children: [{ id: 'child-1', tasks: [task] }],
  } as unknown as AppState;

  const merged = mergeTimerSnapshots(state, [
    { childId: 'child-1', taskId: 'task-1', timerIsRunning: true, timerEndTime: 20_000, timerRemainingMs: null },
    { childId: 'child-1', taskId: 'task-1', timerIsRunning: false, timerEndTime: null, timerRemainingMs: 7_500 },
  ]);

  assert.equal(merged.children[0].tasks[0].timerIsRunning, false);
  assert.equal(merged.children[0].tasks[0].timerEndTime, null);
  assert.equal(merged.children[0].tasks[0].timerRemainingMs, 7_500);
});
