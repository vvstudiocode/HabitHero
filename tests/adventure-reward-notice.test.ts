import assert from 'node:assert/strict';
import test from 'node:test';
import type { AdventureTask } from '../src/features/adventures/types';
import {
  createAdventureRewardBundle,
  createInitialAdventureRewardNoticeState,
  getApprovedAdventureRewardEvents,
  getUnseenAdventureRewardEvents,
  markAdventureRewardTaskSubmitted,
  markAdventureRewardEventsSeen,
  readAdventureRewardNoticeState,
  writeAdventureRewardNoticeState,
} from '../src/features/adventures/adventure-reward-notice';

const task = (overrides: Partial<AdventureTask>): AdventureTask => ({
  id: 'task-1',
  name: '整理書桌',
  points: 10,
  status: 'completed',
  icon: 'Star',
  duration: null,
  timerEndTime: null,
  timerRemainingMs: null,
  timerIsRunning: false,
  isDaily: true,
  templateId: null,
  dueOn: null,
  dueTime: null,
  endTime: null,
  requiresReviewBeforeNextTask: false,
  category: 'life_habit',
  origin: 'parent_assigned',
  createdAt: '2026-08-15T08:00:00.000Z',
  updatedAt: '2026-08-15T08:00:00.000Z',
  completedAt: '2026-08-15T09:00:00.000Z',
  submittedAt: '2026-08-15T08:30:00.000Z',
  reviewedAt: '2026-08-15T09:00:00.000Z',
  approvedPoints: 10,
  adventureType: 'daily',
  ...overrides,
});

test('approved adventure rewards only include completed tasks with a review time', () => {
  const events = getApprovedAdventureRewardEvents([
    task({ id: 'approved', reviewedAt: '2026-08-15T09:00:00.000Z' }),
    task({ id: 'pending', status: 'pending', reviewedAt: null }),
    task({ id: 'unreviewed', status: 'completed', reviewedAt: null }),
  ]);

  assert.deepEqual(events.map((event) => event.taskId), ['approved']);
  assert.equal(events[0].stars, 10);
  assert.equal(events[0].scrolls, 1);
});

test('approved points override the original task points and zero stars still grants a scroll', () => {
  const events = getApprovedAdventureRewardEvents([
    task({ id: 'adjusted', points: 20, approvedPoints: 7 }),
    task({ id: 'scroll-only', points: 10, approvedPoints: 0 }),
  ]);

  assert.deepEqual(events.map((event) => [event.taskId, event.stars, event.scrolls]), [
    ['adjusted', 7, 1],
    ['scroll-only', 0, 1],
  ]);
});

test('unseen reward events exclude already displayed approvals', () => {
  const events = getApprovedAdventureRewardEvents([
    task({ id: 'old', reviewedAt: '2026-08-15T09:00:00.000Z' }),
    task({ id: 'new', reviewedAt: '2026-08-15T10:00:00.000Z' }),
  ]);

  assert.deepEqual(
    getUnseenAdventureRewardEvents(events, ['old']).map((event) => event.taskId),
    ['new'],
  );
});

test('reward bundles combine several approvals into one celebration', () => {
  const events = getApprovedAdventureRewardEvents([
    task({ id: 'first', name: '刷牙', approvedPoints: 5, reviewedAt: '2026-08-15T09:00:00.000Z' }),
    task({ id: 'second', name: '整理書桌', approvedPoints: 10, reviewedAt: '2026-08-15T10:00:00.000Z' }),
  ]);
  const bundle = createAdventureRewardBundle(events);

  assert.equal(bundle.totalStars, 15);
  assert.equal(bundle.totalScrolls, 2);
  assert.equal(bundle.latestReviewedAt, '2026-08-15T10:00:00.000Z');
  assert.deepEqual(bundle.events.map((event) => event.taskName), ['刷牙', '整理書桌']);
});

test('first launch baselines existing approvals so historical tasks do not replay', () => {
  const events = getApprovedAdventureRewardEvents([
    task({ id: 'historic' }),
  ]);
  const state = createInitialAdventureRewardNoticeState(events, []);

  assert.equal(state.initialized, true);
  assert.deepEqual(state.seenTaskIds, ['historic']);
  assert.deepEqual(state.submittedTaskIds, []);
});

test('first launch keeps a child-submitted approval available for celebration', () => {
  const events = getApprovedAdventureRewardEvents([
    task({ id: 'historic' }),
    task({ id: 'submitted-before-approval' }),
  ]);
  const state = createInitialAdventureRewardNoticeState(events, ['submitted-before-approval']);

  assert.deepEqual(state.seenTaskIds, ['historic']);
  assert.deepEqual(state.submittedTaskIds, ['submitted-before-approval']);
  assert.deepEqual(
    getUnseenAdventureRewardEvents(events, state.seenTaskIds).map((event) => event.taskId),
    ['submitted-before-approval'],
  );
});

test('child completion intent persists until its approval is displayed', () => {
  const submitted = markAdventureRewardTaskSubmitted(
    { initialized: true, seenTaskIds: [], submittedTaskIds: [] },
    'task-1',
  );
  const event = getApprovedAdventureRewardEvents([task({ id: 'task-1' })])[0];

  assert.deepEqual(submitted.submittedTaskIds, ['task-1']);
  const displayed = markAdventureRewardEventsSeen(submitted, [event]);
  assert.deepEqual(displayed.seenTaskIds, ['task-1']);
  assert.deepEqual(displayed.submittedTaskIds, []);
});

test('reward notice state persists per child and marks displayed events once', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const original = readAdventureRewardNoticeState('child-1', storage);
  const events = getApprovedAdventureRewardEvents([task({ id: 'task-1' })]);
  const next = markAdventureRewardEventsSeen(original, events);

  writeAdventureRewardNoticeState('child-1', next, storage);

  assert.deepEqual(readAdventureRewardNoticeState('child-1', storage), {
    initialized: true,
    seenTaskIds: ['task-1'],
    submittedTaskIds: [],
  });
});

test('legacy reward notice state is migrated without losing current approvals', () => {
  const values = new Map<string, string>([
    ['habithero:adventure-reward-notice:child-1', JSON.stringify({ initialized: true, seenTaskIds: ['task-1'] })],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };

  assert.deepEqual(readAdventureRewardNoticeState('child-1', storage), {
    initialized: true,
    seenTaskIds: [],
    submittedTaskIds: [],
  });
});
