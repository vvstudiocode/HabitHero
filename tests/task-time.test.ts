import assert from 'node:assert/strict';
import test from 'node:test';
import { getTaskExecutionState, isTaskExecutableAt } from '../src/lib/task-time';

test('uses Taipei time when deciding whether a task may start', () => {
  // 2026-07-24T18:00Z is 2026-07-25 02:00 in Taipei, still before 03:30.
  assert.equal(isTaskExecutableAt('03:30:00', new Date('2026-07-24T18:00:00.000Z')), false);
  assert.equal(isTaskExecutableAt('03:30:00', new Date('2026-07-24T19:30:00.000Z')), true);
});

test('allows tasks without a start time', () => {
  assert.equal(isTaskExecutableAt(null, new Date('2026-07-24T18:00:00.000Z')), true);
});

test('opens a task only inside its execution window', () => {
  const before = new Date('2026-07-24T23:00:00.000Z'); // 07:00 Taipei
  const inside = new Date('2026-07-25T00:30:00.000Z'); // 08:30 Taipei
  const atEnd = new Date('2026-07-25T02:00:00.000Z'); // 10:00 Taipei

  assert.equal(getTaskExecutionState('08:00', '10:00', before), 'not_started');
  assert.equal(getTaskExecutionState('08:00', '10:00', inside), 'available');
  assert.equal(getTaskExecutionState('08:00', '10:00', atEnd), 'expired');
  assert.equal(isTaskExecutableAt('08:00', '10:00', atEnd), false);
});

test('an omitted end time keeps the task available after its start time', () => {
  assert.equal(getTaskExecutionState('08:00', null, new Date('2026-07-25T04:00:00.000Z')), 'available');
});
