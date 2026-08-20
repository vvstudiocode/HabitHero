import assert from 'node:assert/strict';
import test from 'node:test';
import { groupParentRewards } from '../src/lib/parent-reward-grouping';
import type { Child, Reward } from '../src/types';

const reward = (id: string, name: string, points: number): Reward => ({
  id,
  name,
  points,
  icon: 'Gift',
});

const child = (id: string, name: string, rewards: Reward[]): Child => ({
  id,
  name,
  characterId: 'character',
  code: id,
  loginName: null,
  points: 0,
  tasks: [],
  rewards,
  wishlist: [],
  tickets: [],
  theme: {
    accentColor: null,
    mobileBackgroundImageUrl: null,
    desktopBackgroundImageUrl: null,
  },
});

test('keeps reward groups in the order of their first occurrence', () => {
  const groups = groupParentRewards([
    child('xuan', '小宣', [reward('xuan-star', '看電影', 20), reward('xuan-book', '買書', 30)]),
    child('en', '小恩', [reward('en-star', '看電影', 20)]),
  ]);

  assert.deepEqual(groups.map(({ id, name, points }) => ({ id, name, points })), [
    { id: '看電影-20', name: '看電影', points: 20 },
    { id: '買書-30', name: '買書', points: 30 },
  ]);
});

test('merges same-name and same-point rewards while retaining each child reward id', () => {
  const [group] = groupParentRewards([
    child('xuan', '小宣', [reward('xuan-star', '看電影', 20)]),
    child('en', '小恩', [reward('en-star', '看電影', 20)]),
  ]);

  assert.equal(group?.id, '看電影-20');
  assert.deepEqual(group?.children, [
    { childId: 'xuan', childName: '小宣', rewardId: 'xuan-star' },
    { childId: 'en', childName: '小恩', rewardId: 'en-star' },
  ]);
});

test('keeps same-name rewards with different points in separate groups', () => {
  const groups = groupParentRewards([
    child('xuan', '小宣', [reward('xuan-small', '看電影', 20), reward('xuan-large', '看電影', 50)]),
  ]);

  assert.deepEqual(groups.map(({ id, points, children }) => ({ id, points, rewardId: children[0]?.rewardId })), [
    { id: '看電影-20', points: 20, rewardId: 'xuan-small' },
    { id: '看電影-50', points: 50, rewardId: 'xuan-large' },
  ]);
});

test('retains duplicate reward entries from the same child', () => {
  const [group] = groupParentRewards([
    child('xuan', '小宣', [reward('xuan-star-1', '看電影', 20), reward('xuan-star-2', '看電影', 20)]),
  ]);

  assert.deepEqual(group?.children, [
    { childId: 'xuan', childName: '小宣', rewardId: 'xuan-star-1' },
    { childId: 'xuan', childName: '小宣', rewardId: 'xuan-star-2' },
  ]);
});

test('returns no groups when there are no children', () => {
  assert.deepEqual(groupParentRewards([]), []);
});
