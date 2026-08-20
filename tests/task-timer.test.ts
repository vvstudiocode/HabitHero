import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTimerSnapshot, getTaskTimerRemainingMs, toTimerSnapshot } from '../src/lib/task-timer';
import { pauseTaskTimerInState, startTaskTimerInState } from '../src/lib/task-timer-state';
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

function timerStateFixture(overrides: Partial<AppState> = {}): AppState {
  return {
    children: [
      {
        id: 'child-1',
        tasks: [
          { id: 'task-1', name: 'Read', points: 1, status: 'todo', icon: 'BookOpen', duration: 10, timerIsRunning: false, timerEndTime: null, timerRemainingMs: null },
          { id: 'task-2', name: 'Write', points: 1, status: 'todo', icon: 'Pencil', duration: 5, timerIsRunning: true, timerEndTime: 21_000, timerRemainingMs: null },
          { id: 'task-3', name: 'Draw', points: 1, status: 'todo', icon: 'Palette', duration: 3, timerIsRunning: false, timerEndTime: null, timerRemainingMs: 12_000 },
        ],
      },
      {
        id: 'child-2',
        tasks: [{ id: 'task-4', name: 'Move', points: 1, status: 'todo', icon: 'Footprints', duration: 2, timerIsRunning: true, timerEndTime: 30_000, timerRemainingMs: null }],
      },
    ],
    ...overrides,
  } as unknown as AppState;
}

test('startTaskTimerInState starts the target task from its duration and pauses other running tasks for that child', () => {
  const state = timerStateFixture();

  const next = startTaskTimerInState(state, 'child-1', 'task-1', 10_000);

  assert.equal(next.children[0].tasks[0].timerIsRunning, true);
  assert.equal(next.children[0].tasks[0].timerEndTime, 610_000);
  assert.equal(next.children[0].tasks[0].timerRemainingMs, null);
  assert.equal(next.children[0].tasks[1].timerIsRunning, false);
  assert.equal(next.children[0].tasks[1].timerEndTime, null);
  assert.equal(next.children[0].tasks[1].timerRemainingMs, 11_000);
  assert.equal(next.children[0].tasks[2], state.children[0].tasks[2]);
  assert.equal(next.children[1], state.children[1]);
});

test('startTaskTimerInState resumes the target task from a stored remaining duration', () => {
  const state = timerStateFixture();

  const next = startTaskTimerInState(state, 'child-1', 'task-3', 10_000);

  assert.equal(next.children[0].tasks[2].timerIsRunning, true);
  assert.equal(next.children[0].tasks[2].timerEndTime, 22_000);
  assert.equal(next.children[0].tasks[2].timerRemainingMs, null);
});

test('startTaskTimerInState preserves equivalent content when child or task is missing', () => {
  const state = timerStateFixture();

  assert.deepEqual(startTaskTimerInState(state, 'missing-child', 'task-1', 10_000), state);
  assert.deepEqual(startTaskTimerInState(state, 'child-1', 'missing-task', 10_000), {
    ...state,
    children: [{
      ...state.children[0],
      tasks: [
        state.children[0].tasks[0],
        { ...state.children[0].tasks[1], timerIsRunning: false, timerEndTime: null, timerRemainingMs: 11_000 },
        state.children[0].tasks[2],
      ],
    }, state.children[1]],
  });
});

test('pauseTaskTimerInState pauses only a running matching task', () => {
  const state = timerStateFixture();

  const next = pauseTaskTimerInState(state, 'child-1', 'task-2', 10_000);

  assert.equal(next.children[0].tasks[1].timerIsRunning, false);
  assert.equal(next.children[0].tasks[1].timerEndTime, null);
  assert.equal(next.children[0].tasks[1].timerRemainingMs, 11_000);
  assert.equal(next.children[0].tasks[0], state.children[0].tasks[0]);
  assert.equal(next.children[1], state.children[1]);
});

test('pauseTaskTimerInState leaves non-running or missing timer content equivalent', () => {
  const state = timerStateFixture();

  assert.deepEqual(pauseTaskTimerInState(state, 'child-1', 'task-1', 10_000), state);
  assert.deepEqual(pauseTaskTimerInState(state, 'child-1', 'missing-task', 10_000), state);
  assert.deepEqual(pauseTaskTimerInState(state, 'missing-child', 'task-2', 10_000), state);
});
