import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdventureStoreActions } from '../src/lib/adventure-store-actions';
import type { AppState } from '../src/types';

test('failed abandonment rolls back the optimistic cancelled state', async () => {
  let state = {
    children: [{
      id: 'child-1',
      tasks: [{
        id: 'task-1',
        name: '整理書包',
        points: 5,
        icon: 'Star',
        status: 'todo',
        adventureType: 'general',
        origin: 'child_proposed',
      }],
    }],
  } as unknown as AppState;

  const actions = createAdventureStoreActions({
    mutate: (async (operation, optimisticUpdate) => {
      const previous = state;
      if (optimisticUpdate) state = optimisticUpdate(state);
      try {
        await operation({ abandonChildAdventure: async () => { throw new Error('task not found or not authorized'); } } as never, 'family-1');
      } catch (error) {
        state = previous;
        throw error;
      }
    }) as never,
    familyId: 'family-1',
    getState: () => state,
    setState: updater => { state = updater(state); },
    createLocalId: () => 'local-1',
    authenticatedUserId: 'parent-1',
    isOnline: () => true,
    setError: () => undefined,
  });

  await assert.rejects(actions.abandonChildAdventure('task-1'), /task not found or not authorized/);
  assert.equal(state.children[0].tasks[0].status, 'todo');
  assert.equal(state.children[0].tasks[0].cancelledAt, undefined);
});
