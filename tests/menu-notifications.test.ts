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

test('child menu notifications do not treat available rewards as a new-item alert', () => {
  assert.deepEqual(getChildMenuNotifications({ goals: 2, rewardTickets: 0, wishlist: 1 }), {
    goals: true,
    rewards: false,
    wishlist: true,
  });
  assert.deepEqual(getChildMenuNotifications({ rewardTickets: 1 }), {
    goals: false,
    rewards: true,
    wishlist: false,
  });
  assert.deepEqual(getChildMenuNotifications({ goals: 0, rewardTickets: 0, wishlist: 0 }), {
    goals: false,
    rewards: false,
    wishlist: false,
  });
});
