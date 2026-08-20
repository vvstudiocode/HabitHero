import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTaskTime, formatTaskWindow, haveSameIds } from '../src/lib/child-dashboard-display';

test('formats missing task time as an all-day task', () => {
  assert.equal(formatTaskTime(), '全天');
  assert.equal(formatTaskTime(null), '全天');
  assert.equal(formatTaskTime(''), '全天');
});

test('formats task time and window boundaries using five-character clock values', () => {
  assert.equal(formatTaskTime('09:30:00'), '09:30');
  assert.equal(formatTaskWindow({ dueTime: '09:30:00' }), '09:30起');
  assert.equal(formatTaskWindow({ dueTime: '09:30:00', endTime: '10:45:00' }), '09:30–10:45');
  assert.equal(formatTaskWindow({ endTime: '10:45:00' }), '隨時–10:45');
});

test('compares ordered id lists and rejects different length or order', () => {
  assert.equal(haveSameIds(['first', 'second'], ['first', 'second']), true);
  assert.equal(haveSameIds([], []), true);
  assert.equal(haveSameIds(['first', 'second'], ['second', 'first']), false);
  assert.equal(haveSameIds(['first'], ['first', 'second']), false);
  assert.equal(haveSameIds(['first'], ['other']), false);
});
