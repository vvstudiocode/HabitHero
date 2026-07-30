import { Bell, BellOff, LoaderCircle } from 'lucide-react';
import type { useNotificationSettings } from '../hooks/useNotificationSettings';
import { getNotificationPermissionLabel } from '../lib/notification-preferences';

interface PushNotificationSettingsProps {
  settings: ReturnType<typeof useNotificationSettings>;
}

export function PushNotificationSettings({ settings }: PushNotificationSettingsProps) {
  const disabled = settings.loading || settings.saving || !settings.supported;

  return (
    <section className="hh-notification-settings" aria-labelledby="notification-settings-title">
      <div className="hh-notification-settings-heading">
        <div className="hh-notification-settings-icon" aria-hidden="true">
          {settings.enabled ? <Bell size={20} /> : <BellOff size={20} />}
        </div>
        <div>
          <h4 id="notification-settings-title">通知提醒</h4>
          <p>{settings.supported ? getNotificationPermissionLabel(settings.permission) : '請使用 iOS App 開啟背景通知'}</p>
        </div>
      </div>
      <button
        type="button"
        className={`hh-notification-toggle${settings.enabled ? ' is-on' : ''}`}
        role="switch"
        aria-checked={settings.enabled}
        aria-label="背景通知"
        disabled={disabled}
        onClick={() => void settings.toggle(!settings.enabled)}
      >
        {settings.saving && <LoaderCircle size={16} className="hh-notification-toggle-spinner" aria-hidden="true" />}
        <span className="hh-notification-toggle-track" aria-hidden="true">
          <span className="hh-notification-toggle-thumb" />
        </span>
        <span className="hh-notification-toggle-label">{settings.enabled ? '已開啟' : '已關閉'}</span>
      </button>
      {settings.error && <p className="hh-notification-settings-error" role="alert">{settings.error}</p>}
      <p className="hh-notification-settings-help">開啟後，家長新增任務或孩子提出目標時，對方可以收到系統通知。</p>
    </section>
  );
}
