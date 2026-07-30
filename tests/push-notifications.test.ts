import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getNotificationPermissionLabel,
  getNotificationRecipientRole,
  shouldRegisterPushNotifications,
} from '../src/lib/notification-preferences';

test('push registration only starts when the user enabled notifications and permission is granted', () => {
  assert.equal(shouldRegisterPushNotifications({ enabled: true, permission: 'granted', platform: 'ios' }), true);
  assert.equal(shouldRegisterPushNotifications({ enabled: false, permission: 'granted', platform: 'ios' }), false);
  assert.equal(shouldRegisterPushNotifications({ enabled: true, permission: 'denied', platform: 'ios' }), false);
  assert.equal(shouldRegisterPushNotifications({ enabled: true, permission: 'granted', platform: 'web' }), false);
});

test('notification permission labels explain the actionable iOS states', () => {
  assert.equal(getNotificationPermissionLabel('granted'), '已允許通知');
  assert.equal(getNotificationPermissionLabel('denied'), '通知已被關閉，請到系統設定開啟');
  assert.equal(getNotificationPermissionLabel('prompt'), '尚未決定');
});

test('task origin maps to the intended notification recipient', () => {
  assert.equal(getNotificationRecipientRole('parent_assigned'), 'child');
  assert.equal(getNotificationRecipientRole('system_template'), 'child');
  assert.equal(getNotificationRecipientRole('child_proposed'), 'parent');
});
