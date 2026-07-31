import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  drainAdventureCompletionQueue,
  enqueueAdventureCompletion,
  loadAdventureCompletionQueue,
  removeAdventureCompletion,
  restoreQueuedAdventureCompletions,
  type AdventureCompletionQueueEntry,
  type QueueStorage,
} from '../src/lib/adventure-offline-queue';
import { createAdventureStoreActions } from '../src/lib/adventure-store-actions';
import type { AppState } from '../src/types';

const memoryStorage = (): QueueStorage => {
  const values = new Map<string, string>();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
};

const entry = (ownerUserId: string, idempotencyKey = '00000000-0000-4000-8000-000000000001'): AdventureCompletionQueueEntry => ({
  ownerUserId,
  childProfileId: 'child-1',
  taskId: 'task-1',
  submission: { idempotencyKey, quickReport: 'smooth' },
  previous: {
    status: 'todo',
    quickReport: null,
    reflection: null,
    mood: null,
    difficulty: null,
    submittedAt: null,
  },
  queuedAt: '2026-07-31T00:00:00.000Z',
});

describe('offline adventure completion queue', () => {
  it('isolates entries by authenticated user and deduplicates the same request', () => {
    const storage = memoryStorage();
    enqueueAdventureCompletion(entry('user-a'), storage);
    enqueueAdventureCompletion(entry('user-a'), storage);
    enqueueAdventureCompletion(entry('user-b'), storage);

    assert.equal(loadAdventureCompletionQueue('user-a', storage).length, 1);
    assert.equal(loadAdventureCompletionQueue('user-b', storage).length, 1);
    assert.equal(loadAdventureCompletionQueue('user-a', storage)[0].ownerUserId, 'user-a');
  });

  it('removes only the matching idempotent request', () => {
    const storage = memoryStorage();
    const first = entry('user-a');
    const second = { ...entry('user-a', '00000000-0000-4000-8000-000000000002'), taskId: 'task-2' };
    enqueueAdventureCompletion(first, storage);
    enqueueAdventureCompletion(second, storage);

    removeAdventureCompletion('user-a', first.submission.idempotencyKey, storage);
    assert.deepEqual(loadAdventureCompletionQueue('user-a', storage), [second]);
  });

  it('drains once, removes successes, and reports failures for rollback', async () => {
    const storage = memoryStorage();
    const success = entry('user-a');
    const failure = { ...entry('user-a', '00000000-0000-4000-8000-000000000002'), taskId: 'task-2' };
    enqueueAdventureCompletion(success, storage);
    enqueueAdventureCompletion(failure, storage);
    const sent: string[] = [];

    const result = await drainAdventureCompletionQueue('user-a', async queued => {
      sent.push(queued.taskId);
      if (queued.taskId === 'task-2') throw new Error('任務時間已截止');
    }, storage);

    assert.deepEqual(sent, ['task-1', 'task-2']);
    assert.deepEqual(result.succeededTaskIds, ['task-1']);
    assert.equal(result.failures[0].message, '任務時間已截止');
    assert.deepEqual(loadAdventureCompletionQueue('user-a', storage), []);
  });

  it('keeps transient network failures queued for a later online event', async () => {
    const storage = memoryStorage();
    const queued = entry('network-user');
    enqueueAdventureCompletion(queued, storage);

    const result = await drainAdventureCompletionQueue(
      'network-user',
      async () => { throw new Error('Failed to fetch'); },
      storage,
      () => true,
    );

    assert.equal(result.failures[0].retryable, true);
    assert.deepEqual(loadAdventureCompletionQueue('network-user', storage), [queued]);
  });

  it('restores the pending-sync marker only on the matching child task', () => {
    const storage = memoryStorage();
    enqueueAdventureCompletion(entry('user-a'), storage);
    const state = {
      children: [{
        id: 'child-1',
        tasks: [{ id: 'task-1', name: '刷牙', points: 5, icon: 'tooth', status: 'todo', isDaily: true }],
      }],
    } as never;

    const restored = restoreQueuedAdventureCompletions(state, 'user-a', storage);
    assert.equal(restored.children[0].tasks[0].status, 'pending');
    assert.equal(restored.children[0].tasks[0].pendingSync, true);
  });

  it('optimistically marks offline completion without awarding points or calling RPC', async () => {
    let state = {
      children: [{
        id: 'child-offline',
        points: 20,
        tasks: [{
          id: 'task-offline',
          name: '刷牙',
          points: 5,
          icon: 'tooth',
          status: 'todo',
          isDaily: true,
        }],
      }],
    } as unknown as AppState;
    let mutationCalls = 0;
    const actions = createAdventureStoreActions({
      mutate: (async () => { mutationCalls += 1; }) as never,
      familyId: 'family-1',
      getState: () => state,
      setState: updater => { state = updater(state); },
      createLocalId: () => 'local-1',
      authenticatedUserId: 'offline-user',
      isOnline: () => false,
      setError: () => undefined,
    });

    await actions.submitAdventureCompletion('task-offline', {
      idempotencyKey: '00000000-0000-4000-8000-000000000003',
    });

    assert.equal(mutationCalls, 0);
    assert.equal(state.children[0].points, 20);
    assert.equal(state.children[0].tasks[0].status, 'pending');
    assert.equal(state.children[0].tasks[0].pendingSync, true);
  });

  it('does not rollback pending-sync UI for a transient drain failure', async () => {
    const ownerUserId = 'transient-store-user';
    const queued = {
      ...entry(ownerUserId, '00000000-0000-4000-8000-000000000004'),
      childProfileId: 'child-transient',
      taskId: 'task-transient',
    };
    enqueueAdventureCompletion(queued);
    let state = {
      children: [{
        id: 'child-transient',
        points: 20,
        tasks: [{
          id: 'task-transient',
          name: '刷牙',
          points: 5,
          icon: 'tooth',
          status: 'pending',
          isDaily: true,
          pendingSync: true,
        }],
      }],
    } as unknown as AppState;
    const repository = {
      submitAdventureCompletion: async () => { throw new Error('Failed to fetch'); },
    };
    const actions = createAdventureStoreActions({
      mutate: (async (operation: (repo: typeof repository, familyId: string) => Promise<unknown>) =>
        operation(repository, 'family-1')) as never,
      familyId: 'family-1',
      getState: () => state,
      setState: updater => { state = updater(state); },
      createLocalId: () => 'local-1',
      authenticatedUserId: ownerUserId,
      isOnline: () => true,
      setError: () => undefined,
    });

    await actions.flushAdventureCompletionQueue();

    assert.equal(state.children[0].tasks[0].status, 'pending');
    assert.equal(state.children[0].tasks[0].pendingSync, true);
    assert.equal(loadAdventureCompletionQueue(ownerUserId).length, 1);
  });

  it('shows a matching daily schedule on the child board immediately', async () => {
    let state = {
      children: [{
        id: 'child-daily',
        points: 0,
        tasks: [],
      }],
      taskSchedules: [],
    } as unknown as AppState;
    const actions = createAdventureStoreActions({
      mutate: (async (_operation, optimisticUpdate) => {
        if (optimisticUpdate) state = optimisticUpdate(state);
      }) as never,
      familyId: 'family-1',
      getState: () => state,
      setState: updater => { state = updater(state); },
      createLocalId: (() => {
        let id = 0;
        return () => `local-${++id}`;
      })(),
      authenticatedUserId: 'parent-1',
      isOnline: () => true,
      setError: () => undefined,
    });

    await actions.createAdventureSchedule({
      childProfileIds: ['child-daily'],
      name: '刷牙',
      points: 5,
      icon: 'tooth',
      category: 'life_habit',
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      activeFrom: '2000-01-01',
    });

    assert.equal(state.children[0].tasks.length, 1);
    assert.equal(state.children[0].tasks[0].adventureType, 'daily');
    assert.equal(state.children[0].tasks[0].name, '刷牙');
  });
});
