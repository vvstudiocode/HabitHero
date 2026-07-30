import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthSession } from '../auth';
import { getSupabaseClient } from '../lib/supabase';
import {
  addPushListeners,
  disablePushDevicesForProfile,
  getIosPushPermission,
  isIosPushSupported,
  readNotificationPreference,
  requestAndRegisterIosPush,
  setNotificationPreference,
  type PushDeviceContext,
} from '../lib/push-notifications';
import type { NotificationPermission } from '../lib/notification-preferences';

interface UseNotificationSettingsOptions {
  familyId: string | null;
  childProfileId: string | null;
  onForegroundNotification?: (title: string, body: string) => void;
}

export function useNotificationSettings({ familyId, childProfileId, onForegroundNotification }: UseNotificationSettingsOptions) {
  const { session } = useAuthSession();
  const profileId = session?.user.id ?? null;
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('unsupported');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registeredContext = useRef<string | null>(null);
  const foregroundNotificationRef = useRef(onForegroundNotification);
  const supported = isIosPushSupported();

  useEffect(() => {
    if (!profileId) return undefined;
    const client = getSupabaseClient();
    return () => {
      // A single device can switch between parent and child sessions. Disable
      // the previous profile's device rows before another profile can use it.
      void disablePushDevicesForProfile(client, profileId);
    };
  }, [profileId]);

  useEffect(() => {
    foregroundNotificationRef.current = onForegroundNotification;
  }, [onForegroundNotification]);

  useEffect(() => {
    let active = true;
    if (!profileId) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError(null);
    void Promise.all([
      readNotificationPreference(getSupabaseClient(), profileId),
      getIosPushPermission(),
    ]).then(([preference, currentPermission]) => {
      if (!active) return;
      setEnabled(preference);
      setPermission(currentPermission);
    }).catch(loadError => {
      if (active) setError(loadError instanceof Error ? loadError.message : '通知設定載入失敗。');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [profileId]);

  useEffect(() => {
    if (!supported) return undefined;
    let active = true;
    let removeListeners: (() => void) | undefined;
    void addPushListeners({
      onReceived: notification => {
        if (!active) return;
        foregroundNotificationRef.current?.(notification.title ?? 'HabitHero', notification.body ?? '你有一則新通知。');
      },
    }).then(remove => {
      if (active) removeListeners = remove;
      else remove();
    });
    return () => {
      active = false;
      removeListeners?.();
    };
  }, [supported]);

  useEffect(() => {
    if (!enabled || !familyId || !profileId || !supported) return;
    const contextKey = `${profileId}:${familyId}:${childProfileId ?? 'parent'}`;
    if (registeredContext.current === contextKey) return;
    void requestAndRegisterIosPush({
      supabase: getSupabaseClient(),
      familyId,
      profileId,
      childProfileId,
    }).then(result => {
      setPermission(result.permission);
      if (result.permission === 'granted') registeredContext.current = contextKey;
    }).catch(registerError => {
      setError(registerError instanceof Error ? registerError.message : '通知註冊失敗。');
    });
  }, [childProfileId, enabled, familyId, profileId, supported]);

  const toggle = useCallback(async (nextEnabled: boolean) => {
    if (!profileId) return false;
    setSaving(true);
    setError(null);
    try {
      if (nextEnabled) {
        if (!familyId || !supported) {
          setError('目前只有 iOS App 支援背景通知。');
          return false;
        }
        const result = await requestAndRegisterIosPush({
          supabase: getSupabaseClient(),
          familyId,
          profileId,
          childProfileId,
        } satisfies PushDeviceContext);
        setPermission(result.permission);
        if (result.permission !== 'granted') {
          setError('請允許 HabitHero 使用通知，才能收到背景提醒。');
          return false;
        }
        registeredContext.current = `${profileId}:${familyId}:${childProfileId ?? 'parent'}`;
      }
      await setNotificationPreference(getSupabaseClient(), profileId, nextEnabled);
      setEnabled(nextEnabled);
      return true;
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : '通知設定更新失敗。');
      return false;
    } finally {
      setSaving(false);
    }
  }, [childProfileId, familyId, profileId, supported]);

  return { enabled, permission, supported, loading, saving, error, toggle };
}
