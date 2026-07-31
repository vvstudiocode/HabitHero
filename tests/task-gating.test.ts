import assert from 'node:assert/strict';
import test from 'node:test';
import { canStartTask, hasBlockingReviewTask } from '../src/lib/task-gating';

const task = (id: string, status: 'todo' | 'pending' | 'revision_requested' | 'completed', requiresReviewBeforeNextTask = false) => ({
  id,
  status,
  requiresReviewBeforeNextTask,
});

test('pending review never blocks another task', () => {
  assert.equal(hasBlockingReviewTask([task('a', 'pending', true)]), false);
  assert.equal(hasBlockingReviewTask([task('a', 'pending', false)]), false);
});

test('a returned task does not lock other tasks', () => {
  assert.equal(hasBlockingReviewTask([task('a', 'revision_requested', true)]), false);
  assert.equal(canStartTask([task('a', 'revision_requested', true), task('b', 'todo')], 'a'), true);
  assert.equal(canStartTask([task('a', 'revision_requested', true), task('b', 'todo')], 'b'), true);
});

test('approved tasks no longer block other tasks', () => {
  assert.equal(canStartTask([task('a', 'completed', true), task('b', 'todo')], 'b'), true);
});

test('a running task still prevents a second task from starting', () => {
  assert.equal(canStartTask([task('a', 'todo'), task('b', 'todo')], 'b'), true);
});
