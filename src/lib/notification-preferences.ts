import type { TaskOrigin } from '../types';

export type NotificationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';
export type NotificationPlatform = 'ios' | 'web' | 'unsupported';
export type NotificationRecipientRole = 'parent' | 'child';

export function hasEnabledPushDevice(devices: Array<{ enabled?: boolean | null }> | null | undefined) {
  return devices?.some(device => device.enabled === true) ?? false;
}

export function shouldRegisterPushNotifications(input: {
  enabled: boolean;
  permission: NotificationPermission;
  platform: NotificationPlatform;
}) {
  return input.enabled && input.permission === 'granted' && input.platform === 'ios';
}

export function getNotificationPermissionLabel(permission: NotificationPermission) {
  switch (permission) {
    case 'granted':
      return '已允許通知';
    case 'denied':
      return '通知已被關閉，請到系統設定開啟';
    case 'prompt':
      return '尚未決定';
    default:
      return '目前裝置不支援背景通知';
  }
}

export function getNotificationRecipientRole(origin: TaskOrigin): NotificationRecipientRole {
  return origin === 'child_proposed' ? 'parent' : 'child';
}
