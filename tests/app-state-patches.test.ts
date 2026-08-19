import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyChildGameData, type ChildGameData } from '../src/features/world/contracts';
import { patchChild, patchGameData, patchTask } from '../src/lib/app-state-patches';
import * as storeFacade from '../src/store';
import type { AppState } from '../src/types';

function stateFixture(overrides: Partial<AppState> = {}): AppState {
  return {
    parentPin: null,
    parentConsentVersion: null,
    children: [
      {
        id: 'child-1',
        name: '小安',
        tasks: [
          { id: 'task-1', name: '閱讀', points: 5, icon: 'Book', status: 'todo' },
          { id: 'task-2', name: '整理', points: 3, icon: 'Sparkle', status: 'todo' },
        ],
        rewards: [],
        wishlist: [],
        tickets: [],
        points: 10,
        loginName: null,
        code: '',
        characterId: 'character.arthur',
        theme: { accentColor: null, mobileBackgroundImageUrl: null, desktopBackgroundImageUrl: null },
      },
      {
        id: 'child-2',
        name: '小恩',
        tasks: [{ id: 'task-3', name: '畫畫', points: 4, icon: 'Palette', status: 'todo' }],
        rewards: [],
        wishlist: [],
        tickets: [],
        points: 6,
        loginName: null,
        code: '',
        characterId: 'character.elina',
        theme: { accentColor: null, mobileBackgroundImageUrl: null, desktopBackgroundImageUrl: null },
      },
    ],
    parentActiveChildId: 'child-1',
    childLoggedInId: null,
    taskTemplates: [],
    ledger: [],
    lastResetDate: null,
    familyTheme: { accentColor: 'amber', mobileBackgroundImageUrl: null, desktopBackgroundImageUrl: null },
    adventureGroups: [],
    taskSchedules: [],
    timerSessions: [],
    gameDataByChildId: {
      'child-1': { ...emptyChildGameData(), walletBalance: 100 },
    },
    ...overrides,
  } as AppState;
}

test('patchChild updates only the matching child', () => {
  const state = stateFixture();
  const otherChild = state.children[1];

  const patched = patchChild(state, 'child-1', (child) => ({ ...child, points: child.points + 5 }));

  assert.equal(patched.children[0].points, 15);
  assert.equal(patched.children[1], otherChild);
});

test('patchChild preserves content when the child id is missing', () => {
  const state = stateFixture();

  const patched = patchChild(state, 'missing-child', (child) => ({ ...child, points: 0 }));

  assert.notEqual(patched, state);
  assert.deepEqual(patched, state);
});

test('patchTask updates only the matching task', () => {
  const state = stateFixture();
  const otherTask = state.children[0].tasks[1];
  const otherChildTask = state.children[1].tasks[0];

  const patched = patchTask(state, 'task-1', (task) => ({ ...task, status: 'completed' }));

  assert.equal(patched.children[0].tasks[0].status, 'completed');
  assert.equal(patched.children[0].tasks[1], otherTask);
  assert.equal(patched.children[1].tasks[0], otherChildTask);
});

test('patchTask preserves content when the task id is missing', () => {
  const state = stateFixture();

  const patched = patchTask(state, 'missing-task', (task) => ({ ...task, status: 'completed' }));

  assert.notEqual(patched, state);
  assert.deepEqual(patched, state);
});

test('patchGameData updates existing child game data only for the target child', () => {
  const state = stateFixture({
    gameDataByChildId: {
      'child-1': { ...emptyChildGameData(), walletBalance: 100 },
      'child-2': { ...emptyChildGameData(), walletBalance: 40 },
    },
  });
  const child2GameData = state.gameDataByChildId['child-2'];

  const patched = patchGameData(state, 'child-1', (gameData) => ({ ...gameData, walletBalance: gameData.walletBalance - 25 }));

  assert.equal(patched.gameDataByChildId['child-1'].walletBalance, 75);
  assert.equal(patched.gameDataByChildId['child-2'], child2GameData);
});

test('patchGameData supplies empty game data when the target child has no entry', () => {
  const state = stateFixture({ gameDataByChildId: {} });
  let received: ChildGameData | null = null;

  const patched = patchGameData(state, 'child-1', (gameData) => {
    received = gameData;
    return { ...gameData, walletBalance: 12 };
  });

  assert.deepEqual(received, emptyChildGameData());
  assert.equal(patched.gameDataByChildId['child-1'].walletBalance, 12);
});

test('store facade keeps exporting pure app state patch helpers', () => {
  assert.equal(storeFacade.patchChild, patchChild);
  assert.equal(storeFacade.patchTask, patchTask);
  assert.equal(storeFacade.patchGameData, patchGameData);
});
