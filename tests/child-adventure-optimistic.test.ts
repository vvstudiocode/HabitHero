import assert from 'node:assert/strict';
import test from 'node:test';
import { replaceOptimisticTaskId } from '../src/store';
import type { AppState } from '../src/types';

test('replaces a child-created adventure local id without replacing the task', () => {
  const optimisticTask = {
    id: 'local-1',
    name: '炒飯',
    points: 5,
    icon: 'Star',
    status: 'todo',
  };
  const state = {
    children: [{
      id: 'child-1',
      tasks: [optimisticTask],
    }],
  } as unknown as AppState;

  const reconciled = replaceOptimisticTaskId(state, 'child-1', 'local-1', 'task-1');

  assert.equal(reconciled.children[0].tasks[0].id, 'task-1');
  assert.equal(reconciled.children[0].tasks[0].name, '炒飯');
  assert.notEqual(reconciled.children[0].tasks[0], optimisticTask);
});

test('leaves state unchanged when the server does not return an id', () => {
  const state = {
    children: [{
      id: 'child-1',
      tasks: [{ id: 'local-1', name: '炒飯', points: 5, icon: 'Star', status: 'todo' }],
    }],
  } as unknown as AppState;

  assert.equal(replaceOptimisticTaskId(state, 'child-1', 'local-1', ''), state);
});
