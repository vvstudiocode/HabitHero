import type { useNotificationSettings } from '../hooks/useNotificationSettings';

interface PushNotificationSettingsProps {
  settings: ReturnType<typeof useNotificationSettings>;
  className?: string;
}

export function PushNotificationSettings({ settings, className }: PushNotificationSettingsProps) {
  const disabled = settings.loading || settings.saving || !settings.supported;

  return (
    <section className={`hh-notification-settings${className ? ` ${className}` : ''}`} aria-labelledby="notification-settings-title">
      <div className="hh-notification-settings-heading">
        <h4 id="notification-settings-title">通知</h4>
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
        <span className="hh-notification-toggle-track" aria-hidden="true">
          <span className="hh-notification-toggle-thumb" />
        </span>
      </button>
      {settings.error && <p className="hh-notification-settings-error" role="alert">{settings.error}</p>}
    </section>
  );
}
