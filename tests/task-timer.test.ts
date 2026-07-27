import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTimerSnapshot, getTaskTimerRemainingMs, toTimerSnapshot } from '../src/lib/task-timer';

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
