import assert from 'node:assert/strict';
import test from 'node:test';
import { groupParentTodoTasks } from '../src/lib/parent-task-grouping';
import type { GrowthTaskWithChild } from '../src/features/growth/types';

const task = (id: string, childId: string, childName: string) => ({
  id,
  name: '睡前刷牙',
  points: 2,
  icon: 'Star',
  status: 'todo',
  isDaily: true,
  category: 'life_habit',
  childId,
  childName,
} as GrowthTaskWithChild);

test('groups duplicate task records into one child label while retaining every task id', () => {
  const [group] = groupParentTodoTasks([
    task('xuan-task-1', 'xuan', '小宣'),
    task('xuan-task-2', 'xuan', '小宣'),
    task('en-task-1', 'en', '小恩'),
  ], 'life_habit');

  assert.equal(group?.children.length, 2);
  assert.deepEqual(group?.children.map(({ childId, childName, taskIds }) => ({ childId, childName, taskIds })), [
    { childId: 'xuan', childName: '小宣', taskIds: ['xuan-task-1', 'xuan-task-2'] },
    { childId: 'en', childName: '小恩', taskIds: ['en-task-1'] },
  ]);
});
