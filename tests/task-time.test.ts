import assert from 'node:assert/strict';
import test from 'node:test';
import { isTaskExecutableAt } from '../src/lib/task-time';

test('uses Taipei time when deciding whether a task may start', () => {
  // 2026-07-24T18:00Z is 2026-07-25 02:00 in Taipei, still before 03:30.
  assert.equal(isTaskExecutableAt('03:30:00', new Date('2026-07-24T18:00:00.000Z')), false);
  assert.equal(isTaskExecutableAt('03:30:00', new Date('2026-07-24T19:30:00.000Z')), true);
});

test('allows tasks without a start time', () => {
  assert.equal(isTaskExecutableAt(null, new Date('2026-07-24T18:00:00.000Z')), true);
});
