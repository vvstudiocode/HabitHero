import assert from 'node:assert/strict';
import test from 'node:test';
import { getChildMenuNotifications, getParentMenuNotifications } from '../src/lib/menu-notifications';

test('parent menu notifications map pending data to the matching main buttons', () => {
  assert.deepEqual(getParentMenuNotifications({ review: 1, rewards: 0, wishlist: 0 }), {
    review: true,
    rewards: false,
    wishlist: false,
  });
  assert.deepEqual(getParentMenuNotifications({ review: 0, rewards: 1, wishlist: 3 }), {
    review: false,
    rewards: true,
    wishlist: true,
  });
});

test('child menu notifications mark goals, rewards, and wishes with available items', () => {
  assert.deepEqual(getChildMenuNotifications({ goals: 2, rewards: 1, wishlist: 1 }), {
    goals: true,
    rewards: true,
    wishlist: true,
  });
  assert.deepEqual(getChildMenuNotifications({ goals: 0, rewards: 0, wishlist: 0 }), {
    goals: false,
    rewards: false,
    wishlist: false,
  });
});
